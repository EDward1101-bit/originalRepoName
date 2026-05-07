import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMucContext } from './MucContext';
import { useChatContext } from './ChatContext';
import { useAuth } from './AuthContext';
import { formatMessageTimestamp } from './utils/time';
import MediaViewer from './components/MediaViewer';
import { supabase } from './supabase';
import EmojiPicker from 'emoji-picker-react';
import { ArrowLeft, Hash, LogOut, Phone, Video, Info, MoreHorizontal, EyeOff, Trash2, Image, FileText, X, Plus, Smile, Send, Loader2, Lock, Star, Users } from 'lucide-react';

export default function RoomChat() {
  const { roomName } = useParams<{ roomName: string }>();
  const navigate = useNavigate();
  const {
    availableRooms,
    joinedRooms,
    joinRoom,
    leaveRoom,
    roomMessages,
    roomTypingUsers,
    roomActiveUsers,
    sendRoomMessage,
    sendRoomTypingIndicator,
    deleteRoomMessageForEveryone,
    deleteRoomMessageForMe,
    clearRoomUnread,
    setCurrentRoom,
  } = useMucContext();
  const { user } = useAuth();
  const { myUsername, status, getUserProfile } = useChatContext();
  const isConnected = status === 'Connected';

  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const room = availableRooms.find((r) => r.name === roomName);
  const isJoined = roomName ? joinedRooms.includes(roomName) : false;

  // Register this room as active — suppresses unread increments while viewing
  useEffect(() => {
    if (!roomName) return;
    setCurrentRoom(roomName);
    clearRoomUnread(roomName);
    return () => {
      setCurrentRoom(null);
    };
  }, [roomName, setCurrentRoom, clearRoomUnread]);

  // Favorites from Supabase
  const [favoriteId, setFavoriteId] = useState<string | null>(null);

  // Check if this room is favorited
  useEffect(() => {
    if (!user || !roomName) return;
    const checkFavorite = async () => {
      const { data } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'room')
        .eq('name', roomName)
        .single();
      if (data) {
        setFavoriteId(data.id);
      } else {
        setFavoriteId(null);
      }
    };
    checkFavorite();
  }, [user, roomName]);

  const toggleFavorite = async () => {
    if (!user || !roomName) return;
    if (favoriteId) {
      // Remove from favorites
      await supabase.from('favorites').delete().eq('id', favoriteId);
      setFavoriteId(null);
    } else {
      // Add to favorites
      const { data } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, type: 'room', name: roomName })
        .select('id')
        .single();
      if (data) {
        setFavoriteId(data.id);
      }
    }
  };
  const isFavorite = !!favoriteId;
  const messages = useMemo(
    () => (roomName ? roomMessages[roomName] || [] : []),
    [roomName, roomMessages]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, roomTypingUsers, roomName]);

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

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!roomName) return;
    if (!input.trim() && stagedFiles.length === 0) return;

    setShowEmojiPicker(false);

    // Upload staged files
    if (stagedFiles.length > 0) {
      setIsUploading(true);
      const uploadPromises = stagedFiles.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('chat-media').upload(fileName, file);
        if (error) {
          console.error('Error uploading file:', error);
          return null;
        }
        const { data } = supabase.storage.from('chat-media').getPublicUrl(fileName);
        return data?.publicUrl || null;
      });

      const urls = await Promise.all(uploadPromises);
      setIsUploading(false);

      for (const url of urls) {
        if (url) {
          await sendRoomMessage(roomName, url);
        }
      }
      setStagedFiles([]);
    }

    // Send text message
    if (input.trim()) {
      await sendRoomMessage(roomName, input);
      setInput('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setStagedFiles((prev) => [...prev, ...Array.from(files)]);
    e.target.value = '';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);

    if (!isTyping) {
      setIsTyping(true);
      if (roomName) {
        sendRoomTypingIndicator(roomName, true);
      }
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (roomName) {
        sendRoomTypingIndicator(roomName, false);
      }
    }, 3000);
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const isMediaUrl = (text: string) => {
    return text.startsWith('http') && text.includes('supabase') && text.includes('chat-media');
  };

  if (!roomName) return null;

  if (!room) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center p-8 bg-[var(--bg-secondary)] rounded-2xl max-w-md border border-[var(--border)] shadow-xl">
          <div className="text-6xl text-[#ef4444] mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2 text-[var(--text-normal)] tracking-tight">
            Room Not Found
          </h2>
          <p className="text-[var(--text-muted)] mb-6">
            The room &quot;{roomName}&quot; does not exist or you don&apos;t have access to it.
          </p>
          <button
            onClick={() => navigate('/rooms')}
            className="bg-[var(--brand)] text-white px-6 py-2.5 rounded-xl font-medium transition-all hover:bg-[var(--brand-hover)] shadow-sm"
          >
            Back to Servers
          </button>
        </div>
      </div>
    );
  }

  const activeUsers = roomName ? roomActiveUsers[roomName] || [] : [];

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-normal)]">
      {/* Header */}
      <div className="h-16 flex-none border-b border-[var(--border)] flex items-center justify-between px-6 z-10 shadow-sm bg-[var(--bg-secondary)]/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/rooms')}
            className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] text-[var(--text-muted)] transition-colors"
          >
            <ArrowLeft size={24} />
          </button>

          <div className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--brand)] shadow-inner">
            <Hash size={24} />
          </div>
          <h2 className="font-bold text-[16px] tracking-tight ml-1">{room.name}</h2>

          {room.description && (
            <>
              <div className="w-[2px] h-6 bg-[var(--bg-modifier-active)] mx-3 rounded-full opacity-50" />
              <p className="text-[13px] font-medium text-[var(--text-muted)] truncate max-w-md">
                {room.description}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isJoined ? (
            <button
              onClick={handleLeave}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:bg-[#ef4444]/10 hover:text-[#ef4444] transition-colors"
              title="Leave Room"
            >
              <LogOut size={24} />
            </button>
          ) : (
            <button
              onClick={handleJoin}
              disabled={!isConnected}
              className="text-sm bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white font-bold px-4 py-2 rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              {isConnected ? 'Join Room' : status}
            </button>
          )}

          <button
            onClick={toggleFavorite}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              isFavorite
                ? 'bg-[#f59e0b]/10 text-[#f59e0b]'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)]'
            }`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={20} fill={favoriteId ? '#f59e0b' : 'none'} />
          </button>

          <button
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-colors"
            title="Start Voice Call"
          >
            <Phone size={24} />
          </button>
          <button
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-colors"
            title="Start Video Call"
          >
            <Video size={24} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isJoined ? (
        <div className="flex-1 flex min-h-0" onClick={() => setActiveMenu(null)}>
          {/* Messages Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] opacity-80">
                <div className="w-24 h-24 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-6 shadow-inner border border-[var(--border)]">
                  <Hash size={48} className="text-[var(--brand)]" />
                </div>
                <h2 className="text-2xl font-bold text-[var(--text-normal)] mb-2 tracking-tight">
                  Welcome to #{room.name}!
                </h2>
                <p className="text-[15px]">This is the start of the #{room.name} channel.</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isSentByMe = msg.sender === myUsername;
                const senderProfile = getUserProfile(msg.sender);

                const senderName = isSentByMe
                  ? 'You'
                  : senderProfile?.username || msg.sender;

                const senderAvatar = isSentByMe
                  ? user?.user_metadata?.avatar_url || localStorage.getItem('aether_avatar')
                  : senderProfile?.avatarUrl;

                if (msg.type === 'system') {
                  return (
                    <div
                      key={msg.id || index}
                      className="flex gap-4 -mx-6 px-6 py-2 hover:bg-[var(--bg-modifier-hover)] transition-colors"
                    >
                      <div className="w-10 shrink-0 flex justify-end items-center">
                        <Info size={20} className="text-[#10b981]" />
                      </div>
                      <div className="flex-1 text-[14px] text-[var(--text-muted)] font-medium italic">
                        {msg.body}
                      </div>
                    </div>
                  );
                }

                const showHeader =
                  index === 0 ||
                  messages[index - 1].sender !== msg.sender ||
                  messages[index - 1].type === 'system';

                const isDeleted = msg.body === '\u{1F6AB} This message was deleted';

                return (
                  <div
                    key={msg.id}
                    className={`group flex gap-4 hover:bg-[var(--bg-modifier-hover)] -mx-6 px-6 py-2 transition-colors relative ${!showHeader ? 'mt-[-16px]' : ''}`}
                  >
                    {showHeader ? (
                      <div
                        className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-sm mt-0.5 shadow-sm overflow-hidden ${isSentByMe ? 'bg-[var(--brand)]' : 'bg-[#8b5cf6]'}`}
                      >
                        {senderAvatar ? (
                          <img
                            src={senderAvatar}
                            alt={senderName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          senderName?.[0]?.toUpperCase() || '?'
                        )}
                      </div>
                    ) : (
                      <div className="w-10 shrink-0 flex items-center justify-center"></div>
                    )}

                    <div className="flex flex-col min-w-0 w-full">
                      {showHeader && (
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-bold text-[15px] text-[var(--text-normal)]">
                            {senderName}
                          </span>
                          <span className="text-[12px] text-[var(--text-muted)] font-medium">
                            {formatMessageTimestamp(msg.created_at)}
                          </span>
                        </div>
                      )}
                      {isMediaUrl(msg.body) ? (
                        <MediaViewer url={msg.body} />
                      ) : (
                        <div
                          className={`text-[15px] whitespace-pre-wrap break-words leading-[1.4rem] ${isDeleted ? 'text-[var(--text-muted)] italic' : 'text-[var(--text-normal)]'}`}
                        >
                          {msg.body}
                        </div>
                      )}
                    </div>

                    {/* Message Actions Button */}
                    {!isDeleted && (
                      <div className="absolute right-6 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenu(activeMenu === msg.id ? null : msg.id);
                          }}
                          className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-normal)] shadow-sm"
                        >
                          <MoreHorizontal size={18} />
                        </button>

                        {activeMenu === msg.id && (
                          <div className="absolute right-0 top-9 z-50 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl shadow-2xl py-2 min-w-[200px] overflow-hidden">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteRoomMessageForMe(roomName, msg.id);
                                setActiveMenu(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-[14px] text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] flex items-center gap-3"
                            >
                              <EyeOff size={18} />
                              Delete for Me
                            </button>
                            {isSentByMe && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (room) {
                                    deleteRoomMessageForEveryone(room.id, roomName, msg.id);
                                  }
                                  setActiveMenu(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-[14px] text-[#ef4444] hover:bg-[#ef4444]/10 flex items-center gap-3"
                              >
                                <Trash2 size={18} />
                                Delete for Everyone
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Room Typing Indicator */}
            {roomName && roomTypingUsers[roomName] && Object.keys(roomTypingUsers[roomName]).length > 0 && (
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="flex -space-x-1">
                  {Object.keys(roomTypingUsers[roomName]).slice(0, 3).map((username, i) => {
                    const profile = getUserProfile(username);
                    const avatarUrl = profile?.avatarUrl;
                    return (
                      <div
                        key={username}
                        className="w-5 h-5 rounded-full bg-[var(--brand)] flex items-center justify-center text-[8px] text-white font-bold border-2 border-[var(--bg-primary)] overflow-hidden"
                        style={{ zIndex: 3 - i }}
                      >
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={profile?.username || username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          profile?.username?.[0]?.toUpperCase() || username[0].toUpperCase()
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[12px] text-[var(--text-muted)] font-medium">
                  {Object.keys(roomTypingUsers[roomName]).length === 1
                    ? `${getUserProfile(Object.keys(roomTypingUsers[roomName])[0])?.username || Object.keys(roomTypingUsers[roomName])[0]} is typing...`
                    : `${Object.keys(roomTypingUsers[roomName]).length} people are typing...`}
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="px-6 pb-6 pt-2 relative">
            {showEmojiPicker && (
              <div className="absolute bottom-[80px] right-6 z-50 shadow-2xl rounded-2xl overflow-hidden border border-[var(--border)]">
                <EmojiPicker
                  onEmojiClick={(emojiData: unknown) =>
                    setInput((prev) => prev + (emojiData as { emoji?: string })?.emoji)
                  }
                  theme={'light' as any}
                  lazyLoadEmojis={true}
                />
              </div>
            )}

            {/* Staged Files Preview */}
            {stagedFiles.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-3 p-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl">
                {stagedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="relative group/staged w-20 h-20 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-tertiary)] flex items-center justify-center"
                  >
                    {file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : file.type.startsWith('video/') ? (
                      <Image size={32} className="text-[var(--text-muted)]" />
                    ) : (
                      <FileText size={32} className="text-[var(--text-muted)]" />
                    )}
                    <button
                      onClick={() => removeStagedFile(index)}
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#ef4444] text-white flex items-center justify-center opacity-0 group-hover/staged:opacity-100 transition-opacity shadow-md"
                    >
                      <X size={14} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate text-center">
                      {file.name}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 bg-[var(--bg-secondary)] border border-[var(--border)]/50 rounded-2xl p-2 shadow-sm focus-within:border-[var(--brand)]/50 focus-within:ring-1 focus-within:ring-[var(--brand)]/20 transition-all">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,video/*,image/gif"
                multiple
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-muted)] flex items-center justify-center hover:bg-[var(--brand)] hover:text-white transition-all ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isUploading ? <Loader2 size={22} className="animate-spin" /> : <Plus size={22} />}
              </button>

              <input
                className="flex-1 bg-transparent border-none outline-none text-[var(--text-normal)] placeholder:text-[var(--text-muted)] text-[15px] px-2"
                placeholder={`Message #${room.name}`}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSend(e as unknown as React.FormEvent);
                  }
                }}
                disabled={isUploading}
              />

              <div className="flex items-center gap-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--brand)] transition-colors"
                >
                  <Image size={24} />
                </button>
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${showEmojiPicker ? 'bg-[var(--brand)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--brand)]'}`}
                >
                  <Smile size={24} />
                </button>
                {(input.trim() || stagedFiles.length > 0) && (
                  <button
                    onClick={() => handleSend()}
                    disabled={isUploading}
                    className="w-10 h-10 rounded-xl bg-[var(--brand)] text-white flex items-center justify-center hover:bg-[var(--brand-hover)] transition-colors shadow-sm"
                  >
                    <Send size={22} />
                  </button>
                )}
              </div>
            </div>
          </div>

          </div>

          {/* Active Users Sidebar */}
          <div className="w-60 bg-[var(--bg-secondary)] border-l border-[var(--border)] flex flex-col flex-shrink-0">
            <div className="h-14 flex items-center px-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-[var(--text-muted)]" />
                <span className="text-[13px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Active Now
                </span>
                <span className="ml-1 bg-[var(--brand)] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {activeUsers.length}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {activeUsers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[13px] text-[var(--text-muted)] italic">No active users</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {activeUsers.map((nickname) => {
                    const profile = getUserProfile(nickname);
                    const displayName = profile?.username || nickname;
                    const avatarUrl = profile?.avatarUrl;
                    const isOnline = profile?.online;

                    return (
                      <div
                        key={nickname}
                        className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--bg-modifier-hover)] transition-colors"
                      >
                        <div className="relative">
                          <div className="w-9 h-9 rounded-full bg-[var(--brand)] flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              displayName?.[0]?.toUpperCase() || '?'
                            )}
                          </div>
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-[2px] border-[var(--bg-secondary)] ${
                              isOnline ? 'bg-[#10b981]' : 'bg-[#ef4444]'
                            }`}
                          />
                        </div>
                        <span className="text-[14px] font-medium text-[var(--text-normal)] truncate">
                          {displayName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
          <div className="w-24 h-24 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-6 text-[var(--text-normal)] shadow-inner border border-[var(--border)]">
            <Lock size={48} />
          </div>
          <h3 className="text-2xl font-bold text-[var(--text-normal)] mb-2 tracking-tight">
            You haven&apos;t joined this room
          </h3>
          <p className="mb-8 text-center max-w-md text-[15px] leading-relaxed">
            Join #{room.name} to see the message history and participate in the conversation.
          </p>
          <button
            onClick={handleJoin}
            disabled={!isConnected}
            className="px-8 py-3.5 font-bold text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] rounded-xl transition-all shadow-md disabled:opacity-50 text-[16px]"
          >
            {isConnected ? `Join #${room.name}` : status}
          </button>
        </div>
      )}
    </div>
  );
}
