import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import * as stanza from 'stanza';
import { Client } from 'stanza';
import type { ReceivedMessage } from 'stanza/protocol';
import { XMPP_DOMAIN, buildApiUrl, buildBareJid } from './config';
import { supabase } from './supabase';

const makeMessageKey = (sender: string, receiver: string, body: string) =>
  `${sender}::${receiver}::${body}`;

export interface ChatMessage {
  id: string;
  from: string;
  body: string;
  type: 'sent' | 'received';
  time: Date;
  otherParty: string;
}

export interface RegisteredUser {
  username: string;
  online: boolean;
}

export interface Friendship {
  id: string;
  requester: string;
  receiver: string;
  status: 'pending' | 'accepted';
}

interface ChatContextType {
  client: Client | null;
  status: string;
  jid: string;
  messages: ChatMessage[];
  allUsers: RegisteredUser[];
  friendships: Friendship[];
  myUsername: string;
  sendMessage: (recipient: string, body: string) => Promise<void>;
  sendFriendRequest: (targetUsername: string) => Promise<void>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  removeFriendship: (friendshipId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, password } = useAuth();
  const [status, setStatus] = useState<string>('Connecting...');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allUsers, setAllUsers] = useState<RegisteredUser[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [jid, setJid] = useState(() => {
    const stored = localStorage.getItem('xmpp_jid');
    return stored || '';
  });
  const jidRef = useRef(jid);
  const seenIds = useRef(new Set<string>());
  const seenMessageKeys = useRef(new Set<string>());
  const [clientInstance, setClientInstance] = useState<Client | null>(null);
  const clientRef = useRef<Client | null>(null);

  const myUsername = user?.email?.split('@')[0] || '';

  const upsertMessageFromDb = useCallback(
    (row: any) => {
      if (!row) return;
      if (!row.id || seenIds.current.has(row.id)) return;

      const msgKey = makeMessageKey(row.sender, row.receiver, row.body);
      if (seenMessageKeys.current.has(msgKey)) return;

      const isSent = row.sender === myUsername;
      const mapped: ChatMessage = {
        id: row.id,
        from: isSent ? 'You' : row.sender,
        body: row.body,
        type: isSent ? 'sent' : 'received',
        time: new Date(row.created_at),
        otherParty: isSent ? row.receiver : row.sender,
      };

      seenIds.current.add(mapped.id);
      seenMessageKeys.current.add(msgKey);
      setMessages((prev) => [...prev, mapped]);
    },
    [myUsername]
  );

  useEffect(() => {
    localStorage.setItem('xmpp_jid', jid);
    jidRef.current = jid;
  }, [jid]);

  // ── XMPP Connection ──
  useEffect(() => {
    if (!user || !password) return;

    const username = user.email?.split('@')[0] || '';
    const fullJid = buildBareJid(username);
    jidRef.current = fullJid;
    setJid(fullJid);
    setStatus('Connecting...');

    const boshUrl = `${window.location.origin}/http-bind`;

    const client = stanza.createClient({
      jid: fullJid,
      password: password,
      server: XMPP_DOMAIN,
      transports: {
        bosh: boshUrl,
      },
      useStreamManagement: false,
    }) as unknown as Client;

    clientRef.current = client;
    setClientInstance(client);

    const handleBeforeUnload = () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const addMessage = (from: string, body: string, msgId: string) => {
      const myUser = jidRef.current.split('@')[0];
      if (from === myUser) return;
      if (seenIds.current.has(msgId)) return;
      const msgKey = makeMessageKey(from, myUser, body);
      if (seenMessageKeys.current.has(msgKey)) return;
      seenIds.current.add(msgId);
      seenMessageKeys.current.add(msgKey);
      setMessages((prev) => [
        ...prev,
        {
          id: msgId,
          from,
          body,
          type: 'received',
          time: new Date(),
          otherParty: from,
        },
      ]);
    };

    const handleConnected = () => {
      setStatus('Connected');
    };

    const handleSessionStarted = () => {
      setStatus('Connected');
      client.sendPresence({});
    };

    const handleDisconnected = () => {
      setStatus('Disconnected');
    };

    const handleError = (err: Error) => {
      console.error('XMPP Error:', err);
      setStatus('Error: ' + (err.message || 'Connection failed'));
    };

    const handlePresence = (presence: any) => {
      const fromFull = presence.from || '';
      if (!fromFull) return;

      const bareJid = fromFull.split('/')[0];
      const myBareJid = jidRef.current.split('/')[0];

      if (bareJid === myBareJid) return;

      const from = bareJid.split('@')[0];
      const type = presence.type;

      if (type === 'subscribe') {
        client.sendPresence({ type: 'subscribed', to: fromFull });
        client.sendPresence({ type: 'subscribe', to: fromFull });
        return;
      }

      if (
        type === 'subscribed' ||
        type === 'unsubscribed' ||
        type === 'unsubscribe' ||
        type === 'error' ||
        type === 'probe'
      ) {
        return;
      }

      const isOnline = !type || ['available', 'chat', 'dnd', 'away', 'xa'].includes(type);

      setAllUsers((prev) =>
        prev.map((u) => (u.username === from ? { ...u, online: isOnline } : u))
      );
    };

    const handleMessage = (msg: ReceivedMessage) => {
      if (msg.type !== 'chat') return;
      if (!msg.body) return;
      const fromFull = msg.from || '';
      const from = fromFull.split('@')[0] || 'Unknown';
      const msgId = (msg as any).id || `${from}:${msg.body}`;
      addMessage(from, msg.body as string, msgId);
    };

    const handleRawIncoming = (data: unknown) => {
      const str = String(data);

      if (str.includes('urn:ietf:params:xml:ns:xmpp-bind') && str.includes("type='result'")) {
        client.sendPresence({});
      }

      const msgRegex = /<message\b[^>]*>/g;
      let tagMatch;
      while ((tagMatch = msgRegex.exec(str)) !== null) {
        const tagStart = tagMatch.index;
        const closeIdx = str.indexOf('</message>', tagStart);
        if (closeIdx === -1) continue;

        const msgXml = str.slice(tagStart, closeIdx + '</message>'.length);
        if (msgXml.includes('type="error"')) continue;
        if (!msgXml.includes('type="chat"')) continue;

        const bodyMatch = msgXml.match(/<body[^>]*>([^<]*)<\/body>/);
        const fromMatch = msgXml.match(/\bfrom="([^"]+)"/);
        const idMatch = msgXml.match(/(?:^|[\s<])<message[^>]+\bid="([^"]+)"/);
        const idFallback = msgXml.match(/\bid="([^"]+)"/);

        if (!bodyMatch || !fromMatch) continue;

        const from = fromMatch[1].split('@')[0];
        const body = bodyMatch[1];
        const msgId = (idMatch?.[1] ?? idFallback?.[1]) || `${from}:${body}`;

        addMessage(from, body, msgId);
      }
    };

    client.on('connected', handleConnected);
    client.on('session:started', handleSessionStarted);
    client.on('disconnected', handleDisconnected);
    client.on('error', handleError);
    client.on('message', handleMessage);
    client.on('presence', handlePresence);
    client.on('raw:incoming', handleRawIncoming);

    client.connect().catch((err) => {
      console.error('Connect error:', err);
      setStatus('Error: ' + err.message);
    });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      client.off('connected', handleConnected);
      client.off('session:started', handleSessionStarted);
      client.off('disconnected', handleDisconnected);
      client.off('error', handleError);
      client.off('message', handleMessage);
      client.off('presence', handlePresence);
      client.off('raw:incoming', handleRawIncoming);
      client.disconnect();
    };
  }, [user, password]);

  // ── Fetch users + friendships ──
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(buildApiUrl('/api/users'));
        const data = await res.json();
        setAllUsers(data.map((u: any) => ({ username: u.username, online: false })));
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };

    const fetchFriendships = async () => {
      if (!myUsername) return;

      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester.eq.${myUsername},receiver.eq.${myUsername}`);

      if (!error && data) {
        setFriendships(data);
      }
    };

    fetchUsers();
    fetchFriendships();

    const channel = supabase
      .channel('friendships_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        fetchFriendships();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, myUsername]);

  // ── Fetch message history ──
  useEffect(() => {
    const fetchMessages = async () => {
      if (!myUsername) return;

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender.eq.${myUsername},receiver.eq.${myUsername}`)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const loaded: ChatMessage[] = data.map((m: any) => {
          const isSent = m.sender === myUsername;
          return {
            id: m.id,
            from: isSent ? 'You' : m.sender,
            body: m.body,
            type: isSent ? 'sent' : 'received',
            time: new Date(m.created_at),
            otherParty: isSent ? m.receiver : m.sender,
          } as ChatMessage;
        });
        loaded.forEach((m) => seenIds.current.add(m.id));
        setMessages(loaded);
      }
    };
    fetchMessages();
  }, [user, myUsername]);

  // ── Realtime updates for direct messages ──
  useEffect(() => {
    if (!myUsername) return;

    const channel = supabase
      .channel(`messages_realtime:${myUsername}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver=eq.${myUsername}`,
        },
        (payload) => {
          upsertMessageFromDb(payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender=eq.${myUsername}` },
        (payload) => {
          upsertMessageFromDb(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myUsername, upsertMessageFromDb]);

  // ── Auto-subscribe and send directed presence to friends ──
  useEffect(() => {
    if (status === 'Connected' && clientRef.current && myUsername) {
      friendships.forEach((f) => {
        if (f.status === 'accepted') {
          const friendUsername = f.requester === myUsername ? f.receiver : f.requester;
          const friendJid = buildBareJid(friendUsername);

          // Subscribe to their presence in XMPP roster
          clientRef.current?.sendPresence({ type: 'subscribe', to: friendJid });
          // Auto-accept their subscription just in case
          clientRef.current?.sendPresence({ type: 'subscribed', to: friendJid });

          // Force a directed presence update to them immediately
          // so they know we're online even before the roster syncs
          clientRef.current?.sendPresence({ to: friendJid });
        }
      });
    }
  }, [friendships, status, myUsername]);

  // ── Actions ──
  const sendMessage = async (recipient: string, body: string) => {
    if (!body.trim() || !clientRef.current || !recipient) return;

    const recipientUsername = recipient.trim();
    let finalRecipient = recipientUsername;
    if (!finalRecipient.includes('@')) {
      finalRecipient = buildBareJid(finalRecipient);
    }

    clientRef.current.sendMessage({
      to: finalRecipient,
      body,
      type: 'chat' as const,
    });

    const msgId = crypto.randomUUID();
    const msgKey = makeMessageKey(myUsername, recipientUsername, body);
    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        from: 'You',
        body,
        type: 'sent',
        time: new Date(),
        otherParty: recipientUsername,
      },
    ]);
    seenIds.current.add(msgId);
    seenMessageKeys.current.add(msgKey);

    const { error } = await supabase
      .from('messages')
      .insert({ sender: myUsername, receiver: recipientUsername, body });

    if (error) console.error('Failed to persist message:', error);
  };

  const sendFriendRequest = async (targetUsername: string) => {
    if (!myUsername) return;

    const { data, error } = await supabase
      .from('friendships')
      .insert({
        requester: myUsername,
        receiver: targetUsername,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to send friend request:', error);
    } else if (data) {
      setFriendships((prev) => [...prev, data]);
    }
  };

  const acceptFriendRequest = async (friendshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);

    if (error) {
      console.error('Failed to accept friend request:', error);
    } else {
      setFriendships((prev) =>
        prev.map((f) => (f.id === friendshipId ? { ...f, status: 'accepted' } : f))
      );
    }
  };

  const removeFriendship = async (friendshipId: string) => {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);

    if (error) {
      console.error('Failed to remove friend:', error);
    } else {
      setFriendships((prev) => prev.filter((f) => f.id !== friendshipId));
    }
  };

  return (
    <ChatContext.Provider
      value={{
        client: clientInstance,
        status,
        jid,
        messages,
        allUsers,
        friendships,
        myUsername,
        sendMessage,
        sendFriendRequest,
        acceptFriendRequest,
        removeFriendship,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
