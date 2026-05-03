import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatContext, type Friendship } from './ChatContext';
import { formatMessageTimestamp } from './utils/time';
import { supabase } from './supabase';
import { useTranslation } from './LanguageContext';

export default function DMsPage() {
  const { t } = useTranslation();
  const {
    allUsers,
    friendships,
    myUsername,
    messages,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriendship,
  } = useChatContext();
  const navigate = useNavigate();

  const [showAddFriend, setShowAddFriend] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [requestSent, setRequestSent] = useState<string | null>(null);

  const relationshipsByUsername = useMemo(() => {
    const map = new Map<string, Friendship>();
    friendships.forEach((friendship) => {
      if (friendship.requester === myUsername) {
        map.set(friendship.receiver, friendship);
      } else if (friendship.receiver === myUsername) {
        map.set(friendship.requester, friendship);
      }
    });
    return map;
  }, [friendships, myUsername]);

  const acceptedFriends = useMemo(
    () =>
      allUsers.filter((u) => {
        if (u.username === myUsername) return false;
        return relationshipsByUsername.get(u.username)?.status === 'accepted';
      }),
    [allUsers, myUsername, relationshipsByUsername]
  );

  const pendingReceived = useMemo(
    () => friendships.filter((f) => f.status === 'pending' && f.receiver === myUsername),
    [friendships, myUsername]
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
        .select('username, full_name, avatar_url')
        .ilike('username', `%${q}%`)
        .limit(10);

      if (!error && data) {
        // Remove duplicates by username in case the DB has any redundant records
        const uniqueUsers = Array.from(new Map(data.map((u: any) => [u.username, u])).values());
        
        setSearchResults(
          uniqueUsers
            .filter((u: any) => u.username !== myUsername)
            .map((u: any) => ({
              username: u.username,
              displayName: u.full_name || u.username,
              avatarUrl: u.avatar_url,
              online: false,
              relationship: relationshipsByUsername.get(u.username) ?? null,
            }))
        );
      }
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(debounceId);
  }, [searchQuery, myUsername, relationshipsByUsername]);

  // Get last message for each friend (for conversation list preview)
  const getLastMessage = (username: string) => {
    const userMessages = messages.filter((m) => m.otherParty === username);
    if (userMessages.length === 0) return null;
    return userMessages[userMessages.length - 1];
  };

  // Sort friends by most recent message
  const sortedFriends = useMemo(() => {
    return [...acceptedFriends].sort((a, b) => {
      const lastA = getLastMessage(a.username);
      const lastB = getLastMessage(b.username);
      if (!lastA && !lastB) return 0;
      if (!lastA) return 1;
      if (!lastB) return -1;
      return lastB.time.getTime() - lastA.time.getTime();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptedFriends, messages]);

  const handleSendRequest = async (username: string) => {
    await sendFriendRequest(username);
    setRequestSent(username);
    setTimeout(() => setRequestSent(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-normal)]">
      {/* Header */}
      <header className="h-16 flex items-center px-6 border-b border-[var(--border)] shrink-0 z-10 shadow-sm bg-[var(--bg-secondary)]/50 backdrop-blur-sm">
        <div className="flex items-center gap-4 flex-1">
          <span className="material-symbols-outlined text-[var(--brand)] text-[28px]">chat</span>
          <h1 className="text-[18px] font-bold tracking-tight">{t('messages') || 'Messages'}</h1>
        </div>

        <div className="flex items-center gap-2">
          {pendingReceived.length > 0 && (
            <div className="flex items-center gap-2 mr-2">
              {pendingReceived.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-[#8b5cf6] text-white flex items-center justify-center font-bold text-sm">
                    {f.requester[0].toUpperCase()}
                  </div>
                  <span className="text-[13px] font-medium text-[var(--text-normal)]">
                    {f.requester}
                  </span>
                  <button
                    onClick={() => acceptFriendRequest(f.id)}
                    className="w-7 h-7 rounded-lg bg-[#10b981] text-white flex items-center justify-center hover:bg-[#059669] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  </button>
                  <button
                    onClick={() => removeFriendship(f.id)}
                    className="w-7 h-7 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] flex items-center justify-center hover:bg-[#ef4444] hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowAddFriend(true)}
            className="flex items-center gap-2 bg-[var(--brand)] text-white px-4 py-2.5 rounded-xl font-bold text-[14px] hover:bg-[var(--brand-hover)] transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            {t('add_friend') || 'Add Friend'}
          </button>
        </div>
      </header>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {sortedFriends.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
            <div className="w-24 h-24 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-6 shadow-inner border border-[var(--border)]">
              <span className="material-symbols-outlined text-5xl text-[var(--brand)]">
                group_add
              </span>
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-normal)] mb-2 tracking-tight">
              {t('no_conversations') || 'No conversations yet'}
            </h2>
            <p className="text-[15px] mb-6">{t('add_friend_to_chat') || 'Add a friend to start chatting!'}</p>
            <button
              onClick={() => setShowAddFriend(true)}
              className="bg-[var(--brand)] text-white px-6 py-3 rounded-xl font-bold hover:bg-[var(--brand-hover)] transition-colors shadow-sm"
            >
              {t('add_first_friend') || 'Add Your First Friend'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            {sortedFriends.map((u) => {
              const lastMsg = getLastMessage(u.username);
              const rel = relationshipsByUsername.get(u.username) ?? null;

              return (
                <div
                  key={u.username}
                  onClick={() => navigate(`/dms/${u.username}`)}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--bg-modifier-hover)] cursor-pointer transition-colors border-b border-[var(--border)]/30"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-[var(--brand)] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                      {u.username[0].toUpperCase()}
                    </div>
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-[2.5px] border-[var(--bg-primary)] ${u.online ? 'bg-[#10b981]' : 'bg-[#64748b]'}`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[16px] text-[var(--text-normal)]">
                        {u.username}
                      </span>
                      {lastMsg && (
                        <span className="text-[12px] text-[var(--text-muted)] font-medium flex-shrink-0 ml-2">
                          {formatMessageTimestamp(lastMsg.time)}
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] text-[var(--text-muted)] truncate">
                      {lastMsg
                        ? lastMsg.body.includes('chat-media')
                          ? '📎 Attachment'
                          : lastMsg.body
                        : 'No messages yet'}
                    </p>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/dms/${u.username}`);
                      }}
                      className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-[var(--brand)]/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[22px]">chat_bubble</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (rel && confirm(`Remove ${u.username} from your friends?`)) {
                          removeFriendship(rel.id);
                        }
                      }}
                      className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-muted)] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[22px]">person_remove</span>
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
                <h2 className="text-[20px] font-bold tracking-tight">{t('add_friend') || 'Add Friend'}</h2>
                <p className="text-[14px] text-[var(--text-muted)] mt-1">
                  Search for users by their Aether username.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddFriend(false);
                  setSearchQuery('');
                }}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="px-6 py-4">
              <div className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center gap-3 focus-within:border-[var(--brand)] transition-colors">
                <span className="material-symbols-outlined text-[var(--text-muted)] text-[22px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder={t('search_users') || 'Search users by name...'}
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
                  <span className="material-symbols-outlined text-6xl mb-4 opacity-30">
                    person_search
                  </span>
                  <p className="text-[15px]">Start typing to search for users</p>
                </div>
              ) : isSearching ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
                  <span className="material-symbols-outlined text-6xl mb-4 opacity-30 animate-spin">
                    sync
                  </span>
                  <p className="text-[15px]">Searching...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
                  <span className="material-symbols-outlined text-6xl mb-4 opacity-30">
                    search_off
                  </span>
                  <p className="text-[15px]">
                    No users found matching &quot;{searchQuery}&quot;
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {searchResults.map((u) => (
                    <div
                      key={u.username}
                      className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border)]/50 hover:bg-[var(--bg-modifier-hover)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-[var(--brand)] flex items-center justify-center font-bold text-white text-lg shadow-sm">
                            {u.username[0].toUpperCase()}
                          </div>
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[2.5px] border-[var(--bg-tertiary)] ${u.online ? 'bg-[#10b981]' : 'bg-[#64748b]'}`}
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
                            onClick={() => handleSendRequest(u.username)}
                            className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm ${
                              requestSent === u.username
                                ? 'bg-[#10b981] text-white'
                                : 'bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]'
                            }`}
                          >
                            {requestSent === u.username ? 'Sent!' : 'Add Friend'}
                          </button>
                        ) : u.relationship.status === 'pending' ? (
                          u.relationship.receiver === myUsername ? (
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
