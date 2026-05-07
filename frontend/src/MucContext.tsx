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
import { useBotContext } from './BotContext';
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
  roomTypingUsers: Record<string, Record<string, number>>; // room name -> {username: timestamp}
  roomActiveUsers: Record<string, string[]>; // room name -> array of nicknames
  roomUnreadCounts: Record<string, number>; // room name -> unread count
  createRoom: (name: string, description?: string) => Promise<void>;
  deleteRoom: (roomId: string, roomName: string) => Promise<void>;
  joinRoom: (roomName: string) => Promise<void>;
  leaveRoom: (roomName: string) => void;
  sendRoomMessage: (roomName: string, body: string) => Promise<void>;
  sendRoomTypingIndicator: (roomName: string, isTyping: boolean) => void;
  deleteRoomMessageForEveryone: (
    roomId: string,
    roomName: string,
    messageId: string
  ) => Promise<void>;
  deleteRoomMessageForMe: (roomName: string, messageId: string) => void;
  clearRoomUnread: (roomName: string) => void;
  setCurrentRoom: (roomName: string | null) => void;
}

const MucContext = createContext<MucContextType | undefined>(undefined);

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for insecure contexts (HTTP)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export function MucProvider({ children }: { children: ReactNode }) {
  const { client, myUsername, status, allUsers } = useChatContext();
  const { applyFilters } = useBotContext();

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
  const [roomTypingUsers, setRoomTypingUsers] = useState<Record<string, Record<string, number>>>({});
  const [roomActiveUsers, setRoomActiveUsers] = useState<Record<string, string[]>>({});
  const [hiddenRoomMessageIds, setHiddenRoomMessageIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('hidden_room_message_ids');
    if (!stored) return new Set();
    try {
      return new Set(JSON.parse(stored));
    } catch {
      return new Set();
    }
  });
  const [roomUnreadCounts, setRoomUnreadCounts] = useState<Record<string, number>>({});
  const currentRoomRef = useRef<string | null>(null);

  const clearRoomUnread = useCallback((roomName: string) => {
    setRoomUnreadCounts((prev) => {
      if (!prev[roomName]) return prev;
      const next = { ...prev };
      delete next[roomName];
      return next;
    });
  }, []);

  const setCurrentRoom = useCallback((roomName: string | null) => {
    currentRoomRef.current = roomName;
    if (roomName) {
      setRoomUnreadCounts((prev) => {
        if (!prev[roomName]) return prev;
        const next = { ...prev };
        delete next[roomName];
        return next;
      });
    }
  }, []);

  const joinedRoomsRef = useRef<Set<string>>(new Set(joinedRooms));
  const seenRoomMessageIds = useRef<Set<string>>(new Set());
  const hasInitiallyJoinedRef = useRef(false);
  const myUsernameRef = useRef(myUsername);
  const myDisplayNameRef = useRef<string>('');
  const recentPresenceKeys = useRef<Map<string, number>>(new Map());

  // Keep myUsernameRef current
  useEffect(() => {
    myUsernameRef.current = myUsername;
  }, [myUsername]);

  // Keep myDisplayNameRef current (MUC nicknames may be display names)
  useEffect(() => {
    const profile = allUsers.find((u) => u.username === myUsername);
    myDisplayNameRef.current = profile?.displayName || '';
  }, [allUsers, myUsername]);

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

    const msgId = generateId();
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

  // Track connection status to detect reconnections
  useEffect(() => {
    if (status === 'Disconnected' || status === 'Error') {
      // Reset flag when disconnected so next connection is treated as reconnect
      hasInitiallyJoinedRef.current = false;
    }
  }, [status]);

  // Rejoin stored rooms on connection (initial load or reconnect)
  useEffect(() => {
    if (!client || status !== 'Connected' || !myUsername) return;
    if (joinedRoomsRef.current.size === 0) {
      hasInitiallyJoinedRef.current = true;
      return;
    }

    // Always rejoin rooms to establish XMPP presence (silent, no system messages)
    joinedRoomsRef.current.forEach((roomName) => {
      sendMucJoin(roomName, myUsername);
      loadRoomHistory(roomName);
    });

    hasInitiallyJoinedRef.current = true;
  }, [client, status, myUsername, loadRoomHistory, sendMucJoin]);

  // Listen to XMPP events for MUC
  useEffect(() => {
    if (!client || status !== 'Connected') return;

    const handleMucMessage = (msg: ReceivedMessage) => {
      if (msg.type !== 'groupchat') return;

      // msg.from format: roomname@conference.localhost/nickname
      const fromFull = msg.from || '';
      const [roomJid, nickname] = fromFull.split('/');
      const roomName = roomJid.split('@')[0];

      // Ignore delay messages (history from server) if we use Supabase for history
      if ((msg as any).delay) return;

      if (
        nickname === myUsernameRef.current ||
        (myDisplayNameRef.current && nickname === myDisplayNameRef.current)
      )
        return;

      // Handle typing indicators (XEP-0085)
      const chatState = (msg as any).chatState;
      if (chatState) {
        if (chatState === 'composing') {
          setRoomTypingUsers((prev) => ({
            ...prev,
            [roomName]: { ...(prev[roomName] || {}), [nickname]: Date.now() },
          }));
        } else {
          setRoomTypingUsers((prev) => {
            const next = { ...prev };
            if (next[roomName]) {
              const roomTypers = { ...next[roomName] };
              delete roomTypers[nickname];
              next[roomName] = roomTypers;
            }
            return next;
          });
        }
      }

      if (!msg.body) return;

      // If the user actually sent a message, they are no longer typing.
      setRoomTypingUsers((prev) => {
        if (!prev[roomName] || !prev[roomName][nickname]) return prev;
        const next = { ...prev };
        const roomTypers = { ...next[roomName] };
        delete roomTypers[nickname];
        if (Object.keys(roomTypers).length === 0) {
          delete next[roomName];
        } else {
          next[roomName] = roomTypers;
        }
        return next;
      });

      // XEP-0308 Replace
      const replaceId = (msg as any).replace?.id || (msg as any).replace;
      if (replaceId) {
        setRoomMessages((prev) => {
          const msgs = prev[roomName] || [];
          return {
            ...prev,
            [roomName]: msgs.map((m) =>
              m.id === replaceId ? { ...m, body: msg.body as string } : m
            ),
          };
        });
        const room = availableRooms.find((r) => r.name === roomName);
        if (room) {
          supabase
            .from('room_messages')
            .update({ body: msg.body as string })
            .eq('id', replaceId)
            .then(({ error }) => {
              if (error) console.error('Failed to sync replaced db message:', error);
            });
        }
        return;
      }

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

      // Increment room unread only if the user is not currently viewing this room
      if (currentRoomRef.current !== roomName) {
        setRoomUnreadCounts((prev) => ({
          ...prev,
          [roomName]: (prev[roomName] || 0) + 1,
        }));
      }

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
      const presenceType = presence.type;

      // Track active users based on presence
      setRoomActiveUsers((prev) => {
        const currentUsers = prev[roomName] || [];
        const isCurrentlyActive = currentUsers.includes(nickname);

        if (presenceType === 'unavailable') {
          // User left - remove from active users
          if (isCurrentlyActive) {
            return {
              ...prev,
              [roomName]: currentUsers.filter((u) => u !== nickname),
            };
          }
        } else {
          // User joined or is available - add to active users
          if (!isCurrentlyActive && nickname !== myUsernameRef.current) {
            return {
              ...prev,
              [roomName]: [...currentUsers, nickname],
            };
          }
        }
        return prev;
      });
    };

    const handleRawIncoming = (xml: any) => {
      if (xml?.is?.('message') && xml.attrs?.type === 'groupchat') {
        const retract = xml
          .getChild('apply-to', 'urn:xmpp:fasten:0')
          ?.getChild('retract', 'urn:xmpp:message-retract:0');
        if (retract) {
          const fromFull = xml.attrs.from || '';
          const [roomJid, nickname] = fromFull.split('/');
          const roomName = roomJid.split('@')[0];
          const targetId = xml.getChild('apply-to', 'urn:xmpp:fasten:0')?.attrs?.id;
          if (
            targetId &&
            roomName &&
            nickname &&
            nickname !== myUsernameRef.current &&
            (!myDisplayNameRef.current || nickname !== myDisplayNameRef.current)
          ) {
            setRoomMessages((prev) => {
              const msgs = prev[roomName] || [];
              return {
                ...prev,
                [roomName]: msgs.map((m) =>
                  m.id === targetId ? { ...m, body: '\u{1F6AB} This message was deleted' } : m
                ),
              };
            });
            // Optional: DB sync, tho sender probably did it
          }
        }
      }
    };

    client.on('message', handleMucMessage);
    client.on('presence', handleMucPresence);
    client.on('raw:incoming', handleRawIncoming);

    return () => {
      client.off('message', handleMucMessage);
      client.off('presence', handleMucPresence);
      client.off('raw:incoming', handleRawIncoming);
    };
  }, [client, status, availableRooms]);

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

    // Clear active users for this room
    setRoomActiveUsers((prev) => {
      const next = { ...prev };
      delete next[roomName];
      return next;
    });

    publishSystemMessage(roomName, myUsername, 'unavailable');
  };

  const sendRoomMessage = async (roomName: string, body: string) => {
    if (!client || !myUsername || !body.trim() || status !== 'Connected') return;

    const roomJid = buildRoomJid(roomName);
    const room = availableRooms.find((r) => r.name === roomName);
    if (!room) return;

    // Apply bot filters before sending (client-side, before XMPP + Supabase)
    const filteredBody = applyFilters(roomName, body);

    // Send via XMPP
    const msgId = generateId();
    client.sendMessage({
      to: roomJid,
      body: filteredBody,
      type: 'groupchat',
      id: msgId,
    });

    // Save to Supabase
    const { error } = await supabase.from('room_messages').insert({
      id: msgId,
      room_id: room.id,
      sender: myUsername,
      body: filteredBody,
    });

    if (error) {
      console.error('Failed to save room message:', error);
    } else {
      seenRoomMessageIds.current.add(msgId);
      const newMsg: RoomMessage = {
        id: msgId,
        room_id: room.id,
        sender: myUsername,
        body: filteredBody,
        created_at: new Date(),
        type: 'chat',
      };
      setRoomMessages((prev) => ({
        ...prev,
        [roomName]: [...(prev[roomName] || []), newMsg],
      }));
    }
  };

  const sendRoomTypingIndicator = (roomName: string, isTyping: boolean) => {
    if (!client || !myUsername || status !== 'Connected') return;
    const roomJid = buildRoomJid(roomName);
    client.sendMessage({
      to: roomJid,
      type: 'groupchat',
      chatState: isTyping ? 'composing' : 'active',
    } as any);
  };

  const deleteRoomMessageForEveryone = async (
    _roomId: string,
    roomName: string,
    messageId: string
  ) => {
    const roomMsgs = roomMessages[roomName] || [];
    const msg = roomMsgs.find((m) => m.id === messageId);
    if (!msg) return;

    if (msg.body.startsWith('http') && msg.body.includes('chat-media')) {
      const parts = msg.body.split('/');
      const fileName = parts[parts.length - 1];
      if (fileName) {
        await supabase.storage.from('chat-media').remove([fileName]);
      }
    }

    const { error } = await supabase
      .from('room_messages')
      .update({ body: '\u{1F6AB} This message was deleted' })
      .eq('id', messageId);

    if (error) {
      console.error('Failed to delete room message:', error);
      return;
    }

    if (client && status === 'Connected') {
      const roomJid = buildRoomJid(roomName);

      // XEP-0308 Replace (LMC)
      client.sendMessage({
        to: roomJid,
        body: '\u{1F6AB} This message was deleted',
        type: 'groupchat',
        replace: { id: messageId },
      } as any);

      // XEP-0424 Retraction
      const retractXml = `<message to="${roomJid}" type="groupchat"><apply-to xmlns="urn:xmpp:fasten:0" id="${messageId}"><retract xmlns="urn:xmpp:message-retract:0"/></apply-to></message>`;
      if ((client as any).send) {
        (client as any).send(retractXml);
      }
    }

    setRoomMessages((prev) => {
      const msgs = prev[roomName] || [];
      return {
        ...prev,
        [roomName]: msgs.map((m) =>
          m.id === messageId ? { ...m, body: '\u{1F6AB} This message was deleted' } : m
        ),
      };
    });
  };

  const deleteRoomMessageForMe = (_roomName: string, messageId: string) => {
    setHiddenRoomMessageIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      localStorage.setItem('hidden_room_message_ids', JSON.stringify([...next]));
      return next;
    });
  };

  // We filter out hidden messages right before returning
  const filteredRoomMessages = Object.fromEntries(
    Object.entries(roomMessages).map(([room, msgs]) => [
      room,
      msgs.filter((m) => !hiddenRoomMessageIds.has(m.id)),
    ])
  );

  // Clean up expired room typing indicators (older than 6 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRoomTypingUsers((prev) => {
        const next: Record<string, Record<string, number>> = {};
        let hasExpired = false;
        for (const [roomName, typers] of Object.entries(prev)) {
          const activeTypers: Record<string, number> = {};
          for (const [user, timestamp] of Object.entries(typers)) {
            if (now - timestamp < 6000) {
              activeTypers[user] = timestamp;
            } else {
              hasExpired = true;
            }
          }
          if (Object.keys(activeTypers).length > 0) {
            next[roomName] = activeTypers;
          }
        }
        return hasExpired ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <MucContext.Provider
      value={{
        availableRooms,
        joinedRooms,
        roomMessages: filteredRoomMessages,
        roomTypingUsers,
        roomActiveUsers,
        roomUnreadCounts,
        createRoom,
        deleteRoom,
        joinRoom,
        leaveRoom,
        sendRoomMessage,
        sendRoomTypingIndicator,
        deleteRoomMessageForEveryone,
        deleteRoomMessageForMe,
        clearRoomUnread,
        setCurrentRoom,
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
