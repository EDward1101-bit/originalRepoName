import { useState, useEffect, useMemo, useCallback } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useChatContext } from './ChatContext';
import { useMucContext } from './MucContext';
import { useTranslation } from './LanguageContext';
import SettingsModal from './components/SettingsModal';
import { supabase } from './supabase';
import { MessageSquare, Server, Plus, Mic, Headphones, Settings, Menu, Star, TrendingUp, Users, MessageCircle, X, Minus } from 'lucide-react';

export default function Layout() {
  const { user } = useAuth();
  const { status, myUsername, myUserId, unreadCounts, clearUnread, friendships, allUsers, messages } = useChatContext();
  const { joinedRooms, roomMessages } = useMucContext();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useLocation();

  // Favorites state from Supabase
  const [favorites, setFavorites] = useState<{ id: string; type: 'dm' | 'room'; name: string }[]>([]);

  // Fetch favorites from Supabase
  const fetchFavorites = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('favorites')
      .select('id, type, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setFavorites(data);
    }
  }, [user]);

  // Load favorites on mount
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`favorites_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'favorites',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchFavorites();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, fetchFavorites]);

  const removeFavorite = async (id: string) => {
    const { error } = await supabase.from('favorites').delete().eq('id', id);
    if (!error) {
      setFavorites(favorites.filter((f) => f.id !== id));
    }
  };

  // Calculate stats
  const acceptedFriendsCount = useMemo(() => {
    return friendships.filter((f) => f.status === 'accepted').length;
  }, [friendships]);

  const onlineFriendsCount = useMemo(() => {
    const friendIds = friendships
      .filter((f) => f.status === 'accepted')
      .map((f) => (f.requester_id === myUserId ? f.receiver_id : f.requester_id));
    return allUsers.filter((u) => friendIds.includes(u.id) && u.online).length;
  }, [friendships, allUsers, myUserId]);

  const totalMessages = useMemo(() => {
    const dmCount = messages.length;
    const roomCount = Object.values(roomMessages).reduce((acc, msgs) => acc + msgs.length, 0);
    return dmCount + roomCount;
  }, [messages, roomMessages]);

  const isConnected = status === 'Connected';

  const roomUnread = Object.keys(unreadCounts).reduce((acc, key) => {
    if (joinedRooms.includes(key)) {
      return acc + unreadCounts[key];
    }
    return acc;
  }, 0);

  const dmUnread = Object.keys(unreadCounts).reduce((acc, key) => {
    if (!joinedRooms.includes(key)) {
      return acc + unreadCounts[key];
    }
    return acc;
  }, 0);

  // Automatically clear unread if we navigate to a specific room or DM
  useEffect(() => {
    // E.g., location.pathname is "/dms/username" or "/rooms/roomname"
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const chatId = parts[1]; // The 'username' or 'roomname'
      if (unreadCounts[chatId] > 0) {
        clearUnread(chatId);
      }
    }
  }, [location.pathname, unreadCounts, clearUnread]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && settingsOpen) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen]);

  const ServersColumn = () => (
    <div className="w-[72px] bg-[var(--bg-secondary)] h-screen flex flex-col items-center py-4 gap-3 flex-shrink-0 border-r border-[var(--border)]">
      <div className="relative group">
        <NavLink
          to="/dms"
          className={({ isActive }) =>
            `w-12 h-12 rounded-[20px] transition-all duration-300 flex items-center justify-center text-[var(--text-normal)] hover:text-white shadow-sm ${
              isActive
                ? '!rounded-[14px] bg-[var(--brand)] text-white'
                : 'bg-[var(--bg-secondary)] hover:bg-[var(--brand-hover)]'
            }`
          }
        >
          <MessageSquare size={22} />
        </NavLink>
        {dmUnread > 0 && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 min-w-[20px] h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-[var(--bg-tertiary)]">
            {dmUnread > 99 ? '99+' : dmUnread}
          </div>
        )}
      </div>

      <div className="w-6 h-[2px] bg-[var(--bg-modifier-active)] rounded-full my-1 opacity-50" />

      <div className="relative group">
        <NavLink
          to="/rooms"
          className={({ isActive }) =>
            `w-12 h-12 rounded-[20px] transition-all duration-300 flex items-center justify-center text-[var(--text-normal)] hover:text-white shadow-sm ${
              isActive
                ? '!rounded-[14px] bg-[var(--brand)] text-white'
                : 'bg-[var(--bg-secondary)] hover:bg-[var(--brand-hover)]'
            }`
          }
        >
          <Server size={22} />
        </NavLink>
        {roomUnread > 0 && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 min-w-[20px] h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-[var(--bg-tertiary)]">
            {roomUnread > 99 ? '99+' : roomUnread}
          </div>
        )}
      </div>

      {/* Add new server button */}
      <button className="w-12 h-12 rounded-[20px] transition-all duration-300 flex items-center justify-center text-[var(--brand)] hover:text-white mt-auto mb-2 border border-dashed border-[var(--brand)]/50 hover:bg-[var(--brand)] hover:border-transparent">
        <Plus size={24} />
      </button>
    </div>
  );

  const ChannelsColumn = () => (
    <div className="w-64 bg-[var(--bg-primary)] h-screen flex flex-col flex-shrink-0 border-r border-[var(--border)] overflow-hidden">
      {/* Header Area */}
      <div className="h-14 flex-shrink-0 border-b border-[var(--border)] flex items-center px-4">
        <h2 className="font-bold text-[16px] tracking-tight text-[var(--text-normal)]">Aether</h2>
      </div>

      {/* Quick Stats */}
      <div className="px-4 py-4 border-b border-[var(--border)]">
        <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Your Stats
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center text-[var(--brand)]">
              <Users size={16} />
            </div>
            <div>
              <p className="text-[18px] font-bold text-[var(--text-normal)] leading-none">{acceptedFriendsCount}</p>
              <p className="text-[11px] text-[var(--text-muted)]">Friends</p>
            </div>
          </div>
          <div className="bg-[var(--bg-secondary)] rounded-xl p-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#10b981]/10 flex items-center justify-center text-[#10b981]">
              <TrendingUp size={16} />
            </div>
            <div>
              <p className="text-[18px] font-bold text-[var(--text-normal)] leading-none">{onlineFriendsCount}</p>
              <p className="text-[11px] text-[var(--text-muted)]">Online</p>
            </div>
          </div>
          <div className="bg-[var(--bg-secondary)] rounded-xl p-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center text-[#f59e0b]">
              <Server size={16} />
            </div>
            <div>
              <p className="text-[18px] font-bold text-[var(--text-normal)] leading-none">{joinedRooms.length}</p>
              <p className="text-[11px] text-[var(--text-muted)]">Rooms</p>
            </div>
          </div>
          <div className="bg-[var(--bg-secondary)] rounded-xl p-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#ec4899]/10 flex items-center justify-center text-[#ec4899]">
              <MessageCircle size={16} />
            </div>
            <div>
              <p className="text-[18px] font-bold text-[var(--text-normal)] leading-none">{totalMessages}</p>
              <p className="text-[11px] text-[var(--text-muted)]">Messages</p>
            </div>
          </div>
        </div>
      </div>

      {/* Favorites or Joined Rooms based on current route */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="px-3 py-2">
          {location.pathname.startsWith('/rooms') ? (
            // Show joined rooms when in rooms section
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Your Rooms
                </p>
              </div>
              {joinedRooms.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <Server size={24} className="text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
                  <p className="text-[13px] text-[var(--text-muted)] italic">
                    No rooms joined yet
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] opacity-60 mt-1">
                    Explore servers to join
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {joinedRooms.map((roomName) => (
                    <NavLink
                      key={roomName}
                      to={`/rooms/${roomName}`}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-all ${
                          isActive ? 'bg-[var(--bg-modifier-selected)] text-[var(--brand)]' : ''
                        }`
                      }
                    >
                      <Minus size={16} />
                      <span className="font-medium text-[14px] truncate">{roomName}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </>
          ) : (
            // Show favorites in DMs section
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Favorites
                </p>
                {favorites.length > 0 && (
                  <button
                    onClick={async () => {
                      // Delete all favorites from Supabase
                      for (const fav of favorites) {
                        await supabase.from('favorites').delete().eq('id', fav.id);
                      }
                      setFavorites([]);
                    }}
                    className="text-[10px] text-[var(--text-muted)] hover:text-[#ef4444] transition-colors"
                    title="Clear all"
                  >
                    Clear
                  </button>
                )}
              </div>
              {favorites.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <Star size={24} className="text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
                  <p className="text-[13px] text-[var(--text-muted)] italic">
                    Pin your favorite chats
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] opacity-60 mt-1">
                    Click the star in any conversation
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {favorites.map((fav) => (
                    <div key={fav.id} className="group flex items-center gap-2">
                      <NavLink
                        to={fav.type === 'dm' ? `/dms/${fav.name}` : `/rooms/${fav.name}`}
                        className={({ isActive }) =>
                          `flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-all ${
                            isActive ? 'bg-[var(--bg-modifier-selected)] text-[var(--brand)]' : ''
                          }`
                        }
                      >
                        {fav.type === 'dm' ? (
                          <MessageSquare size={16} />
                        ) : (
                          <Minus size={16} />
                        )}
                        <span className="font-medium text-[14px] truncate">{fav.name}</span>
                      </NavLink>
                      <button
                        onClick={() => removeFavorite(fav.id)}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-all"
                        title="Remove from favorites"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* User Area */}
      <div className="p-3 bg-[var(--bg-secondary)] border-t border-[var(--border)] flex flex-col gap-2">
        <div className="flex items-center gap-3 p-2 bg-[var(--bg-primary)] rounded-lg border border-[var(--border)]">
          <div className="w-10 h-10 rounded-full flex-shrink-0 relative">
            <div className="w-full h-full rounded-full shadow-inner overflow-hidden">
              {user?.user_metadata?.avatar_url || localStorage.getItem('aether_avatar') ? (
                <img
                  src={user?.user_metadata?.avatar_url || localStorage.getItem('aether_avatar')!}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[var(--brand)] text-white flex items-center justify-center text-sm font-bold">
                  {user?.user_metadata?.display_name?.[0]?.toUpperCase() ||
                    myUsername?.[0]?.toUpperCase() ||
                    user?.email?.[0]?.toUpperCase() ||
                    '?'}
                </div>
              )}
            </div>
            {/* Status dot - positioned on top of the avatar */}
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[2.5px] border-[var(--bg-primary)] z-10 ${isConnected ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-[var(--text-normal)] truncate leading-tight">
              {user?.user_metadata?.display_name || myUsername}
            </p>
            <p className="text-[12px] text-[var(--text-muted)] truncate leading-tight font-medium">
              {status === 'Connected' ? t('online') : status}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <button className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-colors">
            <Mic size={16} />
          </button>
          <button className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-colors">
            <Headphones size={16} />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-colors"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-[var(--bg-primary)] text-[var(--text-normal)] font-body h-screen flex overflow-hidden antialiased">

      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} myUsername={myUsername} />
      )}

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Desktop Server Column ── */}
      <div className="hidden lg:flex relative z-10">
        <ServersColumn />
      </div>

      {/* ── Sidebar (Mobile + Channels Column) ── */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full flex
          transition-transform duration-400 cubic-bezier(0.4, 0, 0.2, 1)
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:z-10
        `}
      >
        <div className="flex lg:hidden h-full">
          <ServersColumn />
        </div>
        <ChannelsColumn />
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen bg-[var(--bg-primary)] relative overflow-hidden">
        {/* Top bar — mobile only */}
        <div className="lg:hidden flex-none h-14 border-b border-[var(--border)] flex items-center px-4 gap-3 bg-[var(--bg-secondary)]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-normal)] hover:bg-[var(--bg-modifier-hover)] transition-colors"
          >
            <Menu size={22} />
          </button>
          <span className="text-[18px] font-bold text-[var(--text-normal)] tracking-tight">
            Aether
          </span>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-hidden relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
