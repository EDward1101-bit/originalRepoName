import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatContext } from './ChatContext';
import { formatMessageTimestamp } from './utils/time';

export default function Chat() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { messages, allUsers, sendMessage } = useChatContext();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const recipient = username || '';

  const recipientUser = allUsers.find((u) => u.username === recipient);
  const isOnline = recipientUser?.online ?? false;

  const filteredMessages = useMemo(
    () => (recipient ? messages.filter((m) => m.otherParty === recipient) : []),
    [messages, recipient]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages.length]);

  const handleSend = () => {
    if (!input.trim() || !recipient) return;
    sendMessage(recipient, input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <header className="h-16 flex items-center px-8 border-b border-surface-variant flex-shrink-0 bg-surface/80 backdrop-blur-sm shadow-sm z-10">
        <button
          onClick={() => navigate('/dms')}
          className="mr-4 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border border-surface-variant shadow-sm ${isOnline ? 'bg-primary/15 text-primary' : 'bg-surface-container-high text-outline'}`}
            >
              {recipient?.[0]?.toUpperCase() || '?'}
            </div>
            <div
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface ${isOnline ? 'bg-tertiary' : 'bg-surface-variant'}`}
            />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-on-background">{recipient}</h1>
            <p className="text-xs text-outline">{isOnline ? 'Online' : 'Offline'}</p>
          </div>
        </div>
      </header>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
        {filteredMessages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-outline opacity-60">
            <span className="material-symbols-outlined text-4xl mb-2">speaker_notes_off</span>
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isSent = msg.type === 'sent';
            return (
              <div key={msg.id} className={`flex gap-3 ${isSent ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-bold text-xs border border-surface-variant ${isSent ? 'bg-primary/15 text-primary' : 'bg-surface-container-high text-outline'}`}
                >
                  {isSent ? 'Me' : msg.from[0].toUpperCase()}
                </div>
                <div className={`flex flex-col gap-1 max-w-lg ${isSent ? 'items-end' : ''}`}>
                  <div className={`flex items-center gap-2 ${isSent ? 'flex-row-reverse' : ''}`}>
                    <span
                      className={`text-xs font-bold ${isSent ? 'text-primary' : 'text-on-surface-variant'}`}
                    >
                      {isSent ? 'You' : msg.from}
                    </span>
                    <span className="text-[10px] text-outline">
                      {formatMessageTimestamp(msg.time)}
                    </span>
                  </div>
                  <div
                    className={`px-4 py-3 text-sm leading-relaxed ${
                      isSent
                        ? 'bg-primary text-on-primary rounded-2xl rounded-br-sm'
                        : 'bg-surface-container-high text-on-surface rounded-2xl rounded-bl-sm'
                    }`}
                  >
                    {msg.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composition Area */}
      <footer className="p-4 border-t border-surface-variant">
        <div className="flex items-center gap-3 bg-surface-container rounded-2xl p-2 border border-surface-variant">
          <input
            className="flex-1 bg-transparent border-none outline-none text-on-surface placeholder:text-outline text-sm px-3 py-2"
            placeholder={`Message ${recipient}...`}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-9 h-9 bg-primary text-on-primary rounded-full flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
