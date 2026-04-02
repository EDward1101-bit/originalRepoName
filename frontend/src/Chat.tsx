import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { Client } from 'stanza';
import type { ReceivedMessage } from 'stanza/protocol';

interface ChatMessage {
  from: string;
  body: string;
  type: 'sent' | 'received';
  time: Date;
}

export default function Chat() {
  const { user, password, signOut } = useAuth();
  const [status, setStatus] = useState<string>('Connecting...');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [recipient, setRecipient] = useState('');
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

    const addMessage = (from: string, body: string, msgId: string) => {
      const myUsername = jidRef.current.split('@')[0];
      if (from === myUsername) return;
      if (seenIds.current.has(msgId)) return;
      seenIds.current.add(msgId);
      setMessages((prev) => [...prev, { from, body, type: 'received', time: new Date() }]);
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

      // Send presence immediately when bind succeeds, before any long-polls start.
      // Without this, presence is queued and sent only after the first 30-second poll
      // returns — during which Prosody drops all incoming messages (no available resource).
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
    client.on('raw:incoming', handleRawIncoming);
    client.on('raw:outgoing', handleRawOutgoing);

    client.connect().catch((err) => {
      console.error('Connect error:', err);
      setStatus('Error: ' + err.message);
    });

    return () => {
      client.off('connected', handleConnected);
      client.off('session:started', handleSessionStarted);
      client.off('disconnected', handleDisconnected);
      client.off('error', handleError);
      client.off('message', handleMessage);
      client.off('raw:incoming', handleRawIncoming);
      client.off('raw:outgoing', handleRawOutgoing);
      client.disconnect();
    };
  }, [user, password]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !clientRef.current || !recipient) return;

    let finalRecipient = recipient.trim();
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
    setMessages((prev) => [...prev, { from: 'You', body: input, type: 'sent', time: new Date() }]);
    setInput('');
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">XMPP Chat</h2>
          <button onClick={signOut} className="text-sm text-red-500 hover:underline">
            Log Out
          </button>
        </div>
        <div className="flex justify-between items-center">
          <span
            className={`px-3 py-1 rounded text-sm ${status === 'Connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
          >
            {status}
          </span>
          <div className="text-sm text-gray-600">Logged in as: {jid}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md h-96 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.length === 0 ? (
            <p className="text-gray-400 text-center">No messages yet. Start a conversation!</p>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-2 rounded ${msg.type === 'sent' ? 'bg-blue-100 ml-auto' : 'bg-gray-100'}`}
              >
                <div className="font-medium text-sm">{msg.from}</div>
                <div>{msg.body}</div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="border-t p-4 flex gap-2">
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Recipient username"
            className="w-1/3 p-2 border rounded"
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 p-2 border rounded"
          />
          <button
            onClick={sendMessage}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
