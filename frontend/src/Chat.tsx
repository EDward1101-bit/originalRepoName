import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { Client } from 'stanza';
import type { ReceivedMessage } from 'stanza/protocol';
import { supabase } from './supabase';
// Import your new component
import FileUpload from './components/FileUpload';

interface ChatMessage {
  from: string;
  body: string;
  type: 'sent' | 'received';
  time: Date;
  isFile?: boolean; // New flag for file messages
}

// ... (RegisteredUser, Friendship interfaces remain the same)

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

  // Helper to detect if a message is an uploaded file link
  const isFileUrl = (text: string) => text.startsWith('http') && text.includes('/upload/');

  useEffect(() => {
    sessionStorage.setItem('xmpp_jid', jid);
    jidRef.current = jid;
  }, [jid]);

  useEffect(() => {
    if (!user || !password) return;

    const username = user.email?.split('@')[0] || '';
    const fullJid = jid || `${username}@localhost`;
    setJid(fullJid);

    const client = new Client({
      jid: fullJid,
      password: password,
      server: 'localhost',
      transports: { bosh: `${window.location.origin}/http-bind` },
      useStreamManagement: false,
    });

    clientRef.current = client;

    const addMessage = (from: string, body: string, msgId: string) => {
      const myUsername = jidRef.current.split('@')[0];
      if (from === myUsername) return;
      if (seenIds.current.has(msgId)) return;
      seenIds.current.add(msgId);
      
      setMessages((prev) => [...prev, { 
        from, 
        body, 
        type: 'received', 
        time: new Date(),
        isFile: isFileUrl(body) 
      }]);
    };

    client.on('session:started', () => {
      setStatus('Connected');
      client.sendPresence({});
    });

    client.on('message', (msg: ReceivedMessage) => {
      if (msg.type !== 'chat' || !msg.body) return;
      const from = (msg.from || '').split('@')[0] || 'Unknown';
      const msgId = (msg as any).id || `${from}:${msg.body}`;
      addMessage(from, msg.body as string, msgId);
    });

    client.connect();

    return () => client.disconnect();
  }, [user, password]);

  // Handle successful file upload
  const handleUploadSuccess = (url: string) => {
    if (!clientRef.current || !recipient) return;

    let finalRecipient = recipient.trim();
    if (!finalRecipient.includes('@')) finalRecipient = `${finalRecipient}@localhost`;

    clientRef.current.sendMessage({
      to: finalRecipient,
      body: url, // Sending the URL as the message body
      type: 'chat'
    });

    setMessages((prev) => [...prev, { 
      from: 'You', 
      body: url, 
      type: 'sent', 
      time: new Date(),
      isFile: true 
    }]);
  };

  const sendMessage = () => {
    if (!input.trim() || !clientRef.current || !recipient) return;
    let finalRecipient = recipient.includes('@') ? recipient : `${recipient}@localhost`;

    clientRef.current.sendMessage({ to: finalRecipient, body: input, type: 'chat' });
    setMessages((prev) => [...prev, { from: 'You', body: input, type: 'sent', time: new Date() }]);
    setInput('');
  };

  // ... (Keep your fetchUsers, fetchFriendships, sendFriendRequest, etc. logic)

  return (
    <div className="h-screen w-full flex items-center justify-center p-6 relative bg-background text-on-surface overflow-hidden">
      {/* ... (Keep your nav and header as they are) */}

      <main className="ml-24 mt-20 w-full h-[calc(100vh-120px)] flex gap-6 px-4 max-w-[1600px] z-10">
        {/* ... (Keep your aside Active Channels) */}

        <section className="flex-1 flex flex-col h-full glass-panel rounded-xl relative overflow-hidden shadow-2xl">
          <header className="p-6 flex items-center justify-between border-b border-outline-variant/5">
             {/* ... (Keep your header content) */}
          </header>

          {/* Message Feed */}
          <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-10">
            {messages.map((msg, idx) => {
              const isSent = msg.type === 'sent';
              return (
                <div key={idx} className={`flex gap-6 group ${isSent ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center font-bold ${isSent ? 'bg-primary/20 text-primary' : 'bg-surface-container-high text-secondary'}`}>
                    {isSent ? 'Me' : msg.from[0].toUpperCase()}
                  </div>
                  <div className={`flex flex-col gap-1 max-w-2xl ${isSent ? 'items-end' : ''}`}>
                    <div className={`p-5 text-on-surface leading-relaxed shadow-sm ${
                      isSent ? 'bg-primary/20 rounded-l-xl rounded-br-xl border-r-2 border-primary' 
                             : 'bg-surface-variant/40 rounded-r-xl rounded-bl-xl border-l-2 border-primary/20'
                    }`}>
                      {msg.isFile ? (
                        <div className="flex flex-col gap-2">
                          <span className="text-xs opacity-70 italic">Shared a file</span>
                          <a 
                            href={msg.body} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-2 bg-black/20 p-3 rounded-lg hover:bg-black/40 transition-all no-underline text-inherit"
                          >
                            <span className="material-symbols-outlined">download</span>
                            <span className="font-bold underline">Download File</span>
                          </a>
                        </div>
                      ) : (
                        msg.body
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Composition Area */}
          <footer className="p-6">
            <div className="glass-panel rounded-full p-2 flex items-center gap-3 border border-outline-variant/10 shadow-2xl">
              {/* File Upload Trigger */}
              {clientRef.current && (
                <FileUpload 
                  client={clientRef.current} 
                  onUploadSuccess={handleUploadSuccess} 
                />
              )}
              
              <input
                className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-on-surface placeholder:text-outline-variant/60 font-medium"
                placeholder={recipient ? `Message ${recipient}...` : 'Select a recipient...'}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                disabled={!recipient}
              />
              <button
                onClick={sendMessage}
                disabled={!recipient || !input.trim()}
                className="w-10 h-10 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,144,104,0.4)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined">send</span>
              </button>
            </div>
          </footer>
        </section>

        {/* ... (Keep your aside Users list) */}
      </main>
    </div>
  );
}
