import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useChatContext } from './ChatContext';
import { useAuth } from './AuthContext';
import { useTranslation } from './LanguageContext';
import { formatMessageTimestamp } from './utils/time';
import MediaViewer from './components/MediaViewer';
import MessageBody from './components/MessageBody';
import { supabase } from './supabase';
import EmojiPicker from 'emoji-picker-react';
import { Phone, Video, MessageSquare, MoreHorizontal, Edit2, EyeOff, Trash2, Image, FileText, X, Plus, Smile, Send, Loader2, Star } from 'lucide-react';

export default function Chat() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const {
    messages,
    getUserProfile,
    sendMessage,
    myUsername,
    deleteMessageForEveryone,
    deleteMessageForMe,
    editMessage,
    typingUsers,
    sendTypingIndicator,
    clearUnread,
    setCurrentChat,
  } = useChatContext();
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shouldStickToBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);

  const scrollToBottom = (mode: 'auto' | 'smooth' = 'auto') => {
    if (!messagesContainerRef.current) return;
    // Jump via scrollTop to avoid long smooth scroll for huge histories.
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    // Ensure the last message is visible even with dynamic content height.
    messagesEndRef.current?.scrollIntoView({ behavior: mode, block: 'end' });
  };

  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);

    if (!isTyping) {
      setIsTyping(true);
      sendTypingIndicator(recipient, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(recipient, false);
    }, 3000);
  };

  const recipient = username || '';
  const recipientProfile = getUserProfile(recipient);
  const displayName = recipientProfile?.username || recipient;
  const avatarUrl = recipientProfile?.avatarUrl;
  const isOnline = recipientProfile?.online ?? false;

  // Register this chat as the active view — suppresses notifications while open
  useEffect(() => {
    if (!recipient) return;
    setCurrentChat(recipient);
    clearUnread(recipient);
    return () => {
      setCurrentChat(null);
    };
  }, [recipient, setCurrentChat, clearUnread]);

  // Favorites from Supabase
  const [favoriteId, setFavoriteId] = useState<string | null>(null);

  // Check if this DM is favorited
  useEffect(() => {
    if (!user || !recipient) return;
    const checkFavorite = async () => {
      const { data } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'dm')
        .eq('name', recipient)
        .single();
      if (data) {
        setFavoriteId(data.id);
      } else {
        setFavoriteId(null);
      }
    };
    checkFavorite();
  }, [user, recipient]);

  const toggleFavorite = async () => {
    if (!user || !recipient) return;
    if (favoriteId) {
      // Remove from favorites
      await supabase.from('favorites').delete().eq('id', favoriteId);
      setFavoriteId(null);
    } else {
      // Add to favorites
      const { data } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, type: 'dm', name: recipient })
        .select('id')
        .single();
      if (data) {
        setFavoriteId(data.id);
      }
    }
  };
  const isFavorite = !!favoriteId;

  const filteredMessages = useMemo(
    () => (recipient ? messages.filter((m) => m.otherParty === recipient) : []),
    [messages, recipient]
  );

  useEffect(() => {
    // Reset sticky + initial scroll when switching conversations.
    initialScrollDoneRef.current = false;
    shouldStickToBottomRef.current = true;
    // Let the DOM paint, then jump to bottom.
    requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottom('auto')));
  }, [recipient]);

  useEffect(() => {
    if (isTyping) {
      setIsTyping(false);
      sendTypingIndicator(recipient, false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }

    // On first load of a conversation, always jump to bottom.
    if (!initialScrollDoneRef.current) {
      scrollToBottom('auto');
      initialScrollDoneRef.current = true;
      return;
    }

    // On new messages, only auto-scroll if user is already near bottom.
    if (shouldStickToBottomRef.current) {
      scrollToBottom('auto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredMessages.length]);

  const handleSend = async () => {
    if (!recipient) return;
    if (!input.trim() && stagedFiles.length === 0) return;

    setShowEmojiPicker(false);

    // Upload all staged files first
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
          await sendMessage(recipient, url);
        }
      }
      setStagedFiles([]);
    }

    // Send text message if any
    if (input.trim()) {
      await sendMessage(recipient, input);
      setInput('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setStagedFiles((prev) => [...prev, ...Array.from(files)]);
    // Reset the input so the same file can be selected again
    e.target.value = '';
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const isMediaUrl = (text: string) => {
    return text.startsWith('http') && text.includes('supabase') && text.includes('chat-media');
  };

  const handleStartEdit = (msgId: string, currentBody: string) => {
    setEditingId(msgId);
    setEditText(currentBody);
    setActiveMenu(null);
  };

  const handleSaveEdit = async () => {
    if (editingId && editText.trim()) {
      await editMessage(editingId, editText);
      setEditingId(null);
      setEditText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Chat Header */}
      <header className="h-16 flex items-center px-6 border-b border-[var(--border)] flex-shrink-0 z-10 shadow-sm bg-[var(--bg-secondary)]/50 backdrop-blur-sm">
                <div className="flex items-center gap-4">
          <div className="relative w-10 h-10">
            <div className="w-full h-full rounded-full bg-[var(--brand)] text-white flex items-center justify-center font-bold text-lg shadow-inner overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                recipient[0]?.toUpperCase()
              )}
            </div>
            <div
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[var(--bg-secondary)] z-10 ${isOnline ? 'bg-[var(--status-online)]' : 'bg-[var(--status-offline)]'}`}
            />
          </div>
          <div>
            <h1 className="text-[16px] font-bold text-[var(--text-normal)] tracking-tight">
              {displayName}
            </h1>
            <p className="text-[13px] text-[var(--text-muted)] font-medium">
              {isOnline ? t('online') : t('offline')}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleFavorite}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              isFavorite
                ? 'bg-[var(--warning)]/10 text-[var(--warning)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)]'
            }`}
            title={isFavorite ? t('remove_from_favorites') : t('add_to_favorites')}
          >
            <Star size={20} fill={favoriteId ? 'var(--warning)' : 'none'} />
          </button>
          <button
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-colors"
            title={t('start_voice_call')}
          >
            <Phone size={24} />
          </button>
          <button
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-colors"
            title={t('start_video_call')}
          >
            <Video size={24} />
          </button>
        </div>
      </header>

      {/* Message Feed */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5"
        onClick={() => setActiveMenu(null)}
        onScroll={() => {
          const el = messagesContainerRef.current;
          if (!el) return;
          const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
          shouldStickToBottomRef.current = distanceFromBottom < 120;
        }}
      >
        {filteredMessages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] opacity-80">
            <div className="w-24 h-24 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-6 shadow-inner border border-[var(--border)]">
              <MessageSquare size={48} className="text-[var(--brand)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-normal)] mb-2 tracking-tight">
              {t('say_hello')} {recipient}!
            </h2>
            <p className="text-[15px]">{t('beginning_of_dm')}</p>
          </div>
        ) : (
          filteredMessages.map((msg, index) => {
            const isSent = msg.type === 'sent';
            const showHeader = index === 0 || filteredMessages[index - 1].from !== msg.from;
            const senderProfile = getUserProfile(msg.from);

            // Always show 'You' for own messages
            const senderName = isSent
              ? t('you')
              : senderProfile?.username || msg.from;

            const senderAvatar = isSent
              ? user?.user_metadata?.avatar_url || localStorage.getItem('aether_avatar')
              : senderProfile?.avatarUrl;

            const isDeleted = msg.body === '\u{1F6AB} This message was deleted';
            const messageBodyToRender = isDeleted ? t('message_deleted') : msg.body;
            const canEdit =
              isSent && !isDeleted && Date.now() - msg.time.getTime() < 15 * 60 * 1000;

            return (
              <div
                key={msg.id}
                className={`group flex gap-4 hover:bg-[var(--bg-modifier-hover)] -mx-6 px-6 py-2 transition-colors relative ${!showHeader ? 'mt-[-16px]' : ''}`}
              >
                {showHeader ? (
                  <div className="w-10 h-10 shrink-0 rounded-full bg-[var(--brand)] flex items-center justify-center text-white font-bold text-sm mt-0.5 shadow-sm overflow-hidden">
                    {senderAvatar ? (
                      <img
                        src={senderAvatar}
                        alt={senderName}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (isSent ? myUsername : msg.from)[0]?.toUpperCase()
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
                        {formatMessageTimestamp(msg.time)}
                      </span>
                    </div>
                  )}

                  {editingId === msg.id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className="bg-[var(--bg-secondary)] border border-[var(--brand)] rounded-xl px-4 py-2 text-[var(--text-normal)] text-[15px] outline-none"
                        autoFocus
                      />
                      <div className="flex gap-2 text-[13px]">
                        <button
                          onClick={handleSaveEdit}
                          className="text-[var(--brand)] font-medium hover:underline"
                        >
                          {t('save_changes')}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-[var(--text-muted)] hover:underline"
                        >
                          {t('discard_changes')}
                        </button>
                        <span className="text-[var(--text-muted)]">
                          (press Enter to save, Esc to cancel)
                        </span>
                      </div>
                    </div>
                  ) : isMediaUrl(msg.body) ? (
                    <MediaViewer url={msg.body} />
                  ) : (
                    <MessageBody body={messageBodyToRender} isDeleted={isDeleted} />
                  )}
                </div>

                {/* Message Actions Button */}
                {!isDeleted && !editingId && (
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
                        {isSent && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canEdit) handleStartEdit(msg.id, msg.body);
                            }}
                            disabled={!canEdit}
                            title={canEdit ? undefined : 'Messages can only be edited within 15 minutes of sending'}
                            className="w-full text-left px-4 py-2.5 text-[14px] text-[var(--text-normal)] hover:bg-[var(--bg-modifier-hover)] flex items-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Edit2 size={18} />
                            Edit Message
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMessageForMe(msg.id);
                            setActiveMenu(null);
                          }}
                          className="w-full text-left px-4 py-2.5 text-[14px] text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] flex items-center gap-3"
                        >
                          <EyeOff size={18} />
                          Delete for Me
                        </button>
                        {isSent && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMessageForEveryone(msg.id);
                              setActiveMenu(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-[14px] text-[var(--danger)] hover:bg-[var(--danger)]/10 flex items-center gap-3"
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

        {typingUsers[recipient] && (
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="flex gap-1">
              <span
                className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              ></span>
              <span
                className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              ></span>
              <span
                className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              ></span>
            </div>
            <span className="text-[12px] text-[var(--text-muted)] font-medium">
              {recipientProfile?.username || recipient} {t('typing')}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composition Area */}
      <footer className="px-6 pb-6 pt-2 relative">
        {showEmojiPicker && (
          <div className="absolute bottom-[80px] right-6 z-50 shadow-2xl rounded-2xl overflow-hidden border border-[var(--border)]">
            <EmojiPicker
              onEmojiClick={(emojiData) => setInput((prev) => prev + emojiData.emoji)}
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
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[var(--danger)] text-white flex items-center justify-center opacity-0 group-hover/staged:opacity-100 transition-opacity shadow-md"
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
            placeholder={t('message_placeholder') + recipient}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
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
                onClick={handleSend}
                disabled={isUploading}
                className="w-10 h-10 rounded-xl bg-[var(--brand)] text-white flex items-center justify-center hover:bg-[var(--brand-hover)] transition-colors shadow-sm"
              >
                <Send size={22} />
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
