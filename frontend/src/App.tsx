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

function AuthenticatedRoutes() {
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
  const { user } = useAuth();

  if (!user) {
    return <Auth />;
  }

  return <AuthenticatedRoutes />;
}

export default App;
