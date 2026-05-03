import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useChatContext } from './ChatContext';
import { useTranslation } from './LanguageContext';
import SettingsModal from './components/SettingsModal';

export default function Layout() {
  const { user } = useAuth();
  const { status, myUsername } = useChatContext();
  const { t } = useTranslation();
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
    <div className="w-[72px] bg-[var(--bg-tertiary)]/80 backdrop-blur-md h-[calc(100vh-32px)] my-4 ml-4 rounded-[24px] flex flex-col items-center py-4 gap-3 flex-shrink-0 z-50 border border-[var(--border)] shadow-xl">
      <NavLink
        to="/dms"
        className={({ isActive }) =>
          `w-12 h-12 rounded-[20px] transition-all duration-300 flex items-center justify-center text-[var(--text-normal)] hover:text-white shadow-sm ${
            isActive ? '!rounded-[14px] bg-[var(--brand)] text-white' : 'bg-[var(--bg-secondary)] hover:bg-[var(--brand-hover)]'
          }`
        }
      >
        <span className="material-symbols-outlined text-[24px]">chat_bubble</span>
      </NavLink>

      <div className="w-6 h-[2px] bg-[var(--bg-modifier-active)] rounded-full my-1 opacity-50" />

      <NavLink
        to="/rooms"
        className={({ isActive }) =>
          `w-12 h-12 rounded-[20px] transition-all duration-300 flex items-center justify-center text-[var(--text-normal)] hover:text-white shadow-sm ${
            isActive ? '!rounded-[14px] bg-[var(--brand)] text-white' : 'bg-[var(--bg-secondary)] hover:bg-[var(--brand-hover)]'
          }`
        }
      >
        <span className="material-symbols-outlined text-[24px]">dns</span>
      </NavLink>

      {/* Add new server button */}
      <button className="w-12 h-12 rounded-[20px] transition-all duration-300 flex items-center justify-center text-[#14b8a6] hover:text-white mt-auto mb-2 border border-dashed border-[#14b8a6]/50 hover:bg-[#14b8a6] hover:border-transparent">
        <span className="material-symbols-outlined text-[26px]">add</span>
      </button>
    </div>
  );

  const ChannelsColumn = () => (
    <div className="w-64 bg-[var(--bg-secondary)]/90 backdrop-blur-md h-[calc(100vh-32px)] my-4 mx-4 flex flex-col flex-shrink-0 rounded-[24px] border border-[var(--border)] shadow-xl overflow-hidden">
      {/* Header Area */}
      <div className="h-16 flex-shrink-0 border-b border-[var(--border)]/50 flex items-center px-6">
        <h2 className="font-bold text-[18px] tracking-tight text-[var(--text-normal)]">Aether</h2>
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
        <NavLink
          to="/dms"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-all ${
              isActive ? 'bg-[var(--brand)]/10 text-[var(--brand)]' : ''
            }`
          }
        >
          <span className="material-symbols-outlined text-[22px]">person</span>
          <span className="font-medium text-[15px]">Direct Messages</span>
        </NavLink>
        <NavLink
          to="/rooms"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-all ${
              isActive ? 'bg-[var(--brand)]/10 text-[var(--brand)]' : ''
            }`
          }
        >
          <span className="material-symbols-outlined text-[22px]">explore</span>
          <span className="font-medium text-[15px]">Explore Servers</span>
        </NavLink>
      </div>

      {/* User Area */}
      <div className="p-4 bg-[var(--bg-tertiary)]/50 flex flex-col gap-3">
        <div className="flex items-center gap-3 p-2 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)]/50 shadow-sm">
          <div className="w-10 h-10 rounded-full flex-shrink-0 relative shadow-inner overflow-hidden">
            {user?.user_metadata?.avatar_url || localStorage.getItem('aether_avatar') ? (
              <img
                src={user?.user_metadata?.avatar_url || localStorage.getItem('aether_avatar')!}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[var(--brand)] text-white flex items-center justify-center text-sm font-bold">
                {user?.user_metadata?.display_name?.[0]?.toUpperCase() || myUsername?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[2.5px] border-[var(--bg-secondary)] ${isConnected ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-[var(--text-normal)] truncate leading-tight">
              {myUsername}
            </p>
            <p className="text-[12px] text-[var(--text-muted)] truncate leading-tight font-medium">
              {status === 'Connected' ? t('online') : status}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <button className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-colors">
            <span className="material-symbols-outlined text-[20px]">mic</span>
          </button>
          <button className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-colors">
            <span className="material-symbols-outlined text-[20px]">headphones</span>
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-[#0b0714] text-[var(--text-normal)] font-body h-screen flex overflow-hidden antialiased">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none opacity-40 z-0">
         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[var(--brand)] rounded-full blur-[120px] mix-blend-screen opacity-20"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#8b5cf6] rounded-full blur-[120px] mix-blend-screen opacity-20"></div>
      </div>

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
      <div className="flex-1 flex flex-col min-w-0 h-[calc(100vh-32px)] my-4 mr-4 bg-[var(--bg-primary)]/90 backdrop-blur-lg rounded-[24px] border border-[var(--border)] shadow-2xl relative z-10 overflow-hidden">
        {/* Top bar — mobile only */}
        <div className="lg:hidden flex-none h-16 border-b border-[var(--border)]/50 flex items-center px-4 gap-3 bg-[var(--bg-secondary)]/50 backdrop-blur-md">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-normal)] hover:bg-[var(--bg-modifier-hover)] transition-colors"
          >
            <span className="material-symbols-outlined">menu</span>
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
