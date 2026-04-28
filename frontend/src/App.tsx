import Auth from './Auth';
import Chat from './Chat';
import { useAuth } from './AuthContext';

function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100 text-black">
      <h1 className="text-2xl font-bold text-center p-8">XMPP Chat</h1>
      {user ? <Chat /> : <Auth />}
    </div>
  );
}

export default App;
