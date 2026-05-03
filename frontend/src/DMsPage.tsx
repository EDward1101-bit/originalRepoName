import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatContext, type Friendship } from './ChatContext';

export default function DMsPage() {
  const {
    allUsers,
    friendships,
    myUsername,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriendship,
  } = useChatContext();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Add Friend'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    username: string;
    friendshipId: string;
  } | null>(null);

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

  const handlePageClick = () => {
    if (contextMenu) setContextMenu(null);
  };

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

  const searchResults = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return [];

    return allUsers
      .filter((u) => u.username !== myUsername)
      .filter((u) => u.username.toLowerCase().includes(normalizedQuery))
      .map((u) => {
        const relationship = relationshipsByUsername.get(u.username) ?? null;
        return { ...u, relationship };
      });
  }, [allUsers, myUsername, relationshipsByUsername, searchQuery]);

  return (
    <div
      className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-normal)]"
      onClick={handlePageClick}
    >
      {/* Header */}
      <header className="h-12 flex items-center px-4 border-b border-[var(--border)] shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--text-muted)] text-[24px]">
            group
          </span>
          <h1 className="text-[15px] font-bold leading-tight mr-4">Direct Messages</h1>

          <div className="w-[1px] h-6 bg-[var(--bg-modifier-active)] mx-2" />

          <div className="flex gap-4 items-center">
            <button
              onClick={() => setActiveTab('All')}
              className={`px-2 py-1 rounded text-[15px] font-medium transition-colors ${activeTab === 'All' ? 'bg-[var(--bg-modifier-selected)] text-[var(--text-normal)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)]'}`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('Pending')}
              className={`px-2 py-1 rounded text-[15px] font-medium transition-colors ${activeTab === 'Pending' ? 'bg-[var(--bg-modifier-selected)] text-[var(--text-normal)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)]'}`}
            >
              Pending{' '}
              {pendingReceived.length > 0 && (
                <span className="bg-[var(--color-status-dnd)] text-white text-xs px-1.5 py-0.5 rounded-full ml-1">
                  {pendingReceived.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('Add Friend')}
              className={`px-2 py-1 rounded text-[15px] font-medium transition-colors ${activeTab === 'Add Friend' ? 'text-[var(--color-status-online)] bg-transparent' : 'bg-[#248046] text-white hover:bg-[#1a6334]'}`}
            >
              Add Friend
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'Add Friend' && (
          <div className="p-8">
            <h2 className="text-[16px] font-bold mb-2 uppercase">Add Friend</h2>
            <p className="text-[14px] text-[var(--text-muted)] mb-4">
              You can add friends with their username.
            </p>

            <div className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg p-3 flex items-center focus-within:border-[var(--brand)] transition-colors">
              <input
                type="text"
                placeholder="You can add people with their Aether username."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="flex-1 bg-transparent border-none outline-none text-[var(--text-normal)] placeholder:text-[var(--text-muted)] text-[15px]"
              />
              <button
                className={`px-4 py-2 rounded font-medium text-sm transition-colors ${searchQuery.trim() ? 'bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]' : 'bg-[var(--brand)] opacity-50 cursor-not-allowed text-white'}`}
              >
                Send Friend Request
              </button>
            </div>

            {searchQuery.trim() && (
              <div className="mt-8">
                <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-4">
                  Search Results
                </h3>
                <div className="flex flex-col gap-2">
                  {searchResults.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">No users found</p>
                  ) : (
                    searchResults.map((u) => (
                      <div
                        key={u.username}
                        className="flex items-center justify-between p-3 rounded hover:bg-[var(--bg-modifier-hover)] transition-colors border-t border-[var(--border)]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-[var(--brand)] flex items-center justify-center font-bold text-white">
                              {u.username[0].toUpperCase()}
                            </div>
                            <div
                              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[2.5px] border-[var(--bg-primary)] ${u.online ? 'bg-[var(--color-status-online)]' : 'bg-[var(--color-status-dnd)]'}`}
                            />
                          </div>
                          <span className="font-bold text-[16px]">{u.username}</span>
                        </div>
                        <div>
                          {!u.relationship ? (
                            <button
                              onClick={() => sendFriendRequest(u.username)}
                              className="px-4 py-1.5 bg-[#23a559] text-white text-sm font-medium rounded hover:bg-[#1a7c43] transition-colors"
                            >
                              Add Friend
                            </button>
                          ) : u.relationship.status === 'pending' ? (
                            u.relationship.receiver === myUsername ? (
                              <button
                                onClick={() => acceptFriendRequest(u.relationship!.id)}
                                className="px-4 py-1.5 bg-[var(--brand)] text-white text-sm font-medium rounded hover:bg-[var(--brand-hover)] transition-colors"
                              >
                                Accept Request
                              </button>
                            ) : (
                              <button
                                disabled
                                className="px-4 py-1.5 bg-[var(--bg-modifier-active)] text-[var(--text-muted)] text-sm font-medium rounded"
                              >
                                Request Sent
                              </button>
                            )
                          ) : (
                            <button
                              disabled
                              className="px-4 py-1.5 bg-transparent border border-[var(--border)] text-[var(--text-muted)] text-sm font-medium rounded"
                            >
                              Added
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Pending' && (
          <div className="p-8">
            <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-4">
              Pending — {pendingReceived.length}
            </h2>
            {pendingReceived.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
                <div className="w-32 h-32 bg-[var(--bg-tertiary)] rounded-full mb-6"></div>
                <p className="text-[16px]">There are no pending friend requests.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {pendingReceived.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-3 border-t border-[var(--border)] hover:bg-[var(--bg-modifier-hover)] rounded -mx-3 px-3 group transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--brand)] text-white flex items-center justify-center font-bold">
                        {f.requester[0].toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-[16px]">{f.requester}</span>
                        <span className="text-[13px] text-[var(--text-muted)]">
                          Incoming Friend Request
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptFriendRequest(f.id)}
                        className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-muted)] hover:text-[#23a559] transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">check</span>
                      </button>
                      <button
                        onClick={() => removeFriendship(f.id)}
                        className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--color-status-dnd)] transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'All' && (
          <div className="p-8">
            <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-4">
              All Friends — {acceptedFriends.length}
            </h2>
            {acceptedFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
                <div className="w-32 h-32 bg-[var(--bg-tertiary)] rounded-full mb-6"></div>
                <p className="text-[16px]">Aether space is empty. Add someone to start chatting!</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {acceptedFriends.map((u) => {
                  const rel = relationshipsByUsername.get(u.username) ?? null;
                  return (
                    <div
                      key={u.username}
                      onClick={() => navigate(`/dms/${u.username}`)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (rel) {
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            username: u.username,
                            friendshipId: rel.id,
                          });
                        }
                      }}
                      className="flex items-center justify-between p-3 border-t border-[var(--border)] hover:bg-[var(--bg-modifier-hover)] rounded -mx-3 px-3 cursor-pointer group transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-[var(--brand)] text-white flex items-center justify-center font-bold">
                            {u.username[0].toUpperCase()}
                          </div>
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[2.5px] border-[var(--bg-primary)] ${u.online ? 'bg-[var(--color-status-online)]' : 'bg-[var(--color-status-dnd)]'}`}
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-[16px]">{u.username}</span>
                          <span className="text-[13px] text-[var(--text-muted)]">
                            {u.online ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dms/${u.username}`);
                          }}
                          className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-normal)] transition-colors"
                        >
                          <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
                        </button>
                        <button className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-normal)] transition-colors">
                          <span className="material-symbols-outlined text-[20px]">more_vert</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[var(--bg-tertiary)] border border-[var(--border)] shadow-xl rounded py-2 min-w-[180px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              removeFriendship(contextMenu.friendshipId);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-[var(--color-status-dnd)] hover:bg-[var(--brand)] hover:text-white transition-colors"
          >
            Remove Friend
          </button>
        </div>
      )}
    </div>
  );
}
