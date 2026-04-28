import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Auth() {
  const { signIn, signUp, signOut, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const syncUserToProsody = async (email: string, password: string) => {
    const username = email.split('@')[0];
    try {
      const response = await fetch(`${API_URL}/api/auth/sync-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const userEmail = email.includes('@') ? email : `${email}@localhost`;

    try {
      if (isSignUp) {
        await signUp(userEmail, password);
        setMessage('Account created! Check email to confirm, then login.');
        const synced = await syncUserToProsody(userEmail, password);
        if (synced) {
          setMessage('Account created and synced to Prosody!');
        }
      } else {
        await signIn(userEmail, password);
        const synced = await syncUserToProsody(userEmail, password);
        if (synced) {
          setMessage('Logged in and synced to Prosody!');
        } else {
          setMessage('Logged in but sync failed.');
        }
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Logged in as {user.email}</h2>
        <p className="text-gray-600 mb-4">You are authenticated with Supabase.</p>
        <button
          onClick={signOut}
          className="w-full bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600"
        >
          Log Out
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md text-black">
      <h2 className="text-2xl font-bold mb-6">
        {isSignUp ? 'Sign Up with Supabase' : 'Login with Supabase'}
      </h2>
      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="alice@example.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Login'}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setIsSignUp(!isSignUp)}
        className="w-full mt-4 text-sm text-blue-500 hover:underline"
      >
        {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
      </button>
      {message && <p className="mt-4 text-center text-sm text-gray-600">{message}</p>}
    </div>
  );
}
