import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useChatContext } from './ChatContext';
import { useTranslation } from './LanguageContext';
import { useBotContext } from './BotContext';
import { useMucContext } from './MucContext';
import { formatMessageTimestamp } from './utils/time';
import MediaViewer from './components/MediaViewer';
import { supabase } from './supabase';
import EmojiPicker from 'emoji-picker-react';
import { ArrowLeft, Hash, LogOut, Phone, Video, Info, MoreHorizontal, EyeOff, Trash2, Image, FileText, X, Plus, Smile, Send, Loader2, Lock, Star, Users, Bot } from 'lucide-react';

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
  const { getBotsForRoom, allBots } = useBotContext();
  const isConnected = status === 'Connected';
  const { t } = useTranslation();

  const resolveDisplayName = useCallback(
    (xmppName?: string) => {
      if (!xmppName) return '';
      const profile = getUserProfile(xmppName);
      return profile?.username || xmppName;
    },
    [getUserProfile]
  );

  const formatSystemMessage = useCallback(
    (body: string) => {
      const match = body.match(/^(.*) has (entered|left) the room\.$/);
      if (!match) return body;
      const nickname = match[1];
      const verb = match[2];
      const displayName = resolveDisplayName(nickname);
      const action = verb === 'entered' ? t('entered_room') : t('left_room');
      return `${displayName} ${action}`;
    },
    [resolveDisplayName, t]
  );

  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showActiveUsers, setShowActiveUsers] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const isResizingRef = useRef(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    // Calculate width from the right side of the screen
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 180 && newWidth <= 500) {
      setSidebarWidth(newWidth);
    }
  }, []);

  const stopResizing = useCallback(() => {
    isResizingRef.current = false;
    document.body.style.cursor = 'default';
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
  }, [handleMouseMove]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  }, [handleMouseMove, stopResizing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResizing);
    };
  }, [handleMouseMove, stopResizing]);

  const shouldStickToBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);

  const scrollToBottom = (mode: 'auto' | 'smooth' = 'auto') => {
    if (!messagesContainerRef.current) return;
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    messagesEndRef.current?.scrollIntoView({ behavior: mode, block: 'end' });
  };

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

  const messages = useMemo(
    () => (roomName ? roomMessages[roomName] || [] : []),
    [roomName, roomMessages]
  );

  useEffect(() => {
    // Reset sticky + initial scroll when switching rooms.
    initialScrollDoneRef.current = false;
    shouldStickToBottomRef.current = true;
    requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottom('auto')));
  }, [roomName]);

  useEffect(() => {
    // On first load of a room, always jump to bottom.
    if (!initialScrollDoneRef.current) {
      scrollToBottom('auto');
      initialScrollDoneRef.current = true;
      return;
    }

    // Only auto-scroll on new messages if user is near bottom.
    if (shouldStickToBottomRef.current) {
      scrollToBottom('auto');
    }
  }, [messages.length]);

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

  const activeUsers = useMemo(() => {
    if (!roomName || !isJoined) return [];
    const others = roomActiveUsers[roomName] || [];
    // Include current user at the top
    return [myUsername, ...others.filter((u) => u !== myUsername)];
  }, [roomName, isJoined, roomActiveUsers, myUsername]);

  if (!roomName) return null;

  if (!room) {
    return (
      <div className="flex h-full items-center justify-center bg-(--bg-primary)">
        <div className="text-center p-8 bg-(--bg-secondary) rounded-md max-w-md border border-(--border) shadow-xl">
          <div className="text-6xl text-(--danger) mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2 text-(--text-normal) tracking-tight">
            {t('room_not_found')}
          </h2>
          <p className="text-(--text-muted) mb-6">
            {t('room_not_exist').replace('{roomName}', roomName)}
          </p>
          <button
            onClick={() => navigate('/rooms')}
            className="bg-(--brand) text-white px-6 py-2.5 rounded-md font-medium transition-all hover:bg-(--brand-hover) shadow-sm"
          >
            {t('back_to_servers')}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col h-full bg-(--bg-primary) text-(--text-normal)">
      {/* Header */}
      <div className="h-16 flex-none border-b border-(--border) flex items-center justify-between px-6 z-10 shadow-sm bg-(--bg-secondary)/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/rooms')}
            className="lg:hidden w-10 h-10 rounded-md flex items-center justify-center hover:bg-(--bg-modifier-hover) hover:text-(--text-normal) text-(--text-muted) transition-colors"
          >
            <ArrowLeft size={24} />
          </button>

          <div 
            className="flex items-center gap-3 cursor-pointer hover:bg-(--bg-modifier-hover) px-2 py-1 rounded-md transition-colors group"
            onClick={() => setShowRoomInfo(true)}
          >
            <div className="w-10 h-10 rounded-md bg-(--bg-tertiary) flex items-center justify-center text-(--brand) shadow-inner group-hover:scale-105 transition-transform">
              <Hash size={24} />
            </div>
            <div>
              <h2 className="font-bold text-[16px] tracking-tight">{room.name}</h2>
              <p className="text-[11px] text-(--text-muted) font-medium">{t('click_for_info')}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isJoined && (
            <button
              onClick={() => setShowActiveUsers(!showActiveUsers)}
              className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors ${
                showActiveUsers 
                  ? 'bg-(--brand)/10 text-(--brand)' 
                  : 'text-(--text-muted) hover:bg-(--bg-modifier-hover) hover:text-(--text-normal)'
              }`}
              title={t('toggle_member_list')}
            >
              <Users size={22} />
            </button>
          )}

          {isJoined ? (
            <button
              onClick={handleLeave}
              className="w-10 h-10 rounded-md flex items-center justify-center text-(--text-muted) hover:bg-(--danger)/10 hover:text-(--danger) transition-colors"
              title={t('leave_room')}
            >
              <LogOut size={24} />
            </button>
          ) : (
            <button
              onClick={handleJoin}
              disabled={!isConnected}
              className="text-sm bg-(--brand) hover:bg-(--brand-hover) text-white font-bold px-4 py-2 rounded-md transition-all shadow-sm disabled:opacity-50"
              data-testid="join-room-button"
            >
              {isConnected ? t('join_room') : status}
            </button>
          )}



          <button
            className="w-10 h-10 rounded-md flex items-center justify-center text-(--text-muted) hover:bg-(--bg-modifier-hover) hover:text-(--text-normal) transition-colors"
            title={t('start_voice_call')}
          >
            <Phone size={24} />
          </button>
          <button
            className="w-10 h-10 rounded-md flex items-center justify-center text-(--text-muted) hover:bg-(--bg-modifier-hover) hover:text-(--text-normal) transition-colors"
            title={t('start_video_call')}
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
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5"
              data-testid="message-list"
              onScroll={() => {
                const el = messagesContainerRef.current;
                if (!el) return;
                const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                shouldStickToBottomRef.current = distanceFromBottom < 120;
              }}
            >
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-(--text-muted) opacity-80">
                <div className="w-24 h-24 bg-(--bg-secondary) rounded-full flex items-center justify-center mb-6 shadow-inner border border-(--border)">
                  <Hash size={48} className="text-(--brand)" />
                </div>
                <h2 className="text-2xl font-bold text-(--text-normal) mb-2 tracking-tight">
                  {t('welcome_to_room')} #{room.name}!
                </h2>
                <p className="text-[15px]">{t('start_of_room')} #{room.name} {t('channel')}</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isSentByMe = msg.sender === myUsername;
                const senderProfile = getUserProfile(msg.sender);

                const senderName = isSentByMe
                  ? t('you')
                  : senderProfile?.username || msg.sender;

                const senderAvatar = isSentByMe
                  ? user?.user_metadata?.avatar_url || localStorage.getItem('aether_avatar')
                  : senderProfile?.avatarUrl;

                if (msg.type === 'system') {
                  return (
                    <div
                      key={msg.id || index}
                      className="flex gap-4 -mx-6 px-6 py-2 hover:bg-(--bg-modifier-hover) transition-colors"
                    >
                      <div className="w-10 shrink-0 flex justify-end items-center">
                        <Info size={20} className="text-(--success)" />
                      </div>
                      <div className="flex-1 text-[14px] text-(--text-muted) font-medium italic">
                        {formatSystemMessage(msg.body)}
                      </div>
                    </div>
                  );
                }

                const showHeader =
                  index === 0 ||
                  messages[index - 1].sender !== msg.sender ||
                  messages[index - 1].type === 'system';

                const isDeleted = msg.body === '\u{1F6AB} This message was deleted';
                const messageBodyToRender = isDeleted ? t('message_deleted') : msg.body;

                return (
                  <div
                    key={msg.id}
                    className={`group flex gap-4 hover:bg-(--bg-modifier-hover) -mx-6 px-6 py-2 transition-colors relative ${!showHeader ? '-mt-4' : ''}`}
                    data-testid="message-item"
                  >
                    {showHeader ? (
                      <div
                        className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-sm mt-0.5 shadow-sm overflow-hidden ${isSentByMe ? 'bg-(--brand)' : 'bg-(--accent)'}`}
                      >
                        {senderAvatar ? (
                          <img
                            src={senderAvatar}
                            alt={senderName}
                            loading="lazy"
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
                          <span className="font-bold text-[15px] text-(--text-normal) flex items-center gap-2">
                            {senderName}
                            {allBots.some(b => b.name === msg.sender) && (
                              <span className="bg-(--brand) text-white text-[10px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
                                <span className="text-[10px]">
                                  {allBots.find(b => b.name === msg.sender)?.emoji || '🤖'}
                                </span>
                                BOT
                              </span>
                            )}
                          </span>
                          <span
                            className="text-[12px] text-(--text-muted) font-medium"
                            data-testid="message-timestamp"
                          >
                            {formatMessageTimestamp(msg.created_at)}
                          </span>
                        </div>
                      )}
                      {isMediaUrl(msg.body) ? (
                        <MediaViewer url={msg.body} />
                      ) : (
                        <div
                          className={`text-[15px] whitespace-pre-wrap wrap-break-word leading-[1.4rem] ${isDeleted ? 'text-(--text-muted) italic' : 'text-(--text-normal)'}`}
                        >
                          {messageBodyToRender}
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
                          className="w-8 h-8 rounded-md bg-(--bg-secondary) border border-(--border) flex items-center justify-center text-(--text-muted) hover:text-(--text-normal) shadow-sm"
                        >
                          <MoreHorizontal size={18} />
                        </button>

                        {activeMenu === msg.id && (
                          <div className="absolute right-0 top-9 z-50 bg-(--bg-tertiary) border border-(--border) rounded-md shadow-2xl py-2 min-w-50 overflow-hidden">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteRoomMessageForMe(roomName, msg.id);
                                setActiveMenu(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-[14px] text-(--text-muted) hover:bg-(--bg-modifier-hover) flex items-center gap-3"
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
                                className="w-full text-left px-4 py-2.5 text-[14px] text-(--danger) hover:bg-(--danger)/10 flex items-center gap-3"
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
                        className="w-5 h-5 rounded-full bg-(--brand) flex items-center justify-center text-[8px] text-white font-bold border-2 border-(--bg-primary) overflow-hidden"
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
                  <span className="w-1.5 h-1.5 bg-(--text-muted) rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-(--text-muted) rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-(--text-muted) rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[12px] text-(--text-muted) font-medium">
                  {Object.keys(roomTypingUsers[roomName]).length === 1
                    ? `${Object.keys(roomTypingUsers[roomName])[0]} ${t('typing')}`
                    : `${Object.keys(roomTypingUsers[roomName]).length} ${t('people_typing')}`}
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="px-6 pb-6 pt-2 relative">
            {showEmojiPicker && (
              <div
                className="absolute bottom-[80px] right-6 z-50 shadow-2xl rounded-md overflow-hidden border border-(--border)"
                data-testid="emoji-picker"
              >
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
              <div className="mb-3 flex flex-wrap gap-3 p-3 bg-(--bg-secondary) border border-(--border) rounded-md">
                {stagedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="relative group/staged w-20 h-20 rounded-md overflow-hidden border border-(--border) bg-(--bg-tertiary) flex items-center justify-center"
                  >
                    {file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : file.type.startsWith('video/') ? (
                      <Image size={32} className="text-(--text-muted)" />
                    ) : (
                      <FileText size={32} className="text-(--text-muted)" />
                    )}
                    <button
                      onClick={() => removeStagedFile(index)}
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-(--danger) text-white flex items-center justify-center opacity-0 group-hover/staged:opacity-100 transition-opacity shadow-md"
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

            <div className="flex items-center gap-3 bg-(--bg-secondary) border border-(--border)/50 rounded-md p-2 shadow-sm focus-within:border-(--brand)/50 focus-within:ring-1 focus-within:ring-(--brand)/20 transition-all">
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
                className={`w-10 h-10 rounded-md bg-(--bg-tertiary) text-(--text-muted) flex items-center justify-center hover:bg-(--brand) hover:text-white transition-all ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isUploading ? <Loader2 size={22} className="animate-spin" /> : <Plus size={22} />}
              </button>

              <input
                className="flex-1 bg-transparent border-none outline-none text-(--text-normal) placeholder:text-(--text-muted) text-[15px] px-2"
                placeholder={t('message_placeholder') + `#${room.name}`}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSend(e as unknown as React.FormEvent);
                  }
                }}
                disabled={isUploading}
                data-testid="message-input"
              />

              <div className="flex items-center gap-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-10 h-10 rounded-md flex items-center justify-center text-(--text-muted) hover:bg-(--bg-tertiary) hover:text-(--brand) transition-colors"
                >
                  <Image size={24} />
                </button>
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors ${showEmojiPicker ? 'bg-(--brand) text-white' : 'text-(--text-muted) hover:bg-(--bg-tertiary) hover:text-(--brand)'}`}
                  data-testid="emoji-button"
                >
                  <Smile size={24} />
                </button>
                {(input.trim() || stagedFiles.length > 0) && (
                  <button
                    onClick={() => handleSend()}
                    disabled={isUploading}
                    className="w-10 h-10 rounded-md bg-(--brand) text-white flex items-center justify-center hover:bg-(--brand-hover) transition-colors shadow-sm"
                    data-testid="send-button"
                  >
                    <Send size={22} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>


          {/* Active Users Sidebar */}
          {showActiveUsers && (
            <div 
              style={{ width: `${sidebarWidth}px` }}
              className="bg-(--bg-secondary) border-l border-(--border) flex flex-col shrink-0 animate-in slide-in-from-right duration-300 relative group/sidebar"
            >
              {/* Resize Handle */}
              <div
                onMouseDown={startResizing}
                className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-(--brand)/30 active:bg-(--brand) transition-colors z-50"
              />

              <div className="h-14 flex items-center px-4 border-b border-(--border)">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-(--text-muted)" />
                  <span className="text-[13px] font-bold text-(--text-muted) uppercase tracking-wider">
                    {t('active_now')}
                  </span>
                  <span className="ml-1 bg-(--brand) text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {activeUsers.length}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {activeUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[13px] text-(--text-muted) italic">{t('no_active_users')}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {activeUsers.map((nickname) => {
                      const profile = getUserProfile(nickname);
                      const displayName = profile?.username || nickname;
                      const avatarUrl = profile?.avatarUrl;
                      const isOnline = nickname === myUsername ? isConnected : profile?.online;

                      return (
                        <div
                          key={nickname}
                          className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-(--bg-modifier-hover) transition-colors"
                        >
                          <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-(--brand) flex items-center justify-center text-white font-bold text-sm overflow-hidden">
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
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-[2px] border-(--bg-secondary) ${
                                isOnline ? 'bg-(--status-online)' : 'bg-(--status-dnd)'
                              }`}
                            />
                          </div>
                          <span className="text-[14px] font-medium text-(--text-normal) truncate">
                            {displayName} {nickname === myUsername && <span className="text-[11px] font-medium text-(--text-muted) ml-1">(You)</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}


              {/* Bots Section */}
              {roomName && (() => {
                const activeBots = getBotsForRoom(roomName);
                if (activeBots.length === 0) return null;
                return (
                  <>
                    <div className="mx-2 my-3 h-[1px] bg-(--border) opacity-60" />
                    <div className="px-2 mb-2 flex items-center gap-1.5">
                      <Bot size={13} className="text-(--text-muted)" />
                      <span className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider">
                        Bots — {activeBots.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {activeBots.map((bot) => (
                        <div
                          key={bot.id}
                          className={`flex items-center gap-3 px-2 py-2 rounded-md hover:bg-(--bg-modifier-hover) transition-colors ${
                            !bot.isOnline ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-(--brand)/15 flex items-center justify-center text-lg shrink-0">
                              {bot.emoji}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-[2px] border-(--bg-secondary) ${
                              bot.isOnline ? 'bg-(--status-online) shadow-[0_0_4px_var(--status-online)]' : 'bg-(--text-muted)'
                            }`} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[13px] font-medium text-(--text-normal) truncate block">
                              {bot.name}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${
                              bot.isOnline ? 'text-(--brand)' : 'text-(--text-muted)'
                            }`}>
                              {bot.isOnline ? t('bot_online') : t('bot_offline')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-(--text-muted)">
          <div className="w-24 h-24 bg-(--bg-secondary) rounded-full flex items-center justify-center mb-6 text-(--text-normal) shadow-inner border border-(--border)">
            <Lock size={48} />
          </div>
          <h3 className="text-2xl font-bold text-(--text-normal) mb-2 tracking-tight">
            {t('you_havent_joined')}
          </h3>
          <p className="mb-8 text-center max-w-md text-[15px] leading-relaxed">
            {t('join_room_message').replace('{roomName}', room.name)}
          </p>
          <button
            onClick={handleJoin}
            disabled={!isConnected}
            className="px-8 py-3.5 font-bold text-white bg-(--brand) hover:bg-(--brand-hover) rounded-md transition-all shadow-md disabled:opacity-50 text-[16px]"
            data-testid="join-room-button"
          >
            {isConnected ? `Join #${room.name}` : status}
          </button>
        </div>
      )}
      {/* ── Room Info Modal ── */}
      {showRoomInfo && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
          onClick={() => setShowRoomInfo(false)}
        >
          <div 
            className="w-full max-w-md bg-(--bg-primary) rounded-md border border-(--border) shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-(--border) flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-(--bg-secondary) flex items-center justify-center text-(--brand)">
                  <Hash size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-(--text-normal) tracking-tight">#{room.name}</h2>
                  <p className="text-[11px] text-(--text-muted) font-medium">{t('room_information')}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowRoomInfo(false)}
                className="w-8 h-8 rounded-md hover:bg-(--bg-secondary) text-(--text-muted) flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-[11px] font-bold text-(--text-muted) uppercase tracking-widest mb-3">{t('about')}</h3>
                <p className="text-[14px] text-(--text-normal) leading-relaxed">
                  {room.description || t('no_description_available')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-(--bg-secondary)/50 rounded-md border border-(--border)/50">
                  <div className="flex items-center gap-2 text-(--text-muted) mb-1">
                    <Users size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{t('members')}</span>
                  </div>
                  <p className="text-lg font-bold text-(--text-normal)">{activeUsers.length}</p>
                </div>
                <div className="p-4 bg-(--bg-secondary)/50 rounded-md border border-(--border)/50">
                  <div className="flex items-center gap-2 text-(--text-muted) mb-1">
                    <Star size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{t('created')}</span>
                  </div>
                  <p className="text-[14px] font-bold text-(--text-normal)">
                    {new Date(room.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2 text-[12px] text-(--text-muted)">
                <span className="w-1.5 h-1.5 rounded-full bg-(--brand) animate-pulse" />
                <span>{t('created')} <span className="font-semibold text-(--text-normal)">{new Date(room.created_at).toLocaleDateString()}</span></span>
              </div>
            </div>

            <div className="p-4 bg-(--bg-secondary)/30 border-t border-(--border) flex justify-end">
              <button
                onClick={() => setShowRoomInfo(false)}
                className="px-5 py-2 bg-(--bg-secondary) hover:bg-(--bg-modifier-hover) text-(--text-normal) font-bold text-[13px] rounded-md border border-(--border) transition-all"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

