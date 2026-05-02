import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useChatContext } from './ChatContext';

export default function Layout() {
  const { user, signOut } = useAuth();
  const { status, myUsername } = useChatContext();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-container-highest text-on-surface font-semibold border-l-[3px] border-primary transition-all'
      : 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-all';

  const isConnected = status === 'Connected';

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="px-4 pb-4 border-b border-surface-variant">
        <span className="text-lg font-bold text-primary tracking-tight">Aether Chat</span>
        <div className="mt-2 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-tertiary' : 'bg-error'}`} />
          <span className={`text-xs font-medium ${isConnected ? 'text-tertiary' : 'text-error'}`}>
            {status}
          </span>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1">
        <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest px-3 mb-1">
          Navigation
        </p>
        <NavLink to="/dms" end className={navLinkClass} onClick={() => setSidebarOpen(false)}>
          <span className="material-symbols-outlined text-[22px]">chat_bubble</span>
          <span className="text-sm">Direct Messages</span>
        </NavLink>
        <NavLink to="/rooms" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
          <span className="material-symbols-outlined text-[22px]">grid_view</span>
          <span className="text-sm">Servers</span>
        </NavLink>
        <a className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-all cursor-pointer opacity-50 pointer-events-none">
          <span className="material-symbols-outlined text-[22px]">pulse_alert</span>
          <span className="text-sm">Activity</span>
        </a>
        <a className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-all cursor-pointer opacity-50 pointer-events-none">
          <span className="material-symbols-outlined text-[22px]">bookmark</span>
          <span className="text-sm">Bookmarks</span>
        </a>
      </nav>

      {/* User Footer */}
      <div className="px-3 py-3 border-t border-surface-variant flex flex-col gap-2">
        <div className="flex items-center gap-3 px-1">
          <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
            {myUsername?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-on-surface truncate">{myUsername}</p>
            <p className="text-xs text-on-surface-variant truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 bg-surface-container text-on-surface-variant border border-surface-variant font-medium py-2 rounded-xl hover:bg-error/10 hover:text-error hover:border-error/30 transition-all text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="bg-background text-on-background font-body h-screen flex overflow-hidden antialiased">

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 flex flex-col
          bg-surface-container-low border-r border-surface-variant shadow-lg
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:shadow-none lg:z-auto
        `}
      >
        {/* Mobile close button */}
        <button
          className="absolute top-3 right-3 lg:hidden w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant transition-colors"
          onClick={() => setSidebarOpen(false)}
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className="pt-4 flex flex-col h-full">
          <SidebarContent />
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full">

        {/* Top bar — mobile only */}
        <div className="lg:hidden flex-none h-14 bg-surface-container-low border-b border-surface-variant flex items-center px-4 gap-3 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="text-base font-bold text-primary tracking-tight">Aether Chat</span>
          <div className="ml-auto flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-tertiary' : 'bg-error'}`} />
            <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm font-bold">
              {myUsername?.[0]?.toUpperCase() || '?'}
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
