import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatContext, type Friendship } from './ChatContext';

export default function DMsPage() {
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

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
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

  const lastMessageByUser = useMemo(() => {
    const map = new Map<string, (typeof messages)[number]>();

    messages.forEach((message) => {
      map.set(message.otherParty, message);
    });

    return map;
  }, [messages]);

  // Close context menu on click anywhere
  const handlePageClick = () => {
    if (contextMenu) setContextMenu(null);
  };

  // ── Derive friend lists ──
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

  // ── Search results ──
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
    <div className="flex flex-col h-full" onClick={handlePageClick}>
      {/* Canvas Header */}
      <header className="h-16 flex items-center px-8 border-b border-surface-variant shrink-0 bg-surface/80 backdrop-blur-sm shadow-sm z-10">
        <div className="flex items-center gap-4 text-on-background">
          <span className="material-symbols-outlined text-outline">group</span>
          <h1 className="text-xl font-bold tracking-tight">Friends</h1>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="bg-primary text-on-primary font-semibold px-6 py-2 rounded-xl hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
          >
            {showSearch ? 'Close' : 'Add Friend'}
          </button>
        </div>
      </header>

      {/* Search Panel */}
      {showSearch && (
        <div className="px-8 py-4 border-b border-surface-variant bg-surface-container-low">
          <div className="max-w-xl">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="Search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-surface border border-surface-variant outline-none text-on-surface placeholder:text-outline text-sm py-3 pl-10 pr-4 rounded-xl focus:border-primary transition-colors"
              />
            </div>
            {searchQuery.trim() && (
              <div className="mt-3 flex flex-col gap-2 max-h-64 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <p className="text-sm text-outline py-2">No users found</p>
                ) : (
                  searchResults.map((u) => (
                    <div
                      key={u.username}
                      className="flex items-center justify-between p-3 rounded-xl bg-surface border border-surface-variant hover:bg-surface-container-low transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${u.online ? 'bg-tertiary/20 text-tertiary' : 'bg-surface-container-high text-outline'}`}
                        >
                          {u.username[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-background">{u.username}</p>
                          <p className="text-xs text-outline">{u.online ? 'Online' : 'Offline'}</p>
                        </div>
                      </div>
                      <div>
                        {!u.relationship ? (
                          <button
                            onClick={() => sendFriendRequest(u.username)}
                            className="px-4 py-1.5 bg-primary text-on-primary text-xs font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
                          >
                            Add Friend
                          </button>
                        ) : u.relationship.status === 'pending' ? (
                          u.relationship.receiver === myUsername ? (
                            <button
                              onClick={() => acceptFriendRequest(u.relationship!.id)}
                              className="px-4 py-1.5 bg-tertiary text-on-tertiary text-xs font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
                            >
                              Accept
                            </button>
                          ) : (
                            <span className="text-xs text-outline px-3 py-1.5 bg-surface-container-high rounded-xl">
                              Pending
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-tertiary px-3 py-1.5 bg-tertiary/10 rounded-xl font-medium">
                            Friends ✓
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* Pending Requests */}
        {pendingReceived.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-outline mb-4">
              Pending Requests
            </h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4 max-w-7xl mx-auto">
              {pendingReceived.map((f) => {
                return (
                  <div
                    key={f.id}
                    className="bg-surface border border-surface-variant rounded-2xl p-6 flex items-center justify-between hover:bg-surface-container-low hover:border-outline-variant hover:shadow-md transition-all duration-300 ease-in-out group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-full bg-secondary/20 text-secondary flex items-center justify-center font-bold text-lg border border-surface-variant shadow-sm">
                          {f.requester[0].toUpperCase()}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-base text-on-background font-bold tracking-tight">
                          {f.requester}
                        </h3>
                        <p className="text-xs text-outline mt-0.5">Wants to be friends</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptFriendRequest(f.id)}
                        className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => removeFriendship(f.id)}
                        className="px-4 py-2 bg-surface-container-high text-on-surface-variant text-xs font-bold rounded-xl hover:bg-error/10 hover:text-error transition-colors shadow-sm cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Friends Grid */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-outline mb-4">
            All Friends — {acceptedFriends.length}
          </h2>
          {acceptedFriends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-outline">
              <span className="material-symbols-outlined text-5xl mb-3 opacity-40">group_off</span>
              <p className="text-base font-medium">No friends yet</p>
              <p className="text-sm mt-1">Click &quot;Add Friend&quot; above to find people</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4 max-w-7xl mx-auto">
              {acceptedFriends.map((u) => {
                const lastMsg = lastMessageByUser.get(u.username) ?? null;
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
                    className={`bg-surface border border-surface-variant rounded-2xl p-6 flex items-center justify-between hover:bg-surface-container-low hover:border-outline-variant hover:shadow-md transition-all duration-300 ease-in-out group cursor-pointer ${!u.online ? 'opacity-75 hover:opacity-100' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div
                          className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg border border-surface-variant shadow-sm ${u.online ? 'bg-primary/15 text-primary' : 'bg-surface-container-high text-outline grayscale'}`}
                        >
                          {u.username[0].toUpperCase()}
                        </div>
                        <div
                          className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-[3px] border-surface ${u.online ? 'bg-tertiary' : 'bg-surface-variant'}`}
                        />
                      </div>
                      <div>
                        <h3
                          className={`text-base font-bold tracking-tight ${u.online ? 'text-on-background' : 'text-on-surface-variant'}`}
                        >
                          {u.username}
                        </h3>
                        <p className="text-xs text-outline mt-0.5 max-w-45 truncate">
                          {lastMsg
                            ? `${lastMsg.type === 'sent' ? 'You: ' : ''}${lastMsg.body}`
                            : u.online
                              ? 'Online'
                              : 'Offline'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/dms/${u.username}`);
                        }}
                        className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-background hover:bg-primary hover:text-on-primary shadow-sm hover:shadow-md transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-surface-container-high border border-outline-variant shadow-2xl rounded-xl py-1 min-w-40 overflow-hidden"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              removeFriendship(contextMenu.friendshipId);
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-error hover:bg-error/10 transition-colors cursor-pointer border-none outline-none"
          >
            Remove Friend
          </button>
        </div>
      )}
    </div>
  );
}
