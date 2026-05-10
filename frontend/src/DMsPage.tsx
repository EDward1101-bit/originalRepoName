import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useChatContext,
  type Friendship,
  type RegisteredUser,
  type ChatMessage,
} from './ChatContext';
import { formatMessageTimestamp } from './utils/time';
import { supabase } from './supabase';
import { useTranslation } from './LanguageContext';
import { MessageSquare, Inbox, Check, X, UserPlus, Users, UserMinus, Search, Loader2, Pencil } from 'lucide-react';

export default function DMsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    allUsers,
    friendships,
    myUserId,
    messages,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriendship,
    typingUsers,
    unreadCounts,
  } = useChatContext();

  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [requestSent, setRequestSent] = useState<string | null>(null);

  // Keyed by the friend's UUID so lookups are correct even when display names collide
  const relationshipsByUserId = useMemo(() => {
    const map = new Map<string, Friendship>();
    friendships.forEach((friendship: Friendship) => {
      if (friendship.requester_id === myUserId) {
        map.set(friendship.receiver_id, friendship);
      } else if (friendship.receiver_id === myUserId) {
        map.set(friendship.requester_id, friendship);
      }
    });
    return map;
  }, [friendships, myUserId]);

  const acceptedFriends = useMemo(
    () =>
      allUsers.filter((u: RegisteredUser) => {
        if (u.id === myUserId) return false;
        return relationshipsByUserId.get(u.id)?.status === 'accepted';
      }),
    [allUsers, myUserId, relationshipsByUserId]
  );

  const pendingReceived = useMemo(
    () =>
      friendships.filter((f: Friendship) => f.status === 'pending' && f.receiver_id === myUserId),
    [friendships, myUserId]
  );

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced Optimized Supabase Search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const debounceId = setTimeout(async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, email, avatar_url')
        .ilike('username', `%${q}%`)
        .limit(10);

      if (!error && data) {
        // Deduplicate by user ID (the true unique key)
        const uniqueUsers = Array.from(new Map(data.map((u: any) => [u.id, u])).values());

        setSearchResults(
          uniqueUsers
            .filter((u: any) => u.id !== myUserId)
            .map((u: any) => ({
              id: u.id,
              username: u.username,
              xmppUsername: u.email?.split('@')[0] || u.username,
              avatarUrl: u.avatar_url,
              online: false,
              relationship: relationshipsByUserId.get(u.id) ?? null,
            }))
        );
      }
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(debounceId);
  }, [searchQuery, myUserId, relationshipsByUserId]);

  // Get last message for a friend using their stable XMPP username (the otherParty key)
  const getLastMessage = (xmppUsername: string) => {
    const userMessages = messages.filter((m: ChatMessage) => m.otherParty === xmppUsername);
    if (userMessages.length === 0) return null;
    return userMessages[userMessages.length - 1];
  };

  // Sort friends by most recent message
  const sortedFriends = useMemo(() => {
    return [...acceptedFriends].sort((a, b) => {
      const lastA = getLastMessage(a.xmppUsername);
      const lastB = getLastMessage(b.xmppUsername);
      if (!lastA && !lastB) return 0;
      if (!lastA) return 1;
      if (!lastB) return -1;
      return lastB.time.getTime() - lastA.time.getTime();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptedFriends, messages]);

  const handleSendRequest = async (userId: string) => {
    await sendFriendRequest(userId);
    setRequestSent(userId);
    setTimeout(() => setRequestSent(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-normal)]">
      {/* Header */}
      <header className="h-16 flex items-center px-6 border-b border-[var(--border)] shrink-0 z-10 shadow-sm bg-[var(--bg-secondary)]/50 backdrop-blur-sm">
        <div className="flex items-center gap-4 flex-1">
          <MessageSquare size={28} className="text-[var(--brand)]" />
          <h1 className="text-[18px] font-bold tracking-tight">{t('messages')}</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Friend Requests Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowRequests(!showRequests)}
              className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                showRequests || pendingReceived.length > 0
                  ? 'text-[var(--brand)] bg-[var(--brand)]/10 hover:bg-[var(--brand)]/20'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-normal)] hover:bg-[var(--bg-modifier-hover)]'
              }`}
              title={t('friend_requests')}
            >
              <Inbox size={24} />
              {pendingReceived.length > 0 && (
                <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--bg-secondary)]" />
              )}
            </button>

            {showRequests && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowRequests(false)} />
                <div className="absolute right-0 top-14 w-80 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-xl z-50 flex flex-col overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-tertiary)] flex justify-between items-center">
                    <h3 className="font-bold text-[15px] text-[var(--text-normal)]">
                      {t('friend_requests')}
                    </h3>
                    <span className="bg-[var(--brand)] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {pendingReceived.length}
                    </span>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto">
                    {pendingReceived.length === 0 ? (
                      <div className="p-6 flex flex-col items-center justify-center text-[var(--text-muted)] text-center">
                        <Inbox size={40} className="mb-2 opacity-50 text-[var(--brand)]" />
                        <p className="text-sm font-medium">{t('no_pending_requests')}</p>
                      </div>
                    ) : (
                      pendingReceived.map((f: Friendship) => (
                        <div
                          key={f.id}
                          className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]/50 hover:bg-[var(--bg-modifier-hover)] transition-colors last:border-0"
                        >
                          <div className="w-10 h-10 shrink-0 rounded-full bg-[var(--brand)] text-white flex items-center justify-center font-bold text-[15px] shadow-sm">
                            {allUsers.find((u) => u.id === f.requester_id)?.username?.[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[14px] font-bold text-[var(--text-normal)] truncate block">
                              {allUsers.find((u) => u.id === f.requester_id)?.username ?? f.requester_id}
                            </span>
                            <span className="text-[12px] text-[var(--text-muted)]">
                              {t('wants_to_be_friends')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                acceptFriendRequest(f.id);
                                if (pendingReceived.length === 1) setShowRequests(false);
                              }}
                              className="w-8 h-8 rounded-lg bg-[#10b981] text-white flex items-center justify-center hover:bg-[#059669] transition-colors shadow-sm"
                              title={t('accept')}
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => {
                                removeFriendship(f.id);
                                if (pendingReceived.length === 1) setShowRequests(false);
                              }}
                              className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] flex items-center justify-center hover:bg-[#ef4444] hover:text-white transition-colors border border-[var(--border)]"
                              title={t('decline')}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setShowAddFriend(true)}
            className="flex items-center gap-2 bg-[var(--brand)] text-white px-4 py-2.5 rounded-xl font-bold text-[14px] hover:bg-[var(--brand-hover)] transition-colors shadow-sm"
          >
            <UserPlus size={20} />
            {t('add_friend')}
          </button>
        </div>
      </header>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {sortedFriends.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
            <div className="w-24 h-24 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-6 shadow-inner border border-[var(--border)]">
              <Users size={48} className="text-[var(--brand)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-normal)] mb-2 tracking-tight">
              {t('no_conversations')}
            </h2>
            <p className="text-[15px] mb-6">
              {t('add_friend_to_chat')}
            </p>
            <button
              onClick={() => setShowAddFriend(true)}
              className="bg-[var(--brand)] text-white px-6 py-3 rounded-xl font-bold hover:bg-[var(--brand-hover)] transition-colors shadow-sm"
            >
              {t('add_first_friend')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            {sortedFriends.map((u: RegisteredUser) => {
              const lastMsg = getLastMessage(u.xmppUsername);
              const rel = relationshipsByUserId.get(u.id) ?? null;
              const unreadCount = unreadCounts[u.xmppUsername] || 0;
              const hasUnread = unreadCount > 0;

              return (
                <div
                  key={u.id}
                  onClick={() => navigate(`/dms/${u.xmppUsername}`)}
                  className={`flex items-center gap-4 px-6 py-4 cursor-pointer transition-all border-b border-[var(--border)]/30 ${
                    hasUnread
                      ? 'bg-[var(--brand)]/[0.06] hover:bg-[var(--brand)]/[0.10]'
                      : 'hover:bg-[var(--bg-modifier-hover)]'
                  }`}
                >
                  <div className="relative flex-shrink-0 w-12 h-12">
                    <div className="w-full h-full rounded-full overflow-hidden shadow-sm">
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt={`${u.username}'s avatar`}
                          className="w-full h-full object-cover bg-[var(--bg-tertiary)]"
                        />
                      ) : (
                        <div className="w-full h-full bg-[var(--brand)] text-white flex items-center justify-center font-bold text-lg">
                          {u.username[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-[2.5px] border-[var(--bg-primary)] z-10 ${u.online ? 'bg-[#10b981]' : 'bg-[#9ca3af]'}`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold text-[16px] ${hasUnread ? 'text-[var(--text-normal)]' : 'text-[var(--text-normal)]'}`}>
                        {u.username}
                      </span>
                      {lastMsg && (
                        <span className="text-[12px] text-[var(--text-muted)] font-medium flex-shrink-0 ml-2">
                          {formatMessageTimestamp(lastMsg.time)}
                        </span>
                      )}
                    </div>
                    <p className={`text-[14px] truncate ${
                      typingUsers[u.xmppUsername]
                        ? 'text-[var(--brand)] font-medium italic'
                        : hasUnread
                          ? 'text-[var(--text-normal)] font-semibold'
                          : 'text-[var(--text-muted)]'
                    }`}>
                      {typingUsers[u.xmppUsername] ? (
                        <span className="flex items-center gap-1">
                          <Pencil size={12} className="animate-pulse" />
                          {t('typing')}
                        </span>
                      ) : lastMsg
                        ? lastMsg.body === '🚫 This message was deleted'
                          ? <span className="text-[#ef4444]">{t('message_deleted')}</span>
                          : lastMsg.body.includes('chat-media')
                            ? t('attachment')
                            : lastMsg.body
                        : t('no_messages_yet')}
                    </p>
                  </div>

                  <div className="flex gap-2 flex-shrink-0 items-center">
                    {hasUnread && (
                      <div className="min-w-[22px] h-[22px] bg-[var(--brand)] text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1.5 shadow-sm">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </div>
                    )}
                                        <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (rel && confirm(`Remove ${u.username} from your friends?`)) {
                          removeFriendship(rel.id);
                        }
                      }}
                      className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-muted)] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
                    >
                      <UserMinus size={22} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Friend Modal (centered popup) */}
      {showAddFriend && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            setShowAddFriend(false);
            setSearchQuery('');
          }}
        >
          <div
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
              <div>
                <h2 className="text-[20px] font-bold tracking-tight">
                  {t('add_friend')}
                </h2>
                <p className="text-[14px] text-[var(--text-muted)] mt-1">
                  {t('search_for_users')}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddFriend(false);
                  setSearchQuery('');
                }}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Input */}
            <div className="px-6 py-4">
              <div className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center gap-3 focus-within:border-[var(--brand)] transition-colors">
                <Search size={22} className="text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder={t('search_users')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="flex-1 bg-transparent border-none outline-none text-[var(--text-normal)] placeholder:text-[var(--text-muted)] text-[15px]"
                />
              </div>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {!searchQuery.trim() ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
                  <Search size={60} className="mb-4 opacity-30" />
                  <p className="text-[15px]">Start typing to search for users</p>
                </div>
              ) : isSearching ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
                  <Loader2 size={60} className="mb-4 opacity-30 animate-spin" />
                  <p className="text-[15px]">Searching...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
                  <Search size={60} className="mb-4 opacity-30" />
                  <p className="text-[15px]">No users found matching &quot;{searchQuery}&quot;</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {searchResults.map((u: any) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border)]/50 hover:bg-[var(--bg-modifier-hover)] transition-colors relative"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0 w-12 h-12">
                          <div className="w-full h-full rounded-full overflow-hidden shadow-sm">
                            {u.avatarUrl ? (
                              <img
                                src={u.avatarUrl}
                                alt={`${u.username}'s avatar`}
                                className="w-full h-full object-cover bg-[var(--bg-tertiary)]"
                              />
                            ) : (
                              <div className="w-full h-full bg-[var(--brand)] flex items-center justify-center font-bold text-white text-lg">
                                {u.username[0].toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[2.5px] border-[var(--bg-tertiary)] z-10 ${u.online ? 'bg-[#10b981]' : 'bg-[#9ca3af]'}`}
                          />
                        </div>
                        <div>
                          <span className="font-bold text-[16px] block">{u.username}</span>
                          <span className="text-[13px] text-[var(--text-muted)]">
                            {u.online ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                      <div>
                        {!u.relationship ? (
                          <button
                            onClick={() => handleSendRequest(u.id)}
                            className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm ${
                              requestSent === u.id
                                ? 'bg-[#10b981] text-white'
                                : 'bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]'
                            }`}
                          >
                            {requestSent === u.id ? 'Sent!' : 'Add Friend'}
                          </button>
                        ) : u.relationship.status === 'pending' ? (
                          u.relationship.receiver_id === myUserId ? (
                            <button
                              onClick={() => acceptFriendRequest(u.relationship!.id)}
                              className="px-5 py-2.5 bg-[#10b981] text-white text-sm font-bold rounded-xl hover:bg-[#059669] transition-colors shadow-sm"
                            >
                              Accept
                            </button>
                          ) : (
                            <span className="px-5 py-2.5 bg-[var(--bg-modifier-active)] text-[var(--text-muted)] text-sm font-bold rounded-xl inline-block">
                              Pending
                            </span>
                          )
                        ) : (
                          <span className="px-5 py-2.5 text-[var(--text-muted)] text-sm font-bold border border-[var(--border)] rounded-xl inline-block">
                            Friends ✓
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
