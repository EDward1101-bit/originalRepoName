import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { Client } from 'stanza';
import type { ReceivedMessage } from 'stanza/protocol';
import { supabase } from './supabase';

interface ChatMessage {
  id: string;
  from: string;
  body: string;
  type: 'sent' | 'received';
  time: Date;
  otherParty: string;
}

interface RegisteredUser {
  username: string;
  online: boolean;
}

interface Friendship {
  id: string;
  requester: string;
  receiver: string;
  status: 'pending' | 'accepted';
}

export default function Chat() {
  const { user, password, signOut } = useAuth();
  const [status, setStatus] = useState<string>('Connecting...');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [recipient, setRecipient] = useState('');
  const [allUsers, setAllUsers] = useState<RegisteredUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    username: string;
    friendshipId: string;
  } | null>(null);
  const [jid, setJid] = useState(() => {
    const stored = sessionStorage.getItem('xmpp_jid');
    return stored || '';
  });
  const jidRef = useRef(jid);
  const seenIds = useRef(new Set<string>());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    sessionStorage.setItem('xmpp_jid', jid);
    jidRef.current = jid;
  }, [jid]);

  useEffect(() => {
    const handleClick = () => {
      if (contextMenu) setContextMenu(null);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  useEffect(() => {
    if (!user || !password) return;

    const storedJid = sessionStorage.getItem('xmpp_jid');
    const username = user.email?.split('@')[0] || '';
    const fullJid = storedJid || `${username}@localhost`;
    jidRef.current = fullJid;
    setJid(fullJid);
    setStatus('Connecting...');

    const boshUrl = `${window.location.origin}/http-bind`;

    const client = new Client({
      jid: fullJid,
      password: password,
      server: 'localhost',
      transports: {
        bosh: boshUrl,
      },
      useStreamManagement: false,
    });

    clientRef.current = client;

    const handleBeforeUnload = () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const addMessage = (from: string, body: string, msgId: string) => {
      const myUsername = jidRef.current.split('@')[0];
      if (from === myUsername) return;
      if (seenIds.current.has(msgId)) return;
      seenIds.current.add(msgId);
      setMessages((prev) => [
        ...prev,
        { id: msgId, from, body, type: 'received', time: new Date(), otherParty: from },
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

      // Update allUsers (displayed in UI) based on presence
      const isOnline = !type || ['available', 'chat', 'dnd', 'away', 'xa'].includes(type);

      setAllUsers((prev) =>
        prev.map((u) => (u.username === from ? { ...u, online: isOnline } : u))
      );
    };

    // Primary path: stanza.js 'message' event
    const handleMessage = (msg: ReceivedMessage) => {
      if (msg.type !== 'chat') return;
      if (!msg.body) return;
      const fromFull = msg.from || '';
      const from = fromFull.split('@')[0] || 'Unknown';
      const msgId = (msg as any).id || `${from}:${msg.body}`;
      console.log('[message event] from:', fromFull, 'body:', msg.body, 'id:', msgId);
      addMessage(from, msg.body as string, msgId);
    };

    // Fallback path: parse raw BOSH XML in case 'message' event doesn't fire
    const handleRawIncoming = (data: unknown) => {
      const str = String(data);
      console.log('XMPP Incoming:', str);

      if (str.includes('urn:ietf:params:xml:ns:xmpp-bind') && str.includes("type='result'")) {
        console.log('Bind complete — sending presence immediately');
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

        console.log('[raw fallback] from:', from, 'body:', body, 'id:', msgId);
        addMessage(from, body, msgId);
      }
    };

    const handleRawOutgoing = (data: unknown) => {
      console.log('XMPP Outgoing:', data);
    };

    client.on('connected', handleConnected);
    client.on('session:started', handleSessionStarted);
    client.on('disconnected', handleDisconnected);
    client.on('error', handleError);
    client.on('message', handleMessage);
    client.on('presence', handlePresence);
    client.on('raw:incoming', handleRawIncoming);
    client.on('raw:outgoing', handleRawOutgoing);

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
      client.off('raw:outgoing', handleRawOutgoing);
      client.disconnect();
    };
  }, [user, password]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/users');
        const data = await res.json();
        setAllUsers(data.map((u: any) => ({ username: u.username, online: false })));
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };

    const fetchFriendships = async () => {
      const myUsername = user?.email?.split('@')[0];
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
  }, [user]);

  useEffect(() => {
    const fetchMessages = async () => {
      const myUsername = user?.email?.split('@')[0];
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
  }, [user]);

  const sendFriendRequest = async (targetUsername: string) => {
    const myUsername = user?.email?.split('@')[0];
    if (!myUsername) return;

    const { data, error } = await supabase
      .from('friendships')
      .insert({ requester: myUsername, receiver: targetUsername, status: 'pending' })
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
      if (contextMenu && recipient === contextMenu.username) {
        setRecipient('');
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !clientRef.current || !recipient) return;

    const myUsername = user?.email?.split('@')[0] || '';
    const recipientUsername = recipient.trim();

    let finalRecipient = recipientUsername;
    if (!finalRecipient.includes('@')) {
      finalRecipient = `${finalRecipient}@localhost`;
    }

    const msg = {
      to: finalRecipient,
      body: input,
      type: 'chat' as const,
    };

    console.log('Sending to:', finalRecipient);
    clientRef.current.sendMessage(msg);

    const msgId = crypto.randomUUID();
    const now = new Date();
    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        from: 'You',
        body: input,
        type: 'sent',
        time: now,
        otherParty: recipientUsername,
      },
    ]);
    setInput('');

    const { error } = await supabase
      .from('messages')
      .insert({ sender: myUsername, receiver: recipientUsername, body: input });

    if (error) console.error('Failed to persist message:', error);
  };

  if (!user) return null;

  return (
    <div className="h-screen w-full flex items-center justify-center p-6 relative bg-background text-on-surface overflow-hidden">
      {/* Ambient Background Accents */}
      <div className="ambient-secondary"></div>
      <div className="ambient-primary"></div>

      {/* SideNavBar */}
      <nav className="fixed left-6 top-1/2 -translate-y-1/2 w-20 rounded-[3rem] h-auto py-8 bg-slate-900/40 backdrop-blur-3xl shadow-[0_0_40px_-10px_rgba(255,144,104,0.15)] flex flex-col items-center gap-8 z-50">
        <div className="mb-4">
          <div className="w-10 h-10 bg-linear-to-tr from-primary to-secondary rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,144,104,0.3)]">
            <span className="material-symbols-outlined text-black font-bold">bolt</span>
          </div>
        </div>
        <button className="text-gray-500 p-4 hover:bg-slate-800/60 hover:text-orange-200 rounded-full transition-all scale-110 active:scale-90 duration-200 cursor-pointer">
          <span className="material-symbols-outlined">home</span>
        </button>
        <button className="bg-orange-400 text-black rounded-full p-4 shadow-[0_0_20px_rgba(255,144,104,0.5)] scale-110 active:scale-90 duration-200 cursor-pointer">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            group
          </span>
        </button>
        <button className="text-gray-500 p-4 hover:bg-slate-800/60 hover:text-orange-200 rounded-full transition-all scale-110 active:scale-90 duration-200 cursor-pointer">
          <span className="material-symbols-outlined">person_pin</span>
        </button>
        <div className="mt-auto">
          <button className="text-primary-dim p-4 hover:bg-primary/10 rounded-full transition-all cursor-pointer">
            <span className="material-symbols-outlined">add</span>
          </button>
        </div>
      </nav>

      {/* TopNavBar */}
      <header className="fixed top-0 left-0 w-full z-40 bg-transparent backdrop-blur-xl flex justify-between items-center px-8 py-6">
        <div className="flex items-center gap-4 pl-24">
          <h1 className="text-2xl font-bold text-orange-400 drop-shadow-[0_0_10px_rgba(255,144,104,0.3)] font-['Plus_Jakarta_SANS'] tracking-tight">
            The Electric Hearth
          </h1>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ml-4 ${status === 'Connected' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
          >
            {status}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center bg-surface-container-low/60 rounded-full px-4 py-2 border border-outline-variant/10 focus-within:border-primary/40 transition-all">
            <span className="material-symbols-outlined text-on-surface-variant text-sm mr-2">
              search
            </span>
            <input
              className="bg-transparent border-none outline-none text-sm focus:ring-0 text-on-surface placeholder:text-outline-variant w-48"
              placeholder="Search the sanctuary..."
              type="text"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-outline-variant hidden sm:block">{jid}</div>
            <button
              onClick={signOut}
              title="Log Out"
              className="text-orange-400 hover:text-orange-300 transition-all duration-300 scale-105 active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="ml-24 mt-20 w-full h-[calc(100vh-120px)] flex gap-6 px-4 max-w-400 z-10">
        {/* Communities Module (Floating Island) */}
        <aside className="hidden lg:flex flex-col w-72 h-full gap-4">
          <div className="glass-panel p-6 rounded-xl flex flex-col gap-6 flex-1 shadow-xl">
            <h3 className="text-on-surface-variant text-xs font-bold uppercase tracking-widest">
              Active Channels
            </h3>
            <div className="flex flex-col gap-2">
              <button className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 text-primary transition-all group cursor-pointer border-none outline-none text-left">
                <span className="material-symbols-outlined text-lg">tag</span>
                <span className="font-semibold">the-forge</span>
                <div className="ml-auto w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_#ff9068]"></div>
              </button>
              <button className="flex items-center gap-3 p-3 rounded-lg text-on-surface-variant hover:bg-surface-container-highest transition-all cursor-pointer border-none outline-none text-left">
                <span className="material-symbols-outlined text-lg">tag</span>
                <span className="font-semibold text-sm">general-assembly</span>
              </button>
              <button className="flex items-center gap-3 p-3 rounded-lg text-on-surface-variant hover:bg-surface-container-highest transition-all cursor-pointer border-none outline-none text-left">
                <span className="material-symbols-outlined text-lg">tag</span>
                <span className="font-semibold text-sm">neon-garden</span>
              </button>
            </div>
            <div className="mt-auto p-4 bg-surface-container-lowest rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary shrink-0">
                  {user.email?.[0].toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold truncate">{user.email?.split('@')[0]}</p>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-tertiary"></div>
                    <p className="text-[10px] text-tertiary">In the Zone</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Chat Container */}
        <section className="flex-1 flex flex-col h-full glass-panel rounded-xl relative overflow-hidden shadow-2xl">
          {/* Chat Header */}
          <header className="p-6 flex items-center justify-between border-b border-outline-variant/5">
            <div className="flex items-center gap-4 flex-1">
              <div className="p-2 bg-primary/20 rounded-lg shrink-0">
                <span className="material-symbols-outlined text-primary">forum</span>
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <p className="text-xl font-bold leading-tight text-on-surface">
                  {recipient ? recipient : 'Select a user to message'}
                </p>
                <p className="text-xs text-on-surface-variant">Send a direct message</p>
              </div>
            </div>

            {/* Member HUD Widget */}
            <div className="group relative">
              <div className="flex -space-x-3 hover:-space-x-1 transition-all duration-300 cursor-pointer p-2 rounded-full bg-surface-container-highest/40">
                <div className="w-8 h-8 rounded-full border-2 border-surface-container-low bg-secondary/20 flex items-center justify-center text-xs font-bold text-secondary">
                  A
                </div>
                <div className="w-8 h-8 rounded-full border-2 border-surface-container-low bg-tertiary/20 flex items-center justify-center text-xs font-bold text-tertiary">
                  B
                </div>
                <div className="w-8 h-8 rounded-full border-2 border-surface-container-low bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  C
                </div>
                <div className="w-8 h-8 rounded-full bg-surface-container-high border-2 border-surface-container-low flex items-center justify-center text-[10px] font-bold">
                  +12
                </div>
              </div>
            </div>
          </header>

          {/* Message Feed */}
          <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-10">
            {(() => {
              const filteredMessages = recipient
                ? messages.filter((m) => m.otherParty === recipient)
                : [];
              return filteredMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-outline-variant opacity-60">
                  <span className="material-symbols-outlined text-4xl mb-2">speaker_notes_off</span>
                  <p>
                    {recipient
                      ? 'No messages yet. Start a conversation!'
                      : 'Select a user to message'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="relative flex justify-center mt-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-outline-variant/10"></div>
                    </div>
                    <span className="relative px-4 bg-[#131319] text-[10px] uppercase tracking-widest text-outline-variant font-bold">
                      Today
                    </span>
                  </div>

                  {filteredMessages.map((msg, idx) => {
                    const isSent = msg.type === 'sent';
                    return (
                      <div
                        key={idx}
                        className={`flex gap-6 group ${isSent ? 'flex-row-reverse' : ''}`}
                      >
                        <div
                          className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center shadow-lg font-bold text-lg ${isSent ? 'bg-primary/20 text-primary' : 'bg-surface-container-high text-secondary'}`}
                        >
                          {isSent ? 'Me' : msg.from[0].toUpperCase()}
                        </div>
                        <div
                          className={`flex flex-col gap-1 max-w-2xl ${isSent ? 'items-end' : ''}`}
                        >
                          <div
                            className={`flex items-center gap-3 ${isSent ? 'flex-row-reverse' : ''}`}
                          >
                            <span
                              className={`font-bold ${isSent ? 'text-primary' : 'text-secondary'}`}
                            >
                              {isSent ? 'You' : msg.from}
                            </span>
                            <span className="text-[10px] text-outline-variant">
                              {msg.time.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div
                            className={`p-5 text-on-surface leading-relaxed shadow-sm ${
                              isSent
                                ? 'bg-primary/20 rounded-l-xl rounded-br-xl border-r-2 border-primary'
                                : 'bg-surface-variant/40 rounded-r-xl rounded-bl-xl border-l-2 border-primary/20'
                            }`}
                          >
                            {msg.body}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
            <div ref={messagesEndRef} />
          </div>

          {/* Composition Area */}
          <footer className="p-6">
            <div className="glass-panel rounded-full p-2 flex items-center gap-3 border border-outline-variant/10 shadow-2xl">
              <button className="w-10 h-10 flex items-center justify-center rounded-full text-outline-variant hover:text-primary hover:bg-primary/10 transition-all cursor-pointer border-none outline-none">
                <span className="material-symbols-outlined">add_circle</span>
              </button>
              <input
                className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-on-surface placeholder:text-outline-variant/60 font-medium"
                placeholder={
                  recipient
                    ? `Message ${recipient}...`
                    : 'Choose a recipient above to type a message...'
                }
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                disabled={!recipient}
              />
              <div className="flex items-center gap-2 pr-2">
                <button className="w-10 h-10 flex items-center justify-center rounded-full text-outline-variant hover:text-tertiary transition-all cursor-pointer border-none outline-none">
                  <span className="material-symbols-outlined">mood</span>
                </button>
                <button
                  onClick={sendMessage}
                  disabled={!recipient || !input.trim()}
                  className="w-10 h-10 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,144,104,0.4)] hover:scale-105 active:scale-95 transition-all cursor-pointer border-none outline-none disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined">send</span>
                </button>
              </div>
            </div>
          </footer>
        </section>

        {/* Dynamic Context Island (Right) - All Users */}
        <aside className="hidden lg:flex flex-col w-80 h-full gap-4">
          <div className="glass-panel p-6 rounded-xl flex-1 flex flex-col shadow-xl border border-outline-variant/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-outline-variant">
                Users
              </h3>
              <span className="text-[10px] text-tertiary px-2 py-1 bg-tertiary/10 rounded-full">
                {allUsers.filter((u) => u.online).length} Online
              </span>
            </div>

            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm text-outline-variant">
                search
              </span>
              <input
                type="text"
                placeholder="Find users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-container-high border-none outline-none text-on-surface placeholder:text-outline-variant text-sm py-2 pl-9 pr-4 rounded-full"
              />
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto">
              {(() => {
                const myUsername = user?.email?.split('@')[0] || '';

                const usersWithRel = allUsers
                  .filter((u) => u.username !== myUsername)
                  .map((u) => {
                    const relationship = friendships.find(
                      (f) =>
                        (f.requester === myUsername && f.receiver === u.username) ||
                        (f.receiver === myUsername && f.requester === u.username)
                    );
                    return { ...u, relationship };
                  });

                const displayedUsers =
                  searchQuery.trim() !== ''
                    ? usersWithRel.filter((u) =>
                        u.username.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                    : usersWithRel.filter(
                        (u) =>
                          u.relationship?.status === 'accepted' ||
                          (u.relationship?.status === 'pending' &&
                            u.relationship.receiver === myUsername)
                      );

                if (displayedUsers.length === 0) {
                  return <p className="text-sm text-outline-variant opacity-60">No users found</p>;
                }

                return displayedUsers.map((u) => (
                  <div
                    key={u.username}
                    onClick={() => {
                      if (u.relationship?.status === 'accepted') {
                        setRecipient(u.username);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (u.relationship && u.relationship.status === 'accepted') {
                        setContextMenu({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          username: u.username,
                          friendshipId: u.relationship.id,
                        });
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={`flex items-center gap-3 group cursor-pointer p-2 rounded-lg transition-all border-none outline-none text-left w-full ${recipient === u.username ? 'bg-primary/10' : 'hover:bg-surface-container-highest'} ${u.relationship?.status !== 'accepted' ? 'opacity-80' : ''}`}
                  >
                    <div className="relative">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${u.online ? 'bg-primary/20 text-primary' : 'bg-surface-container-high text-outline-variant'}`}
                      >
                        {u.username[0].toUpperCase()}
                      </div>
                      {u.online && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-tertiary rounded-full border-2 border-surface shadow-[0_0_8px_#ffd16f]"></div>
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p
                        className={`text-sm font-bold transition-colors truncate ${recipient === u.username ? 'text-primary' : 'group-hover:text-primary'}`}
                      >
                        {u.username}
                      </p>
                      <p className="text-[10px] text-outline-variant truncate">
                        {u.online ? 'Online' : 'Offline'}
                      </p>
                    </div>

                    {/* Relationship Actions */}
                    <div className="shrink-0 flex items-center">
                      {!u.relationship ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            sendFriendRequest(u.username);
                          }}
                          className="px-3 py-1 bg-primary/20 text-primary text-[10px] font-bold rounded-full hover:bg-primary hover:text-on-primary transition-colors cursor-pointer"
                        >
                          Add
                        </button>
                      ) : u.relationship.status === 'pending' ? (
                        u.relationship.receiver === myUsername ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              acceptFriendRequest(u.relationship!.id);
                            }}
                            className="px-3 py-1 bg-tertiary/20 text-tertiary text-[10px] font-bold rounded-full hover:bg-tertiary hover:text-on-tertiary transition-colors cursor-pointer"
                          >
                            Accept
                          </button>
                        ) : (
                          <span className="text-[10px] text-outline-variant px-2">Pending</span>
                        )
                      ) : null}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </aside>
      </main>

      {/* Context Menu */}
      {contextMenu && contextMenu.visible && (
        <div
          className="fixed z-50 bg-surface-container-high border border-outline-variant/20 shadow-2xl rounded-lg py-1 min-w-37.5 overflow-hidden"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              removeFriendship(contextMenu.friendshipId);
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-error hover:bg-error/10 transition-colors cursor-pointer border-none outline-none"
          >
            Remove Friend
          </button>
        </div>
      )}
    </div>
  );
}
