import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatContext } from './ChatContext';
import { formatMessageTimestamp } from './utils/time';

export default function Chat() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { messages, allUsers, sendMessage, myUsername } = useChatContext();
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
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Chat Header */}
      <header className="h-12 flex items-center px-4 border-b border-[var(--border)] flex-shrink-0 z-10 shadow-sm">
        <button
          onClick={() => navigate('/dms')}
          className="lg:hidden mr-4 w-8 h-8 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-normal)] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined text-[var(--text-muted)] text-[24px]">
              alternate_email
            </span>
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[var(--text-normal)] leading-tight">
              {recipient}
            </h1>
          </div>
          <div
            className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[var(--color-status-online)]' : 'bg-[var(--color-status-dnd)]'}`}
          />
        </div>

        <div className="ml-auto flex items-center gap-4">
          <button
            className="text-[var(--text-muted)] hover:text-[var(--text-normal)] transition-colors"
            title="Start Voice Call"
          >
            <span className="material-symbols-outlined text-[22px]">call</span>
          </button>
          <button
            className="text-[var(--text-muted)] hover:text-[var(--text-normal)] transition-colors"
            title="Start Video Call"
          >
            <span className="material-symbols-outlined text-[22px]">videocam</span>
          </button>
        </div>
      </header>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
        {filteredMessages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] opacity-60">
            <div className="w-20 h-20 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-4xl">alternate_email</span>
            </div>
            <h2 className="text-xl font-bold text-[var(--text-normal)] mb-2">
              This is the beginning of your direct message history with @{recipient}
            </h2>
          </div>
        ) : (
          filteredMessages.map((msg, index) => {
            const isSent = msg.type === 'sent';
            const showHeader = index === 0 || messages[index - 1].from !== msg.from;
            const senderName = isSent ? myUsername : msg.from;

            return (
              <div
                key={msg.id}
                className={`flex gap-4 hover:bg-[var(--bg-modifier-hover)] -mx-4 px-4 py-1 ${!showHeader ? 'mt-[-12px]' : ''}`}
              >
                {showHeader ? (
                  <div className="w-10 h-10 shrink-0 rounded-full bg-[var(--brand)] flex items-center justify-center text-white font-bold text-sm mt-1 cursor-pointer hover:opacity-90">
                    {senderName?.[0]?.toUpperCase()}
                  </div>
                ) : (
                  <div className="w-10 shrink-0 flex items-center justify-center">
                    {/* Time hover could go here */}
                  </div>
                )}

                <div className="flex flex-col min-w-0">
                  {showHeader && (
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="font-medium text-[15px] text-[var(--text-normal)] hover:underline cursor-pointer">
                        {senderName}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] font-medium">
                        {formatMessageTimestamp(msg.time)}
                      </span>
                    </div>
                  )}
                  <div className="text-[15px] text-[var(--text-normal)] whitespace-pre-wrap break-words leading-[1.375rem]">
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
      <footer className="px-4 pb-6 pt-2">
        <div className="flex items-center gap-3 bg-[var(--input-bg)] rounded-lg p-2.5">
          <button className="w-6 h-6 rounded-full bg-[var(--text-muted)] text-[var(--input-bg)] flex items-center justify-center hover:bg-[var(--text-normal)] transition-colors">
            <span className="material-symbols-outlined text-[16px]">add</span>
          </button>

          <input
            className="flex-1 bg-transparent border-none outline-none text-[var(--text-normal)] placeholder:text-[var(--text-muted)] text-[15px]"
            placeholder={`Message @${recipient}`}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />

          <div className="flex items-center gap-3">
            <button className="text-[var(--text-muted)] hover:text-[var(--text-normal)] transition-colors">
              <span className="material-symbols-outlined text-[22px]">gif_box</span>
            </button>
            <button className="text-[var(--text-muted)] hover:text-[var(--text-normal)] transition-colors">
              <span className="material-symbols-outlined text-[22px]">sentiment_satisfied</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
