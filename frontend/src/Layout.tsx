import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useChatContext } from './ChatContext';

export default function Layout() {
  const { user, signOut } = useAuth();
  const { status, myUsername } = useChatContext();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'text-on-surface border-l-4 border-primary bg-surface-container-highest transition-all duration-200 ease-in-out flex items-center gap-4 px-4 py-2 rounded-r-xl -ml-[4px]'
      : 'text-on-surface-variant hover:text-primary hover:bg-surface-variant transition-all duration-200 ease-in-out flex items-center gap-4 px-4 py-2 rounded-xl';

  return (
    <div className="bg-background text-on-background font-body h-screen flex flex-col overflow-hidden antialiased">
      {/* TopAppBar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-surface-container-low border-b border-surface-variant flex justify-between items-center h-16 px-8 w-full shadow-sm">
        <div className="flex items-center gap-4">
          <span className="text-xl font-bold text-primary tracking-tight">Aether Chat</span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${status === 'Connected' ? 'bg-tertiary/20 text-tertiary' : 'bg-error/20 text-error'}`}
          >
            {status}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-on-surface-variant hidden sm:block">{myUsername}</span>
          <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm font-bold">
            {myUsername?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
          </div>
        </div>
      </div>

      {/* Main Layout below TopAppBar */}
      <div className="flex flex-1 pt-16 w-full h-full">
        {/* SideNavBar */}
        <nav className="bg-surface-container h-[calc(100vh-64px)] w-[260px] border-r border-surface-variant flex flex-col py-6 shadow-sm flex-shrink-0 z-40">
          <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-1">
            <NavLink to="/dms" end className={navLinkClass}>
              <span className="material-symbols-outlined">chat_bubble</span>
              <span className="text-[15px] font-medium">Direct Messages</span>
            </NavLink>
            <a className="text-on-surface-variant hover:text-primary hover:bg-surface-variant transition-all duration-200 ease-in-out flex items-center gap-4 px-4 py-2 rounded-xl cursor-pointer">
              <span className="material-symbols-outlined">grid_view</span>
              <span className="text-[15px] font-medium">Servers</span>
            </a>
            <a className="text-on-surface-variant hover:text-primary hover:bg-surface-variant transition-all duration-200 ease-in-out flex items-center gap-4 px-4 py-2 rounded-xl cursor-pointer">
              <span className="material-symbols-outlined">pulse_alert</span>
              <span className="text-[15px] font-medium">Activity</span>
            </a>
            <a className="text-on-surface-variant hover:text-primary hover:bg-surface-variant transition-all duration-200 ease-in-out flex items-center gap-4 px-4 py-2 rounded-xl cursor-pointer">
              <span className="material-symbols-outlined">bookmark</span>
              <span className="text-[15px] font-medium">Bookmarks</span>
            </a>
          </div>
          <div className="mt-auto px-4 pt-4 flex flex-col gap-2 border-t border-surface-variant">
            <button
              onClick={handleSignOut}
              className="w-full bg-primary text-on-primary font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </nav>

        {/* Canvas Area */}
        <main className="flex-1 bg-surface flex flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
