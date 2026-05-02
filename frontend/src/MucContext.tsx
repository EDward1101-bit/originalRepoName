import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useChatContext } from './ChatContext';
import { supabase } from './supabase';
import type { ReceivedMessage } from 'stanza/protocol';

export interface Room {
  id: string;
  name: string;
  description: string;
  created_at: string;
  created_by: string;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  sender: string;
  body: string;
  created_at: Date;
  type?: 'system' | 'chat';
}

interface MucContextType {
  availableRooms: Room[];
  joinedRooms: string[]; // room names
  roomMessages: Record<string, RoomMessage[]>; // room name -> messages
  createRoom: (name: string, description?: string) => Promise<void>;
  joinRoom: (roomName: string) => Promise<void>;
  leaveRoom: (roomName: string) => void;
  sendRoomMessage: (roomName: string, body: string) => Promise<void>;
}

const MucContext = createContext<MucContextType | undefined>(undefined);

export function MucProvider({ children }: { children: ReactNode }) {
  const { client, myUsername, status } = useChatContext();
  
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [joinedRooms, setJoinedRooms] = useState<string[]>([]);
  const [roomMessages, setRoomMessages] = useState<Record<string, RoomMessage[]>>({});
  
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const seenRoomMessageIds = useRef<Set<string>>(new Set());

  // Fetch available rooms from Supabase
  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setAvailableRooms(data);
    }
  };

  useEffect(() => {
    if (!myUsername) return;
    
    fetchRooms();

    const roomsChannel = supabase
      .channel('rooms_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRooms();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(roomsChannel);
    };
  }, [myUsername]);

  // Load message history when joining a room
  const loadRoomHistory = async (roomName: string) => {
    const room = availableRooms.find(r => r.name === roomName);
    if (!room) return;

    const { data, error } = await supabase
      .from('room_messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      const msgs = data.map((m: any) => ({
        id: m.id,
        room_id: m.room_id,
        sender: m.sender,
        body: m.body,
        created_at: new Date(m.created_at),
        type: 'chat'
      })) as RoomMessage[];

      msgs.forEach(m => seenRoomMessageIds.current.add(m.id));
      
      setRoomMessages(prev => ({
        ...prev,
        [roomName]: msgs
      }));
    }
  };

  // Realtime subscription for room_messages
  useEffect(() => {
    if (!myUsername) return;

    const messagesChannel = supabase
      .channel('room_messages_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_messages' }, (payload) => {
        const newMsg = payload.new;
        const room = availableRooms.find(r => r.id === newMsg.room_id);
        
        if (room && joinedRoomsRef.current.has(room.name)) {
           // If we haven't seen it (sent by us vs others)
           if (!seenRoomMessageIds.current.has(newMsg.id)) {
              seenRoomMessageIds.current.add(newMsg.id);
              const formattedMsg: RoomMessage = {
                 id: newMsg.id,
                 room_id: newMsg.room_id,
                 sender: newMsg.sender,
                 body: newMsg.body,
                 created_at: new Date(newMsg.created_at),
                 type: 'chat'
              };
              setRoomMessages(prev => ({
                 ...prev,
                 [room.name]: [...(prev[room.name] || []), formattedMsg]
              }));
           }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [myUsername, availableRooms]);

  // Listen to XMPP events for MUC
  useEffect(() => {
    if (!client || status !== 'Connected') return;

    const handleMucMessage = (msg: ReceivedMessage) => {
      if (msg.type !== 'groupchat' || !msg.body) return;
      
      // msg.from format: roomname@conference.localhost/nickname
      const fromFull = msg.from || '';
      const [roomJid, nickname] = fromFull.split('/');
      const roomName = roomJid.split('@')[0];

      // Ignore delay messages (history from server) if we use Supabase for history
      if ((msg as any).delay) return;

      // Add to local state if not added by Supabase realtime
      // Actually, since we use Supabase for history, we can rely on Supabase for chat messages
      // but XMPP is faster. Let's just use XMPP for real-time delivery to be safe, 
      // but deduplicate.
      
      const msgId = (msg as any).id || `${roomName}:${nickname}:${msg.body}:${Date.now()}`;
      if (seenRoomMessageIds.current.has(msgId)) return;
      
      // Find room id
      const room = availableRooms.find(r => r.name === roomName);
      if (!room) return;

      seenRoomMessageIds.current.add(msgId);
      const newMsg: RoomMessage = {
        id: msgId,
        room_id: room.id,
        sender: nickname,
        body: msg.body as string,
        created_at: new Date(),
        type: 'chat'
      };

      setRoomMessages(prev => ({
        ...prev,
        [roomName]: [...(prev[roomName] || []), newMsg]
      }));
    };

    const handleMucPresence = (presence: any) => {
        const fromFull = presence.from || '';
        const [roomJid, nickname] = fromFull.split('/');
        
        if (!roomJid.includes('@conference.localhost')) return;
        
        const roomName = roomJid.split('@')[0];
        
        // System message for joins/leaves
        const type = presence.type;
        let sysMsgBody = '';
        
        if (!type || type === 'available') {
            // Joined
            // Ignore our own initial join
            if (nickname !== myUsername) {
                sysMsgBody = `${nickname} has entered the room.`;
            }
        } else if (type === 'unavailable') {
            sysMsgBody = `${nickname} has left the room.`;
        }

        if (sysMsgBody) {
            const sysMsg: RoomMessage = {
                id: crypto.randomUUID(),
                room_id: 'sys',
                sender: 'System',
                body: sysMsgBody,
                created_at: new Date(),
                type: 'system'
            };
            setRoomMessages(prev => ({
                ...prev,
                [roomName]: [...(prev[roomName] || []), sysMsg]
            }));
        }
    };

    client.on('message', handleMucMessage);
    client.on('presence', handleMucPresence);

    return () => {
      client.off('message', handleMucMessage);
      client.off('presence', handleMucPresence);
    };
  }, [client, status, myUsername, availableRooms]);

  const createRoom = async (name: string, description: string = '') => {
    if (!myUsername) return;
    
    // Convert to lowercase, no spaces for simplicity
    const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    const { error } = await supabase
      .from('rooms')
      .insert({
        name: cleanName,
        description,
        created_by: myUsername
      });

    if (error) {
      console.error('Failed to create room in Supabase:', error);
      throw error;
    }
  };

  const joinRoom = async (roomName: string) => {
    if (!client || !myUsername) return;
    
    const roomJid = `${roomName}@conference.localhost`;
    
    // Join the MUC via XMPP (send presence)
    (client as any).joinRoom(roomJid, myUsername);
    
    joinedRoomsRef.current.add(roomName);
    setJoinedRooms(Array.from(joinedRoomsRef.current));
    
    await loadRoomHistory(roomName);
  };

  const leaveRoom = (roomName: string) => {
    if (!client || !myUsername) return;
    
    const roomJid = `${roomName}@conference.localhost`;
    (client as any).leaveRoom(roomJid, myUsername);
    
    joinedRoomsRef.current.delete(roomName);
    setJoinedRooms(Array.from(joinedRoomsRef.current));
  };

  const sendRoomMessage = async (roomName: string, body: string) => {
    if (!client || !myUsername || !body.trim()) return;

    const roomJid = `${roomName}@conference.localhost`;
    const room = availableRooms.find(r => r.name === roomName);
    if (!room) return;

    // Send via XMPP
    const msgId = crypto.randomUUID();
    client.sendMessage({
      to: roomJid,
      body,
      type: 'groupchat',
      id: msgId
    });

    // Save to Supabase
    const { error } = await supabase
      .from('room_messages')
      .insert({
        id: msgId,
        room_id: room.id,
        sender: myUsername,
        body
      });

    if (error) {
      console.error('Failed to save room message:', error);
    } else {
        seenRoomMessageIds.current.add(msgId);
        const newMsg: RoomMessage = {
          id: msgId,
          room_id: room.id,
          sender: myUsername,
          body,
          created_at: new Date(),
          type: 'chat'
        };
        setRoomMessages(prev => ({
          ...prev,
          [roomName]: [...(prev[roomName] || []), newMsg]
        }));
    }
  };

  return (
    <MucContext.Provider
      value={{
        availableRooms,
        joinedRooms,
        roomMessages,
        createRoom,
        joinRoom,
        leaveRoom,
        sendRoomMessage
      }}
    >
      {children}
    </MucContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMucContext() {
  const context = useContext(MucContext);
  if (context === undefined) {
    throw new Error('useMucContext must be used within a MucProvider');
  }
  return context;
}
