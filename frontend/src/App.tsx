import { Routes, Route, Navigate } from 'react-router-dom';
import Auth from './Auth';
import Chat from './Chat';
import DMsPage from './DMsPage';
import Layout from './Layout';
import { useAuth } from './AuthContext';
import { ChatProvider } from './ChatContext';
import { MucProvider } from './MucContext';
import RoomsPage from './RoomsPage';
import RoomChat from './RoomChat';

console.log('[App] Starting...');

function AuthenticatedRoutes() {
  console.log('[App] Rendering AuthenticatedRoutes');
  return (
    <ChatProvider>
      <MucProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/dms" element={<DMsPage />} />
            <Route path="/dms/:username" element={<Chat />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/rooms/:roomName" element={<RoomChat />} />
            <Route path="*" element={<Navigate to="/dms" replace />} />
          </Route>
        </Routes>
      </MucProvider>
    </ChatProvider>
  );
}

function App() {
  const { user, password, loading } = useAuth();

  console.log('[App] Auth state:', { user: !!user, hasPassword: !!password, loading });

  if (loading) {
    return (
      <div className="h-screen w-full bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[var(--text-muted)] font-medium">Loading Aether...</p>
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
