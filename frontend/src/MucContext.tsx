import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useChatContext } from './ChatContext';
import { MUC_DOMAIN, buildRoomJid } from './config';
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
  deleteRoom: (roomId: string, roomName: string) => Promise<void>;
  joinRoom: (roomName: string) => Promise<void>;
  leaveRoom: (roomName: string) => void;
  sendRoomMessage: (roomName: string, body: string) => Promise<void>;
}

const MucContext = createContext<MucContextType | undefined>(undefined);

export function MucProvider({ children }: { children: ReactNode }) {
  const { client, myUsername, status } = useChatContext();

  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [joinedRooms, setJoinedRooms] = useState<string[]>(() => {
    const stored = localStorage.getItem('joined_rooms');
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [roomMessages, setRoomMessages] = useState<Record<string, RoomMessage[]>>({});

  const joinedRoomsRef = useRef<Set<string>>(new Set(joinedRooms));
  const seenRoomMessageIds = useRef<Set<string>>(new Set());
  const recentPresenceKeys = useRef<Map<string, number>>(new Map());

  const publishSystemMessage = async (
    roomName: string,
    nickname: string,
    presenceType: 'available' | 'unavailable'
  ) => {
    let sysMsgBody = '';
    if (presenceType === 'available') {
      sysMsgBody = `${nickname} has entered the room.`;
    } else if (presenceType === 'unavailable') {
      sysMsgBody = `${nickname} has left the room.`;
    }
    if (!sysMsgBody) return;

    const room = availableRooms.find((r) => r.name === roomName);
    if (!room) return;

    const sysKey = `sys:${room.id}:${sysMsgBody}`;
    recentPresenceKeys.current.set(sysKey, Date.now());

    const msgId = crypto.randomUUID();
    seenRoomMessageIds.current.add(msgId);

    const sysMsg: RoomMessage = {
      id: msgId,
      room_id: room.id,
      sender: 'System',
      body: sysMsgBody,
      created_at: new Date(),
      type: 'system',
    };

    setRoomMessages((prev) => ({
      ...prev,
      [roomName]: [...(prev[roomName] || []), sysMsg],
    }));

    const { error } = await supabase.from('room_messages').insert({
      id: msgId,
      room_id: room.id,
      sender: 'System',
      body: sysMsgBody,
    });

    if (error) {
      console.error('Failed to save system message:', error);
    }
  };

  const addSystemMessage = useCallback(
    (roomName: string, nickname: string, presenceType?: string) => {
      if (!joinedRoomsRef.current.has(roomName)) return;
      if (nickname === myUsername) return; // Prevent self-echo on refresh; our own joins are handled explicitly

      let sysMsgBody = '';
      if (!presenceType || presenceType === 'available') {
        sysMsgBody = `${nickname} has entered the room.`;
      } else if (presenceType === 'unavailable') {
        sysMsgBody = `${nickname} has left the room.`;
      }

      if (!sysMsgBody) return;

      const room = availableRooms.find((r) => r.name === roomName);
      const roomId = room ? room.id : 'sys';

      const sysKey = `sys:${roomId}:${sysMsgBody}`;
      const lastSeen = recentPresenceKeys.current.get(sysKey) || 0;
      const now = Date.now();
      if (now - lastSeen < 5000) return;
      recentPresenceKeys.current.set(sysKey, now);

      const sysMsg: RoomMessage = {
        id: crypto.randomUUID(),
        room_id: roomId,
        sender: 'System',
        body: sysMsgBody,
        created_at: new Date(),
        type: 'system',
      };

      setRoomMessages((prev) => ({
        ...prev,
        [roomName]: [...(prev[roomName] || []), sysMsg],
      }));
    },
    [availableRooms, myUsername]
  );

  const persistJoinedRooms = (rooms: Set<string>) => {
    const list = Array.from(rooms);
    joinedRoomsRef.current = new Set(list);
    setJoinedRooms(list);
    localStorage.setItem('joined_rooms', JSON.stringify(list));
  };

  const sendMucJoin = useCallback(
    (roomName: string, nickname: string) => {
      const roomJid = buildRoomJid(roomName);
      const fullJid = `${roomJid}/${nickname}`;
      const anyClient = client as unknown as { joinRoom?: (jid: string, nick: string) => void };

      if (anyClient?.joinRoom) {
        anyClient.joinRoom(roomJid, nickname);
        return;
      }

      client?.sendPresence({ to: fullJid, muc: { type: 'join' } } as any);
    },
    [client]
  );

  const sendMucLeave = useCallback(
    (roomName: string, nickname: string) => {
      const roomJid = buildRoomJid(roomName);
      const fullJid = `${roomJid}/${nickname}`;
      const anyClient = client as unknown as { leaveRoom?: (jid: string, nick: string) => void };

      if (anyClient?.leaveRoom) {
        anyClient.leaveRoom(roomJid, nickname);
        return;
      }

      client?.sendPresence({ to: fullJid, type: 'unavailable' });
    },
    [client]
  );

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
    const pollInterval = setInterval(fetchRooms, 60_000);

    return () => clearInterval(pollInterval);
  }, [myUsername]);

  // Load message history when joining a room
  const loadRoomHistory = useCallback(
    async (roomName: string) => {
      let room = availableRooms.find((r) => r.name === roomName);
      if (!room) {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('name', roomName)
          .single();
        if (error || !data) return;
        room = data as Room;
      }

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
          type: m.sender === 'System' ? 'system' : 'chat',
        })) as RoomMessage[];

        msgs.forEach((m) => seenRoomMessageIds.current.add(m.id));

        setRoomMessages((prev) => {
          const existing = prev[roomName] || [];
          const existingIds = new Set(existing.map((m) => m.id));
          const merged = [...existing];
          msgs.forEach((m) => {
            if (!existingIds.has(m.id)) merged.push(m);
          });
          merged.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

          return {
            ...prev,
            [roomName]: merged,
          };
        });
      }
    },
    [availableRooms]
  );

  // Note: XMPP handles real-time message delivery for MUC (via BOSH/long-polling).
  // Supabase is only used for message history (loadRoomHistory) and persistence.
  // Supabase Realtime is used to avoid refresh for room messages and rooms list.

  useEffect(() => {
    if (!myUsername) return;

    const roomsChannel = supabase
      .channel('rooms_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rooms' }, (payload) => {
        const row = payload.new as Room;
        setAvailableRooms((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms' }, (payload) => {
        const row = payload.new as Room;
        setAvailableRooms((prev) => prev.map((r) => (r.id === row.id ? row : r)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'rooms' }, (payload) => {
        const row = payload.old as Room;
        if (!row?.id) return;
        setAvailableRooms((prev) => prev.filter((r) => r.id !== row.id));
      })
      .subscribe();

    const messagesChannel = supabase
      .channel('room_messages_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_messages' },
        (payload) => {
          const row = payload.new as any;
          if (!row?.id || seenRoomMessageIds.current.has(row.id)) return;

          const room = availableRooms.find((r) => r.id === row.room_id);
          if (!room) return;

          if (row.sender === 'System') {
            const sysKey = `sys:${room.id}:${row.body}`;
            const lastSeen = recentPresenceKeys.current.get(sysKey) || 0;
            if (Date.now() - lastSeen < 5000) return;
            recentPresenceKeys.current.set(sysKey, Date.now());
          }

          seenRoomMessageIds.current.add(row.id);
          const newMsg: RoomMessage = {
            id: row.id,
            room_id: row.room_id,
            sender: row.sender,
            body: row.body,
            created_at: new Date(row.created_at),
            type: row.sender === 'System' ? 'system' : 'chat',
          };
          setRoomMessages((prev) => ({
            ...prev,
            [room.name]: [...(prev[room.name] || []), newMsg],
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [myUsername, availableRooms]);

  // Rejoin stored rooms on reconnect
  useEffect(() => {
    if (!client || status !== 'Connected' || !myUsername) return;
    if (joinedRoomsRef.current.size === 0) return;

    joinedRoomsRef.current.forEach((roomName) => {
      sendMucJoin(roomName, myUsername);
      loadRoomHistory(roomName);
    });
  }, [client, status, myUsername, loadRoomHistory, sendMucJoin]);

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

      if (nickname === myUsername) return;

      // Add to local state if not added by Supabase realtime
      // Actually, since we use Supabase for history, we can rely on Supabase for chat messages
      // but XMPP is faster. Let's just use XMPP for real-time delivery to be safe,
      // but deduplicate.

      const msgId = (msg as any).id || `${roomName}:${nickname}:${msg.body}:${Date.now()}`;
      if (seenRoomMessageIds.current.has(msgId)) return;

      // Find room id
      const room = availableRooms.find((r) => r.name === roomName);
      if (!room) return;

      seenRoomMessageIds.current.add(msgId);
      const newMsg: RoomMessage = {
        id: msgId,
        room_id: room.id,
        sender: nickname,
        body: msg.body as string,
        created_at: new Date(),
        type: 'chat',
      };

      setRoomMessages((prev) => ({
        ...prev,
        [roomName]: [...(prev[roomName] || []), newMsg],
      }));
    };

    const handleMucPresence = (presence: any) => {
      const fromFull = presence.from || '';
      const parts = fromFull.split('/');
      const roomJid = parts[0];
      const nickname = parts[1];

      if (!roomJid || !roomJid.includes(`@${MUC_DOMAIN}`)) return;
      if (!nickname) return; // ignore bare JID presences (e.g. error stanzas)

      const roomName = roomJid.split('@')[0];
      addSystemMessage(roomName, nickname, presence.type);
    };

    const handleMucJoin = (presence: any) => {
      const fromFull = presence.from || '';
      const parts = fromFull.split('/');
      const roomJid = parts[0];
      const nickname = parts[1];
      if (!roomJid || !nickname) return;
      const roomName = roomJid.split('@')[0];
      addSystemMessage(roomName, nickname, 'available');
    };

    const handleMucLeave = (presence: any) => {
      const fromFull = presence.from || '';
      const parts = fromFull.split('/');
      const roomJid = parts[0];
      const nickname = parts[1];
      if (!roomJid || !nickname) return;
      const roomName = roomJid.split('@')[0];
      addSystemMessage(roomName, nickname, 'unavailable');
    };

    const handleMucAvailable = (presence: any) => {
      const fromFull = presence.from || '';
      const parts = fromFull.split('/');
      const roomJid = parts[0];
      const nickname = parts[1];
      if (!roomJid || !nickname) return;
      const roomName = roomJid.split('@')[0];
      addSystemMessage(roomName, nickname, 'available');
    };

    const handleMucUnavailable = (presence: any) => {
      const fromFull = presence.from || '';
      const parts = fromFull.split('/');
      const roomJid = parts[0];
      const nickname = parts[1];
      if (!roomJid || !nickname) return;
      const roomName = roomJid.split('@')[0];
      addSystemMessage(roomName, nickname, 'unavailable');
    };

    client.on('message', handleMucMessage);
    client.on('presence', handleMucPresence);
    client.on('muc:join', handleMucJoin);
    client.on('muc:leave', handleMucLeave);
    client.on('muc:available', handleMucAvailable);
    client.on('muc:unavailable', handleMucUnavailable);

    return () => {
      client.off('message', handleMucMessage);
      client.off('presence', handleMucPresence);
      client.off('muc:join', handleMucJoin);
      client.off('muc:leave', handleMucLeave);
      client.off('muc:available', handleMucAvailable);
      client.off('muc:unavailable', handleMucUnavailable);
    };
  }, [client, status, myUsername, availableRooms, addSystemMessage]);

  const createRoom = async (name: string, description: string = '') => {
    if (!myUsername) return;

    // Convert to lowercase, no spaces for simplicity
    const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const { error } = await supabase.from('rooms').insert({
      name: cleanName,
      description,
      created_by: myUsername,
    });

    if (error) {
      console.error('Failed to create room in Supabase:', error);
      throw error;
    }
  };

  const deleteRoom = async (roomId: string, roomName: string) => {
    if (!myUsername) return;

    // Leave the XMPP room first if we are currently in it
    if (joinedRoomsRef.current.has(roomName) && client && status === 'Connected') {
      const roomJid = buildRoomJid(roomName);
      const fullJid = `${roomJid}/${myUsername}`;
      client.sendPresence({ to: fullJid, type: 'unavailable' });
      const nextRooms = new Set(joinedRoomsRef.current);
      nextRooms.delete(roomName);
      persistJoinedRooms(nextRooms);
    }

    // Delete from Supabase (cascades to room_messages)
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId)
      .eq('created_by', myUsername); // extra safety: only own rooms

    if (error) {
      console.error('Failed to delete room:', error);
      throw error;
    }
  };

  const joinRoom = async (roomName: string) => {
    console.log(`[MUC] Attempting to join room: ${roomName}, XMPP status: ${status}`);
    if (!client) {
      console.error('[MUC] Cannot join: client is null');
      return;
    }
    if (!myUsername) {
      console.error('[MUC] Cannot join: myUsername is empty');
      return;
    }
    if (status !== 'Connected') {
      console.error(`[MUC] Cannot join: XMPP not connected (status: ${status})`);
      return;
    }

    try {
      // Join the MUC via XMPP (send presence)
      sendMucJoin(roomName, myUsername);

      console.log(`[MUC] Presence sent. Updating local state.`);
      const nextRooms = new Set(joinedRoomsRef.current);
      nextRooms.add(roomName);
      persistJoinedRooms(nextRooms);

      await publishSystemMessage(roomName, myUsername, 'available');

      console.log(`[MUC] Loading room history from Supabase...`);
      await loadRoomHistory(roomName);
      console.log(`[MUC] Join process complete for ${roomName}`);
    } catch (err) {
      console.error('[MUC] Error during joinRoom:', err);
    }
  };

  const leaveRoom = (roomName: string) => {
    console.log(`[MUC] Attempting to leave room: ${roomName}`);
    if (!client || !myUsername) return;

    // Leave the MUC via XMPP
    sendMucLeave(roomName, myUsername);

    const nextRooms = new Set(joinedRoomsRef.current);
    nextRooms.delete(roomName);
    persistJoinedRooms(nextRooms);

    publishSystemMessage(roomName, myUsername, 'unavailable');
  };

  const sendRoomMessage = async (roomName: string, body: string) => {
    if (!client || !myUsername || !body.trim() || status !== 'Connected') return;

    const roomJid = buildRoomJid(roomName);
    const room = availableRooms.find((r) => r.name === roomName);
    if (!room) return;

    // Send via XMPP
    const msgId = crypto.randomUUID();
    client.sendMessage({
      to: roomJid,
      body,
      type: 'groupchat',
      id: msgId,
    });

    // Save to Supabase
    const { error } = await supabase.from('room_messages').insert({
      id: msgId,
      room_id: room.id,
      sender: myUsername,
      body,
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
        type: 'chat',
      };
      setRoomMessages((prev) => ({
        ...prev,
        [roomName]: [...(prev[roomName] || []), newMsg],
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
        deleteRoom,
        joinRoom,
        leaveRoom,
        sendRoomMessage,
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
