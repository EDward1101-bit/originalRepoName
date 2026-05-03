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
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleJoin = async () => {
    console.log('[RoomChat] handleJoin clicked for roomName:', roomName);
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
      <div className="flex h-full items-center justify-center bg-surface">
        <div className="text-center p-8 bg-surface-container rounded-3xl max-w-md">
          <span className="material-symbols-outlined text-6xl text-error mb-4 block">error</span>
          <h2 className="text-2xl font-bold mb-2 text-on-surface">Room Not Found</h2>
          <p className="text-on-surface-variant mb-6">
            The room &quot;{roomName}&quot; does not exist or you don&apos;t have access to it.
          </p>
          <button
            onClick={() => navigate('/rooms')}
            className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold transition-all hover:bg-primary/90"
          >
            Back to Rooms
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="h-16 flex-none border-b border-surface-variant bg-surface-container-low flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/rooms')}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-variant transition-colors text-on-surface-variant"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h2 className="font-bold flex items-center gap-2 text-on-surface text-lg">
              <span className="text-primary">#</span> {room.name}
            </h2>
            {room.description && (
              <p className="text-xs text-on-surface-variant truncate max-w-md">
                {room.description}
              </p>
            )}
          </div>
        </div>

        <div>
          {isJoined ? (
            <button
              onClick={handleLeave}
              className="px-4 py-2 text-sm font-medium text-error hover:bg-error/10 rounded-xl transition-colors border border-error/20"
            >
              Leave Room
            </button>
          ) : (
            <button
              onClick={handleJoin}
              disabled={!isConnected}
              title={!isConnected ? `XMPP ${status}` : 'Join this room'}
              className="px-6 py-2 text-sm font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnected ? 'Join Room' : status}
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isJoined ? (
        <div className="flex-1 flex flex-col min-h-0 bg-surface">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant">
                <div className="w-16 h-16 bg-surface-variant rounded-full flex items-center justify-center mb-4 text-primary">
                  <span className="material-symbols-outlined text-3xl">waving_hand</span>
                </div>
                <p>Welcome to #{room.name}!</p>
                <p className="text-sm mt-1">Be the first to send a message.</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isSentByMe = msg.sender === myUsername;

                if (msg.type === 'system') {
                  return (
                    <div key={msg.id || idx} className="flex justify-center my-2">
                      <span className="bg-surface-variant text-on-surface-variant px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 shadow-sm">
                        <span className="material-symbols-outlined text-[14px]">info</span>
                        {msg.body}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isSentByMe ? 'items-end' : 'items-start'} group max-w-full`}
                  >
                    {!isSentByMe && (
                      <span className="text-xs text-on-surface-variant mb-1 ml-1 font-medium">
                        {msg.sender}
                      </span>
                    )}
                    <div className="flex items-end gap-2 max-w-[85%]">
                      <div
                        className={`px-5 py-3 rounded-2xl shadow-sm text-[15px] ${
                          isSentByMe
                            ? 'bg-primary text-on-primary rounded-br-sm'
                            : 'bg-surface-container-high text-on-surface rounded-bl-sm border border-surface-variant'
                        } wrap-break-word whitespace-pre-wrap leading-relaxed`}
                      >
                        {msg.body}
                      </div>
                    </div>
                    <span className="text-[10px] text-on-surface-variant mt-1 opacity-0 group-hover:opacity-100 transition-opacity mx-1">
                      {formatMessageTimestamp(msg.created_at)}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-surface-container-lowest border-t border-surface-variant">
            <form
              onSubmit={handleSend}
              className="flex gap-3 bg-surface-container-low p-2 rounded-3xl border border-surface-variant focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Message #${room.name}...`}
                className="flex-1 bg-transparent border-none outline-none px-4 text-on-surface placeholder:text-on-surface-variant"
                autoFocus
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-primary text-on-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shrink-0 shadow-sm"
              >
                <span className="material-symbols-outlined text-[20px]">send</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-surface text-on-surface-variant">
          <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mb-6 text-primary shadow-sm border border-surface-variant">
            <span className="material-symbols-outlined text-4xl">lock</span>
          </div>
          <h3 className="text-xl font-bold text-on-surface mb-2">
            You haven&apos;t joined this room
          </h3>
          <p className="mb-6 text-center max-w-sm">
            Join #{room.name} to see the message history and participate in the conversation.
          </p>
          <button
            onClick={handleJoin}
            disabled={!isConnected}
            title={!isConnected ? `XMPP ${status}` : 'Join this room'}
            className="px-8 py-3 font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnected ? `Join #${room.name}` : status}
          </button>
        </div>
      )}
    </div>
  );
}
