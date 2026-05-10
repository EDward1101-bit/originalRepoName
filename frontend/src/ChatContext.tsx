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
import { createClient, type Agent } from 'stanza';
import type { ReceivedMessage } from 'stanza/protocol';
import { XMPP_DOMAIN, buildBareJid } from './config';
import { supabase } from './supabase';

const makeMessageKey = (sender: string, receiver: string, body: string) =>
  `${sender}::${receiver}::${body}`;

export interface ChatMessage {
  id: string;
  from: string;
  body: string;
  type: 'sent' | 'received';
  time: Date;
  otherParty: string; // stable XMPP username (email prefix), used for URL routing
}

export interface RegisteredUser {
  id: string;           // UUID — source of truth for DB relationships
  username: string;     // display name (changeable, non-unique)
  xmppUsername: string; // stable XMPP login = email.split('@')[0], never changes
  online: boolean;
  avatarUrl?: string;
  displayName?: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted';
}

interface ChatContextType {
  client: Agent | null;
  status: string;
  jid: string;
  messages: ChatMessage[];
  allUsers: RegisteredUser[];
  getUserProfile: (xmppUsername: string) => RegisteredUser | undefined;
  friendships: Friendship[];
  myUsername: string;  // stable XMPP username (email prefix)
  myUserId: string;    // UUID for DB operations
  sendMessage: (recipientXmpp: string, body: string) => Promise<void>;
  sendFriendRequest: (targetUserId: string) => Promise<void>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  removeFriendship: (friendshipId: string) => Promise<void>;
  deleteMessageForEveryone: (messageId: string) => Promise<void>;
  deleteMessageForMe: (messageId: string) => void;
  editMessage: (messageId: string, newBody: string) => Promise<void>;
  typingUsers: Record<string, number>;
  sendTypingIndicator: (recipient: string, isTyping: boolean) => void;
  unreadCounts: Record<string, number>;
  clearUnread: (chatId: string) => void;
  setCurrentChat: (chatId: string | null) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

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

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, password } = useAuth();
  const [status, setStatus] = useState<string>('Connecting...');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allUsers, setAllUsers] = useState<RegisteredUser[]>([]);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('hidden_message_ids');
    if (!stored) return new Set();
    try {
      return new Set(JSON.parse(stored));
    } catch {
      return new Set();
    }
  });
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [jid, setJid] = useState(() => {
    const stored = localStorage.getItem('xmpp_jid');
    return stored || '';
  });
  const jidRef = useRef(jid);
  const seenIds = useRef(new Set<string>());
  const seenMessageKeys = useRef(new Set<string>());
  const [clientInstance, setClientInstance] = useState<Agent | null>(null);
  const clientRef = useRef<Agent | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const currentChatRef = useRef<string | null>(null);
  const [_currentChat, _setCurrentChat] = useState<string | null>(null);

  const setCurrentChat = useCallback((chatId: string | null) => {
    currentChatRef.current = chatId;
    _setCurrentChat(chatId);
    // Immediately clear unread for the chat being opened
    if (chatId) {
      setUnreadCounts((prev) => {
        if (!prev[chatId]) return prev;
        const next = { ...prev };
        delete next[chatId];
        return next;
      });
    }
  }, []);

  // Stable XMPP login ID derived from the immutable Supabase Auth email.
  // This is what Prosody knows the user as and what JIDs are built from.
  const myUsername = user?.email?.split('@')[0] || '';
  // UUID from Supabase Auth — used as the source of truth for all DB FK relationships.
  const myUserId = user?.id || '';

  // Refs so stable callbacks (upsertMessageFromDb) can read current values
  // without being recreated on every render.
  const allUsersRef = useRef<RegisteredUser[]>([]);
  const myUserIdRef = useRef(myUserId);

  useEffect(() => { allUsersRef.current = allUsers; }, [allUsers]);
  useEffect(() => { myUserIdRef.current = myUserId; }, [myUserId]);

  const upsertMessageFromDb = useCallback(
    (row: any) => {
      if (!row) return;
      if (!row.id || seenIds.current.has(row.id)) return;

      const users = allUsersRef.current;
      const senderUser = users.find((u) => u.id === row.sender_id);
      const receiverUser = users.find((u) => u.id === row.receiver_id);
      const senderXmpp = senderUser?.xmppUsername ?? '';
      const receiverXmpp = receiverUser?.xmppUsername ?? '';

      // Can't route the message without knowing who sent/received it
      if (!senderXmpp || !receiverXmpp) return;

      const isSent = row.sender_id === myUserIdRef.current;
      const msgKey = makeMessageKey(senderXmpp, receiverXmpp, row.body);
      if (seenMessageKeys.current.has(msgKey)) return;

      const mapped: ChatMessage = {
        id: row.id,
        from: isSent ? 'You' : senderXmpp,
        body: row.body,
        type: isSent ? 'sent' : 'received',
        time: new Date(row.created_at),
        otherParty: isSent ? receiverXmpp : senderXmpp,
      };

      seenIds.current.add(mapped.id);
      seenMessageKeys.current.add(msgKey);
      setMessages((prev) => [...prev, mapped]);
    },
    [] // uses only refs — intentionally stable
  );

  useEffect(() => {
    localStorage.setItem('xmpp_jid', jid);
    jidRef.current = jid;
  }, [jid]);

  // Clean up expired typing indicators (older than 6 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        const next: Record<string, number> = {};
        let hasExpired = false;
        for (const [user, timestamp] of Object.entries(prev)) {
          if (now - timestamp < 6000) {
            next[user] = timestamp;
          } else {
            hasExpired = true;
          }
        }
        return hasExpired ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ── XMPP Connection ──
  useEffect(() => {
    if (!user || !password) return;

    // Always derive the XMPP username from the stable auth email, never from
    // users.username which can change.
    const username = user.email?.split('@')[0] || '';
    const fullJid = buildBareJid(username);
    jidRef.current = fullJid;
    setJid(fullJid);
    setStatus('Connecting...');

    const boshUrl = `${window.location.origin}/http-bind`;

    console.log('[XMPP] Initializing client for:', fullJid);
    let client: Agent | null = null;
    try {
      client = createClient({
        jid: fullJid,
        password: password,
        server: XMPP_DOMAIN,
        transports: {
          bosh: boshUrl,
        },
        useStreamManagement: false,
      });
    } catch (err) {
      console.error('[XMPP] Failed to create client:', err);
      setStatus('Error: Failed to initialize XMPP client');
      return;
    }

    if (!client) {
      console.error('[XMPP] createClient returned null');
      setStatus('Error: XMPP client is null');
      return;
    }

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
        prev.map((u) => (u.xmppUsername === from ? { ...u, online: isOnline } : u))
      );
    };

    const handleMessage = (msg: ReceivedMessage) => {
      const fromFull = msg.from || '';
      const from = fromFull.split('@')[0] || 'Unknown';
      const myUser = jidRef.current.split('@')[0];

      // Handle typing indicators (XEP-0085)
      if ((msg as any).chatState && from !== myUser) {
        if ((msg as any).chatState === 'composing') {
          setTypingUsers((prev) => ({ ...prev, [from]: Date.now() }));
        } else {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[from];
            return next;
          });
        }
      }

      if (msg.type !== 'chat' && msg.type !== 'groupchat') return;
      if (!msg.body) return;

      // Clear typing indicator when a message is actually received
      if (from !== myUser) {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[from];
          return next;
        });
      }
      const msgId = (msg as any).id || `${from}:${msg.body}`;

      // Increment unread count only for DMs from others, and only if
      // the user is not currently viewing that conversation.
      const isDm = msg.type === 'chat';
      if (isDm && from !== myUser && !seenIds.current.has(msgId) && currentChatRef.current !== from) {
        setUnreadCounts((prev) => ({
          ...prev,
          [from]: (prev[from] || 0) + 1,
        }));
      }

      if (msg.type === 'chat') {
        addMessage(from, msg.body as string, msgId);
      }
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
        if (!msgXml.includes('type="chat"') && !msgXml.includes('type="groupchat"')) continue;

        const bodyMatch = msgXml.match(/<body[^>]*>([^<]*)<\/body>/);
        const fromMatch = msgXml.match(/\bfrom="([^"]+)"/);
        const idMatch = msgXml.match(/(?:^|[\s<])<message[^>]+\bid="([^"]+)"/);
        const idFallback = msgXml.match(/\bid="([^"]+)"/);

        if (!bodyMatch || !fromMatch) continue;

        const fromFull = fromMatch[1];
        const from = fromFull.split('@')[0];
        const body = bodyMatch[1];
        const msgId = (idMatch?.[1] ?? idFallback?.[1]) || `${from}:${body}`;

        // Note: unread counting is handled exclusively in handleMessage to avoid
        // double-counting (handleRawIncoming is a fallback for message delivery only).

        if (msgXml.includes('type="chat"')) {
          addMessage(from, body, msgId);
        }
      }
    };

    client.on('connected', handleConnected);
    client.on('session:started', handleSessionStarted);
    client.on('disconnected', handleDisconnected);
    // @ts-expect-error stanza client types don't include 'error' in AgentEvents
    client.on('error', handleError);
    client.on('message', handleMessage);
    client.on('presence', handlePresence);
    client.on('raw:incoming', handleRawIncoming);

    try {
      client.connect();
    } catch (err: any) {
      console.error('Connect error:', err);
      setStatus('Error: ' + err.message);
    }

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
        const { data, error } = await supabase
          .from('users')
          .select('id, username, email, avatar_url');

        if (error) throw error;

        setAllUsers((prev) =>
          data.map((u: any) => {
            const xmppUsername = u.email?.split('@')[0] || u.username;
            const existing = prev.find((p) => p.id === u.id || p.xmppUsername === xmppUsername);
            return {
              id: u.id,
              username: u.username,
              // Derive the stable XMPP login name from the stored email.
              // This matches the Prosody account created at registration.
              xmppUsername,
              displayName: u.username,
              avatarUrl: u.avatar_url,
              online: existing?.online ?? false,
            };
          })
        );
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };

    const fetchFriendships = async () => {
      if (!myUserId) return;

      const { data, error } = await supabase
        .from('friendships')
        .select('id, requester_id, receiver_id, status')
        .or(`requester_id.eq.${myUserId},receiver_id.eq.${myUserId}`);

      if (!error && data) {
        setFriendships(
          data.map((f: any) => ({
            id: f.id,
            requester_id: f.requester_id,
            receiver_id: f.receiver_id,
            status: f.status,
          }))
        );
      }
    };

    fetchUsers();
    fetchFriendships();

    // Subscribe to changes (one channel for both users and friendships)
    const realtimeChannel = supabase
      .channel(`chat_realtime_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchUsers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        fetchFriendships();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [user, myUserId]);

  // ── Fetch message history ──
  useEffect(() => {
    const fetchMessages = async () => {
      if (!myUserId) return;

      const { data, error } = await supabase
        .from('messages')
        .select(
          'id, sender_id, receiver_id, body, created_at, sender_user:users!sender_id(email), receiver_user:users!receiver_id(email)'
        )
        .or(`sender_id.eq.${myUserId},receiver_id.eq.${myUserId}`)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const loaded: ChatMessage[] = data.map((m: any) => {
          const isSent = m.sender_id === myUserId;
          const senderXmpp = m.sender_user?.email?.split('@')[0] ?? '';
          const receiverXmpp = m.receiver_user?.email?.split('@')[0] ?? '';
          return {
            id: m.id,
            from: isSent ? 'You' : senderXmpp,
            body: m.body,
            type: isSent ? 'sent' : 'received',
            time: new Date(m.created_at),
            otherParty: isSent ? receiverXmpp : senderXmpp,
          } as ChatMessage;
        });
        loaded.forEach((m) => seenIds.current.add(m.id));
        setMessages(loaded);
      }
    };
    fetchMessages();
  }, [user, myUserId]);

  // ── Realtime updates for direct messages ──
  useEffect(() => {
    if (!myUserId) return;

    const channel = supabase
      .channel(`messages_realtime:${myUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const row = payload.new;
          if (row.sender_id === myUserId || row.receiver_id === myUserId) {
            upsertMessageFromDb(row);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myUserId, upsertMessageFromDb]);

  // ── Auto-subscribe and send directed presence to friends ──
  useEffect(() => {
    if (status === 'Connected' && clientRef.current && myUsername) {
      friendships.forEach((f) => {
        if (f.status === 'accepted') {
          const friendId = f.requester_id === myUserId ? f.receiver_id : f.requester_id;
          const friendUser = allUsersRef.current.find((u) => u.id === friendId);
          if (!friendUser) return;

          const friendJid = buildBareJid(friendUser.xmppUsername);
          clientRef.current?.sendPresence({ type: 'subscribe', to: friendJid });
          clientRef.current?.sendPresence({ type: 'subscribed', to: friendJid });
          clientRef.current?.sendPresence({ to: friendJid });
        }
      });
    }
  }, [friendships, status, myUsername, myUserId]);

  // ── Actions ──
  const sendMessage = async (recipientXmpp: string, body: string) => {
    if (!body.trim() || !clientRef.current || !recipientXmpp) return;

    // Look up the recipient's UUID so we can store it in the DB
    const recipientUser = allUsers.find((u) => u.xmppUsername === recipientXmpp);
    if (!recipientUser) {
      console.error('Cannot send message: recipient not found in user list');
      return;
    }

    let finalRecipient = recipientXmpp;
    if (!finalRecipient.includes('@')) {
      finalRecipient = buildBareJid(finalRecipient);
    }

    clientRef.current.sendMessage({
      to: finalRecipient,
      body,
      type: 'chat' as const,
    });

    const msgId = generateId();
    const msgKey = makeMessageKey(myUsername, recipientXmpp, body);
    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        from: 'You',
        body,
        type: 'sent',
        time: new Date(),
        otherParty: recipientXmpp,
      },
    ]);
    seenIds.current.add(msgId);
    seenMessageKeys.current.add(msgKey);

    const { error } = await supabase
      .from('messages')
      .insert({ sender_id: myUserId, receiver_id: recipientUser.id, body });

    if (error) console.error('Failed to persist message:', error);
  };

  const deleteMessageForEveryone = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    // If it's a media URL, delete the file from storage
    if (msg.body.startsWith('http') && msg.body.includes('chat-media')) {
      const parts = msg.body.split('/');
      const fileName = parts[parts.length - 1];
      if (fileName) {
        await supabase.storage.from('chat-media').remove([fileName]);
      }
    }

    // Update message body in DB
    const { error } = await supabase
      .from('messages')
      .update({ body: '\u{1F6AB} This message was deleted' })
      .eq('id', messageId);

    if (error) {
      console.error('Failed to delete message:', error);
      return;
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, body: '\u{1F6AB} This message was deleted' } : m
      )
    );
  };

  const deleteMessageForMe = (messageId: string) => {
    setHiddenMessageIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      localStorage.setItem('hidden_message_ids', JSON.stringify([...next]));
      return next;
    });
  };

  const editMessage = async (messageId: string, newBody: string) => {
    if (!newBody.trim()) return;

    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    // Check 15-minute window
    const diffMs = Date.now() - msg.time.getTime();
    if (diffMs > 15 * 60 * 1000) {
      alert('You can only edit messages within 15 minutes of sending.');
      return;
    }

    const editedBody = newBody.trim();
    const { error } = await supabase
      .from('messages')
      .update({ body: editedBody })
      .eq('id', messageId);

    if (error) {
      console.error('Failed to edit message:', error);
      return;
    }

    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, body: editedBody } : m)));
  };

  const sendFriendRequest = async (targetUserId: string) => {
    if (!myUserId) return;
    if (targetUserId === myUserId) {
      console.error('Cannot send friend request to yourself');
      return;
    }

    const { data, error } = await supabase
      .from('friendships')
      .insert({
        requester_id: myUserId,
        receiver_id: targetUserId,
        status: 'pending',
      })
      .select('id, requester_id, receiver_id, status')
      .single();

    if (error) {
      console.error('Failed to send friend request:', error);
    } else if (data) {
      setFriendships((prev) => [
        ...prev,
        {
          id: data.id,
          requester_id: data.requester_id,
          receiver_id: data.receiver_id,
          status: data.status,
        },
      ]);
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

  // Look up a user profile by their stable XMPP username (the URL routing key)
  const getUserProfile = useCallback(
    (xmppUsername: string) => {
      return allUsers.find((u) => u.xmppUsername === xmppUsername);
    },
    [allUsers]
  );

  const sendTypingIndicator = useCallback(
    (recipient: string, isTyping: boolean) => {
      if (!clientInstance) return;
      clientInstance.sendMessage({
        to: buildBareJid(recipient),
        type: 'chat',
        chatState: isTyping ? 'composing' : 'active',
      } as any);
    },
    [clientInstance]
  );

  const clearUnread = useCallback((chatId: string) => {
    setUnreadCounts((prev) => {
      if (!prev[chatId]) return prev;
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
  }, []);


  return (
    <ChatContext.Provider
      value={{
        client: clientInstance,
        status,
        jid,
        messages: messages.filter((m) => !hiddenMessageIds.has(m.id)),
        allUsers,
        getUserProfile,
        friendships,
        myUsername,
        myUserId,
        sendMessage,
        sendFriendRequest,
        acceptFriendRequest,
        removeFriendship,
        deleteMessageForEveryone,
        deleteMessageForMe,
        editMessage,
        typingUsers,
        sendTypingIndicator,
        unreadCounts,
        clearUnread,
        setCurrentChat,
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
