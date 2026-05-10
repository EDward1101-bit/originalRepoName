import { useState, useEffect, useMemo, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useChatContext } from './ChatContext';
import { useMucContext } from './MucContext';
import { useTranslation } from './LanguageContext';
import SettingsModal from './components/SettingsModal';
import PushNotificationBar from './components/PushNotificationBar';
import { supabase } from './supabase';
import { MessageSquare, Server, Plus, Mic, Headphones, Settings, Menu, Star, TrendingUp, Users, X, Bot, Compass, Hash, ShieldCheck } from 'lucide-react';

type TranslationFn = ReturnType<typeof useTranslation>['t'];

interface LayoutProps {
  children?: React.ReactNode;
}

export default function Layout({ children }: LayoutProps = {}) {
  const { user } = useAuth();
  const { status, myUsername, myUserId, unreadCounts, clearUnread, friendships, allUsers } = useChatContext();
  const { availableRooms, joinedRooms, roomUnreadCounts, clearRoomUnread } = useMucContext();
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
      setFavorites((prev) => prev.filter((f) => f.id !== id));
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

  const isConnected = status === 'Connected';

  const breadcrumbs = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const section = parts[0] || '';
    const leaf = parts[1] || '';

    if (section === 'dms') {
      return leaf ? [t('direct_messages'), leaf] : [t('direct_messages')];
    }
    if (section === 'rooms') {
      if (!leaf) return [t('rooms')];
      if (leaf === 'explore') return [t('rooms'), t('explore')];
      return [t('rooms'), `#${leaf}`];
    }
    if (section === 'bots') {
      return [t('bots')];
    }
    return [t('aether')];
  }, [location.pathname]);

  // Room unread: read directly from MucContext (tracked per-room, skipped when in that room)
  const roomUnread = Object.values(roomUnreadCounts).reduce((acc, n) => acc + n, 0);

  // DM unread: only keys that are NOT joined room names
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
      const section = parts[0]; // 'dms' or 'rooms'
      const chatId = parts[1];  // username or roomname
      if (section === 'rooms') {
        clearRoomUnread(chatId);
      } else if (section === 'dms') {
        clearUnread(chatId);
      }
    }
  }, [location.pathname, clearUnread, clearRoomUnread]);

  return (
    <div className="h-screen w-full bg-[var(--bg-secondary)] text-[var(--text-normal)] font-body p-3 antialiased">
      <div className="h-full w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden flex">

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
          <ServersColumn 
            dmUnread={dmUnread} 
            roomUnread={roomUnread} 
          />
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
            <ServersColumn 
              dmUnread={dmUnread} 
              roomUnread={roomUnread} 
            />
          </div>
          <ChannelsColumn 
            location={location}
            joinedRooms={joinedRooms}
            roomUnreadCounts={roomUnreadCounts}
            availableRooms={availableRooms}
            myUsername={myUsername}
            user={user}
            favorites={favorites}
            removeFavorite={removeFavorite}
            setFavorites={setFavorites}
            acceptedFriendsCount={acceptedFriendsCount}
            onlineFriendsCount={onlineFriendsCount}
            status={status}
            isConnected={isConnected}
            t={t}
            setSettingsOpen={setSettingsOpen}
          />
        </aside>

        {/* ── Main area ── */}
        <div className="flex-1 flex flex-col min-w-0 h-full bg-[var(--bg-primary)] relative overflow-hidden">
          {/* Top bar — mobile only */}
          <div className="lg:hidden flex-none h-14 border-b border-[var(--border)] flex items-center px-4 gap-3 bg-[var(--bg-secondary)]">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-normal)] hover:bg-[var(--bg-modifier-hover)] transition-colors"
            >
              <Menu size={22} />
            </button>
            <span className="text-[18px] font-bold text-[var(--text-normal)] tracking-tight">
              {t('aether')}
            </span>
          </div>

          {/* Push Notification Bar */}
          <PushNotificationBar />

          {/* Breadcrumbs (desktop) */}
          <div className="hidden lg:flex flex-none items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-primary)]">
            <div className="flex items-center gap-2 min-w-0">
                            <div className="text-[12px] font-medium text-[var(--text-muted)] truncate">
                {breadcrumbs.join(' / ')}
              </div>
            </div>
            <div
              className={`ml-4 inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                isConnected
                  ? 'bg-[var(--brand)]/10 text-[var(--brand)] border-[var(--brand)]/20'
                  : 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20'
              }`}
              title={status}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[var(--brand)]' : 'bg-[#ef4444]'}`} />
              {isConnected ? t('connected') : t('disconnected')}
            </div>
          </div>

          {/* Content */}
          <main className="flex-1 overflow-hidden relative">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components moved outside to avoid hook reconciliation issues ──

function ServersColumn({ dmUnread, roomUnread }: { dmUnread: number, roomUnread: number }) {
  return (
    <div className="w-[72px] bg-[var(--bg-secondary)] h-full flex flex-col items-center py-4 gap-3 flex-shrink-0 border-r border-[var(--border)]">
      <div className="relative group">
        <NavLink
          to="/dms"
          className="w-12 h-12 rounded-[20px] transition-all duration-300 flex items-center justify-center text-[var(--text-normal)] hover:text-white shadow-sm bg-[var(--bg-secondary)] hover:bg-[var(--brand-hover)]"
          activeClassName="!rounded-[14px] bg-[var(--brand)] text-white"
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
          className="w-12 h-12 rounded-[20px] transition-all duration-300 flex items-center justify-center text-[var(--text-normal)] hover:text-white shadow-sm bg-[var(--bg-secondary)] hover:bg-[var(--brand-hover)]"
          activeClassName="!rounded-[14px] bg-[var(--brand)] text-white"
        >
          <Server size={22} />
        </NavLink>
        {roomUnread > 0 && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 min-w-[20px] h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-[var(--bg-tertiary)]">
            {roomUnread > 99 ? '99+' : roomUnread}
          </div>
        )}
      </div>

      <div className="w-6 h-[2px] bg-[var(--bg-modifier-active)] rounded-full my-1 opacity-50" />

      <div className="relative group">
        <NavLink
          to="/bots"
          className="w-12 h-12 rounded-[20px] transition-all duration-300 flex items-center justify-center text-[var(--text-normal)] hover:text-white shadow-sm bg-[var(--bg-secondary)] hover:bg-[var(--brand-hover)]"
          activeClassName="!rounded-[14px] bg-[var(--brand)] text-white"
        >
          <Bot size={22} />
        </NavLink>
      </div>

      {/* Add new server button */}
      <button className="w-12 h-12 rounded-lg transition-all duration-300 flex items-center justify-center text-[var(--brand)] hover:text-white mt-auto mb-2 border border-dashed border-[var(--brand)]/50 hover:bg-[var(--brand)] hover:border-transparent">
        <Plus size={24} />
      </button>
    </div>
  );
}

function ChannelsColumn({ 
  location, 
  joinedRooms, 
  roomUnreadCounts, 
  availableRooms, 
  myUsername, 
  user,
  favorites, 
  removeFavorite, 
  setFavorites,
  acceptedFriendsCount,
  onlineFriendsCount,
  status,
  isConnected,
  t,
  setSettingsOpen
}: { 
  location: any, 
  joinedRooms: string[], 
  roomUnreadCounts: Record<string, number>, 
  availableRooms: any[], 
  myUsername: string, 
  user: any,
  favorites: any[], 
  removeFavorite: (id: string) => Promise<void>,
  setFavorites: React.Dispatch<React.SetStateAction<any[]>>,
  acceptedFriendsCount: number,
  onlineFriendsCount: number,
  status: string,
  isConnected: boolean,
  t: TranslationFn,
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>
}) {
  return (
    <div className="w-64 bg-[var(--bg-primary)] h-full flex flex-col flex-shrink-0 border-r border-[var(--border)] overflow-hidden">
      {/* Header Area */}
      <div className="h-14 flex-shrink-0 border-b border-[var(--border)] flex items-center px-4">
        <h2 className="font-bold text-[16px] tracking-tight text-[var(--text-normal)]">{t('aether')}</h2>
      </div>

      {/* Favorites or Joined Rooms based on current route */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="px-3 py-2">
          {location.pathname.startsWith('/rooms') ? (
            // Show joined rooms when in rooms section
            <>
              {/* ── Rooms You Are In ── */}
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  {t('rooms_you_are_in')}
                </p>
              </div>
              {joinedRooms.length === 0 ? (
                <div className="py-3 text-center">
                  <p className="text-[12px] text-[var(--text-muted)] italic">{t('no_rooms_joined')}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5 mb-1.5">
                  {joinedRooms.map((roomName) => {
                    const roomUnread = roomUnreadCounts[roomName] || 0;
                    const roomObj = availableRooms.find((r) => r.name === roomName);
                    const isOwner = roomObj?.created_by === myUsername;

                    return (
                      <NavLink
                        key={roomName}
                        to={`/rooms/${roomName}`}
                        className="flex items-center gap-2 px-2 py-1 rounded-md transition-all group text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)]"
                        activeClassName="bg-[var(--brand)]/15 text-[var(--brand)]"
                      >
                        <div className="w-4 h-4 rounded flex items-center justify-center bg-[var(--bg-secondary)] flex-shrink-0">
                          <Hash size={10} />
                        </div>
                        <span className={`text-[12px] truncate flex-1 px-1.5 py-0.5 rounded bg-[var(--bg-secondary)]/50 ${
                          roomUnread > 0 ? 'font-bold text-[var(--text-normal)]' : 'font-medium'
                        }`}>
                          {roomName}
                        </span>
                        {isOwner && (
                          <div className="relative group/owner ml-auto mr-1 flex items-center justify-center">
                            <ShieldCheck 
                              size={12} 
                              className="text-[#10b981] opacity-80 hover:opacity-100 transition-opacity cursor-help" 
                            />
                            <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-normal)] text-[10px] font-bold rounded-md opacity-0 group-hover/owner:opacity-100 transition-all pointer-events-none z-[100] shadow-2xl whitespace-nowrap translate-x-1 group-hover/owner:translate-x-0">
                              You created this room
                              <div className="absolute left-full top-1/2 -translate-y-1/2 border-[4px] border-transparent border-l-[var(--bg-tertiary)]" />
                            </div>
                          </div>
                        )}
                        {roomUnread > 0 && (
                          <span className="min-w-[16px] h-4 bg-[var(--brand)] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 flex-shrink-0">
                            {roomUnread > 99 ? '99+' : roomUnread}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}

              {/* ── Explore Rooms ── */}
              <div className="mb-4">
                <NavLink
                  to="/rooms/explore"
                  className="flex items-center gap-2 px-2 py-1 rounded-md transition-all text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)]"
                  activeClassName="bg-[var(--brand)]/15 text-[var(--brand)]"
                >
                  <div className="w-4 h-4 rounded flex items-center justify-center bg-[var(--bg-secondary)] flex-shrink-0">
                    <Compass size={10} />
                  </div>
                  <span className="text-[12px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-secondary)]">{t('explore_servers')}</span>
                </NavLink>
              </div>
            </>
          ) : (
            // Show favorites in DMs section
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  {t('favorites')}
                </p>
                {favorites.length > 0 && (
                  <button
                    onClick={async () => {
                      // Delete all favorites from Supabase
                      await Promise.all(
                        favorites.map((fav) => supabase.from('favorites').delete().eq('id', fav.id))
                      );
                      setFavorites([]);
                    }}
                    className="text-[10px] text-[var(--text-muted)] hover:text-[#ef4444] transition-colors"
                    title={t('clear_all')}
                  >
                    Clear
                  </button>
                )}
              </div>
              {(() => {
                const dmFavorites = favorites.filter((f) => f.type === 'dm');
                if (dmFavorites.length === 0) {
                  return (
                    <div className="px-3 py-6 text-center">
                      <Star size={24} className="text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
                      <p className="text-[13px] text-[var(--text-muted)] italic">
                        {t('pin_favorite_chats')}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] opacity-60 mt-1">
                        {t('click_star_conversation')}
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="flex flex-col gap-0.5">
                    {dmFavorites.map((fav) => (
                      <div key={fav.id} className="group flex items-center gap-2">
                        <NavLink
                          to={`/dms/${fav.name}`}
                          className="flex-1 flex items-center gap-3 px-3 py-2 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-all"
                          activeClassName="bg-[var(--bg-modifier-selected)] text-[var(--brand)]"
                        >
                          <MessageSquare size={16} />
                          <span className="font-medium text-[14px] truncate">{fav.name}</span>
                        </NavLink>
                        <button
                          onClick={() => removeFavorite(fav.id)}
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-all"
                          title={t('remove')}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-4 py-2 border-t border-[var(--border)]">
        <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
          {t('your_stats')}
        </p>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--bg-secondary)]/30 rounded-md border border-[var(--border)]/10 hover:bg-[var(--bg-secondary)]/60 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-[var(--brand)]/10 flex items-center justify-center text-[var(--brand)]">
                <Users size={12} />
              </div>
              <span className="text-[11px] font-semibold text-[var(--text-muted)]">{t('friends')}</span>
            </div>
            <span className="text-[12px] font-bold text-[var(--text-normal)]">{acceptedFriendsCount}</span>
          </div>

          <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--bg-secondary)]/30 rounded-md border border-[var(--border)]/10 hover:bg-[var(--bg-secondary)]/60 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-[#10b981]/10 flex items-center justify-center text-[#10b981]">
                <TrendingUp size={12} />
              </div>
              <span className="text-[11px] font-semibold text-[var(--text-muted)]">{t('friends')} {t('online')}</span>
            </div>
            <span className="text-[12px] font-bold text-[var(--text-normal)]">{onlineFriendsCount}</span>
          </div>

          <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--bg-secondary)]/30 rounded-md border border-[var(--border)]/10 hover:bg-[var(--bg-secondary)]/60 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-[#f59e0b]/10 flex items-center justify-center text-[#f59e0b]">
                <Server size={12} />
              </div>
              <span className="text-[11px] font-semibold text-[var(--text-muted)]">{t('rooms')}</span>
            </div>
            <span className="text-[12px] font-bold text-[var(--text-normal)]">{joinedRooms.length}</span>
          </div>
        </div>
      </div>

      {/* User Area */}
      <div className="p-3 bg-[var(--bg-secondary)] border-t border-[var(--border)] flex flex-col gap-2">
        <div className="flex items-center gap-3 p-2 bg-[var(--bg-primary)] rounded-md border border-[var(--border)]">
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
}
