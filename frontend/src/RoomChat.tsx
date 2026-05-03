import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMucContext } from './MucContext';
import { useChatContext } from './ChatContext';
import { formatMessageTimestamp } from './utils/time';

export default function RoomChat() {
  const { roomName } = useParams<{ roomName: string }>();
  const navigate = useNavigate();
  const { availableRooms, joinedRooms, joinRoom, leaveRoom, roomMessages, sendRoomMessage } =
    useMucContext();
  const { myUsername, status } = useChatContext();
  const isConnected = status === 'Connected';

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const room = availableRooms.find((r) => r.name === roomName);
  const isJoined = roomName ? joinedRooms.includes(roomName) : false;
  const messages = useMemo(
    () => (roomName ? roomMessages[roomName] || [] : []),
    [roomName, roomMessages]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleJoin = async () => {
    if (roomName) {
      await joinRoom(roomName);
    }
  };

  const handleLeave = () => {
    if (roomName) {
      leaveRoom(roomName);
      navigate('/rooms');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !roomName) return;

    await sendRoomMessage(roomName, input);
    setInput('');
  };

  if (!roomName) return null;

  if (!room) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center p-8 bg-[var(--bg-secondary)] rounded-md max-w-md">
          <span className="material-symbols-outlined text-6xl text-[var(--color-status-dnd)] mb-4 block">
            error
          </span>
          <h2 className="text-2xl font-bold mb-2 text-[var(--text-normal)]">Room Not Found</h2>
          <p className="text-[var(--text-muted)] mb-6">
            The room &quot;{roomName}&quot; does not exist or you don&apos;t have access to it.
          </p>
          <button
            onClick={() => navigate('/rooms')}
            className="bg-[var(--brand)] text-white px-6 py-2 rounded font-medium transition-all hover:bg-[var(--brand-hover)]"
          >
            Back to Servers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-normal)]">
      {/* Header */}
      <div className="h-12 flex-none border-b border-[var(--border)] flex items-center justify-between px-4 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/rooms')}
            className="lg:hidden w-8 h-8 rounded flex items-center justify-center hover:text-[var(--text-normal)] text-[var(--text-muted)] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>

          <span className="material-symbols-outlined text-[var(--text-muted)] text-[24px]">
            tag
          </span>
          <h2 className="font-bold text-[15px] leading-tight ml-1">{room.name}</h2>

          {room.description && (
            <>
              <div className="w-[1px] h-6 bg-[var(--bg-modifier-active)] mx-2" />
              <p className="text-[13px] font-medium text-[var(--text-muted)] truncate max-w-md">
                {room.description}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isJoined ? (
            <button
              onClick={handleLeave}
              className="text-[var(--text-muted)] hover:text-[var(--color-status-dnd)] transition-colors"
              title="Leave Room"
            >
              <span className="material-symbols-outlined text-[22px]">logout</span>
            </button>
          ) : (
            <button
              onClick={handleJoin}
              disabled={!isConnected}
              className="text-xs bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white font-medium px-3 py-1 rounded transition-colors disabled:opacity-50"
            >
              {isConnected ? 'Join Room' : status}
            </button>
          )}
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
      </div>

      {/* Main Content Area */}
      {isJoined ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] opacity-60">
                <div className="w-20 h-20 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-4xl">tag</span>
                </div>
                <h2 className="text-xl font-bold text-[var(--text-normal)] mb-2">
                  Welcome to #{room.name}!
                </h2>
                <p className="text-sm">This is the start of the #{room.name} channel.</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isSentByMe = msg.sender === myUsername;

                if (msg.type === 'system') {
                  return (
                    <div
                      key={msg.id || index}
                      className="flex gap-4 -mx-4 px-4 py-1 hover:bg-[var(--bg-modifier-hover)]"
                    >
                      <div className="w-10 shrink-0 flex justify-end">
                        <span className="material-symbols-outlined text-[var(--color-status-offline)] text-[18px]">
                          info
                        </span>
                      </div>
                      <div className="flex-1 text-[15px] text-[var(--text-muted)]">{msg.body}</div>
                    </div>
                  );
                }

                const showHeader =
                  index === 0 ||
                  messages[index - 1].sender !== msg.sender ||
                  messages[index - 1].type === 'system';

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-4 hover:bg-[var(--bg-modifier-hover)] -mx-4 px-4 py-1 ${!showHeader ? 'mt-[-12px]' : ''}`}
                  >
                    {showHeader ? (
                      <div
                        className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-sm mt-1 cursor-pointer hover:opacity-90 ${isSentByMe ? 'bg-[var(--brand)]' : 'bg-[#23a559]'}`}
                      >
                        {msg.sender?.[0]?.toUpperCase() || '?'}
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
                            {msg.sender}
                          </span>
                          <span className="text-xs text-[var(--text-muted)] font-medium">
                            {formatMessageTimestamp(msg.created_at)}
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

          {/* Input Area */}
          <div className="px-4 pb-6 pt-2">
            <div className="flex items-center gap-3 bg-[var(--input-bg)] rounded-lg p-2.5">
              <button className="w-6 h-6 rounded-full bg-[var(--text-muted)] text-[var(--input-bg)] flex items-center justify-center hover:bg-[var(--text-normal)] transition-colors">
                <span className="material-symbols-outlined text-[16px]">add</span>
              </button>

              <input
                className="flex-1 bg-transparent border-none outline-none text-[var(--text-normal)] placeholder:text-[var(--text-muted)] text-[15px]"
                placeholder={`Message #${room.name}`}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSend(e as unknown as React.FormEvent);
                  }
                }}
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
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
          <div className="w-20 h-20 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center mb-6 text-[var(--text-normal)] shadow-sm">
            <span className="material-symbols-outlined text-4xl">lock</span>
          </div>
          <h3 className="text-xl font-bold text-[var(--text-normal)] mb-2">
            You haven&apos;t joined this room
          </h3>
          <p className="mb-6 text-center max-w-sm">
            Join #{room.name} to see the message history and participate in the conversation.
          </p>
          <button
            onClick={handleJoin}
            disabled={!isConnected}
            className="px-8 py-3 font-medium text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] rounded transition-all disabled:opacity-50"
          >
            {isConnected ? `Join #${room.name}` : status}
          </button>
        </div>
      )}
    </div>
  );
}
