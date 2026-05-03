import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useChatContext } from './ChatContext';
import SettingsModal from './components/SettingsModal';

export default function Layout() {
  const { user, signOut } = useAuth();
  const { status, myUsername } = useChatContext();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isConnected = status === 'Connected';

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
    <div className="w-[72px] bg-[var(--bg-tertiary)] h-full flex flex-col items-center py-3 gap-2 flex-shrink-0 z-50">
      <NavLink
        to="/dms"
        className={({ isActive }) =>
          `w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all duration-200 flex items-center justify-center bg-[var(--bg-primary)] hover:bg-[var(--brand)] text-[var(--text-normal)] hover:text-white ${
            isActive ? '!rounded-[16px] !bg-[var(--brand)] text-white' : ''
          }`
        }
      >
        <span className="material-symbols-outlined text-[28px]">chat_bubble</span>
      </NavLink>

      <div className="w-8 h-[2px] bg-[var(--bg-modifier-active)] rounded my-1" />

      <NavLink
        to="/rooms"
        className={({ isActive }) =>
          `w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all duration-200 flex items-center justify-center bg-[var(--bg-primary)] hover:bg-[var(--brand)] text-[var(--text-normal)] hover:text-white ${
            isActive ? '!rounded-[16px] !bg-[var(--brand)] text-white' : ''
          }`
        }
      >
        <span className="material-symbols-outlined text-[28px]">dns</span>
      </NavLink>

      {/* Add new server button */}
      <button className="w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all duration-200 flex items-center justify-center bg-[var(--bg-primary)] hover:bg-[#23a559] text-[#23a559] hover:text-white mt-2">
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </div>
  );

  const ChannelsColumn = () => (
    <div className="w-60 bg-[var(--bg-secondary)] h-full flex flex-col flex-shrink-0 rounded-tl-lg lg:rounded-none">
      {/* Header Area */}
      <div className="h-12 border-b border-[var(--border)] shadow-sm flex items-center px-4">
        <h2 className="font-bold text-[var(--text-normal)]">Aether Chat</h2>
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-[2px]">
        {/* Placeholder links, actual sub-routes might dictate content here */}
        <NavLink
          to="/dms"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-2 py-1.5 rounded text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-colors ${
              isActive ? 'bg-[var(--bg-modifier-selected)] !text-[var(--text-normal)]' : ''
            }`
          }
        >
          <span className="material-symbols-outlined text-[20px]">person</span>
          <span className="font-medium text-[15px]">Friends</span>
        </NavLink>
        <NavLink
          to="/rooms"
          className={({ isActive }) =>
            `flex items-center gap-3 px-2 py-1.5 rounded text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-colors ${
              isActive ? 'bg-[var(--bg-modifier-selected)] !text-[var(--text-normal)]' : ''
            }`
          }
        >
          <span className="material-symbols-outlined text-[20px]">explore</span>
          <span className="font-medium text-[15px]">Explore Servers</span>
        </NavLink>
      </div>

      {/* User Area */}
      <div className="h-[52px] bg-[var(--bg-tertiary)] flex items-center px-2 gap-2 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-[var(--brand)] text-white flex items-center justify-center text-sm font-bold flex-shrink-0 relative cursor-pointer hover:opacity-80">
          {myUsername?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[2.5px] border-[var(--bg-tertiary)] ${isConnected ? 'bg-[var(--color-status-online)]' : 'bg-[var(--color-status-dnd)]'}`}
          />
        </div>
        <div className="flex-1 min-w-0 cursor-pointer hover:bg-[var(--bg-modifier-hover)] rounded py-1 px-1">
          <p className="text-[13px] font-bold text-[var(--text-normal)] truncate leading-tight">
            {myUsername}
          </p>
          <p className="text-[11px] text-[var(--text-muted)] truncate leading-tight">{status}</p>
        </div>

        <div className="flex items-center">
          <button className="w-8 h-8 rounded flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-colors">
            <span className="material-symbols-outlined text-[20px]">mic</span>
          </button>
          <button className="w-8 h-8 rounded flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-colors">
            <span className="material-symbols-outlined text-[20px]">headphones</span>
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
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
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Desktop Server Column ── */}
      <div className="hidden lg:flex">
        <ServersColumn />
      </div>

      {/* ── Sidebar (Mobile + Channels Column) ── */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full flex
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:z-auto
        `}
      >
        <div className="flex lg:hidden h-full">
          <ServersColumn />
        </div>
        <ChannelsColumn />
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-[var(--bg-primary)] rounded-tl-lg lg:rounded-tl-none">
        {/* Top bar — mobile only */}
        <div className="lg:hidden flex-none h-12 border-b border-[var(--border)] flex items-center px-4 gap-3 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-normal)] transition-colors -ml-2"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="text-base font-bold text-[var(--text-normal)] tracking-tight">
            Aether Chat
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
