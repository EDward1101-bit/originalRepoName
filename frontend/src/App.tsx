import { Routes, Route, Navigate } from 'react-router-dom';
import Auth from './Auth';
import Chat from './Chat';
import DMsPage from './DMsPage';
import Layout from './Layout';
import { useAuth } from './AuthContext';
import { ChatProvider } from './ChatContext';
import { MucProvider } from './MucContext';
import { BotProvider } from './BotContext';
import RoomsPage from './RoomsPage';
import RoomChat from './RoomChat';
import RoomsRedirect from './RoomsRedirect';
import BotsPage from './BotsPage';

console.log('[App] Starting...');

function AuthenticatedRoutes() {
  console.log('[App] Rendering AuthenticatedRoutes');
  return (
    <ChatProvider>
      <BotProvider>
        <MucProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/dms" element={<DMsPage />} />
              <Route path="/dms/:username" element={<Chat />} />
              <Route path="/rooms" element={<RoomsRedirect />} />
              <Route path="/rooms/explore" element={<RoomsPage />} />
              <Route path="/rooms/:roomName" element={<RoomChat />} />
              <Route path="/bots" element={<BotsPage />} />
              <Route path="*" element={<Navigate to="/dms" replace />} />
            </Route>
          </Routes>
        </MucProvider>
      </BotProvider>
    </ChatProvider>
  );
}

function App() {
  const { user, password, loading } = useAuth();

  console.log('[App] Auth state:', { user: !!user, hasPassword: !!password, loading });

  if (loading) {
    return (
      <div className="h-screen w-full bg-[var(--bg-primary)] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl shadow-xl overflow-hidden">
          <div className="p-8">
            <div className="flex items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-[var(--brand)] text-white flex items-center justify-center shadow-sm">
                <div className="w-6 h-6 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />
              </div>
            </div>

            <div className="mt-6 text-center">
              <h1 className="text-[20px] font-bold tracking-tight text-[var(--text-normal)]">Aether</h1>
              <p className="mt-1 text-[13px] font-medium text-[var(--text-muted)]">
                Connecting you to your spaces
              </p>
            </div>

            <div className="mt-7 space-y-3">
              <div className="h-3 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                <div className="h-full w-1/3 bg-[var(--brand)]/25 animate-pulse" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="h-10 rounded-2xl bg-[var(--bg-tertiary)] animate-pulse" />
                <div className="h-10 rounded-2xl bg-[var(--bg-tertiary)] animate-pulse" />
                <div className="h-10 rounded-2xl bg-[var(--bg-tertiary)] animate-pulse" />
              </div>
            </div>
          </div>

          <div className="h-1 bg-[var(--brand)]/20 overflow-hidden">
            <div className="h-full w-1/2 bg-[var(--brand)]/50 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!user || !password) {
    console.log('[App] No user/password, rendering Auth');
    return <Auth />;
  }

  return <AuthenticatedRoutes />;
}

export default App;
