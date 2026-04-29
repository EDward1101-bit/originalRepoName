import { Routes, Route, Navigate } from 'react-router-dom';
import Auth from './Auth';
import Chat from './Chat';
import DMsPage from './DMsPage';
import Layout from './Layout';
import { useAuth } from './AuthContext';
import { ChatProvider } from './ChatContext';

function AuthenticatedRoutes() {
  return (
    <ChatProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/dms" element={<DMsPage />} />
          <Route path="/dms/:username" element={<Chat />} />
          <Route path="*" element={<Navigate to="/dms" replace />} />
        </Route>
      </Routes>
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
