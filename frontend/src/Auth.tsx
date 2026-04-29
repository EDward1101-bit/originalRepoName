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
      <div className="h-screen w-full bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-surface border border-surface-variant rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-on-background mb-2">Logged in as {user.email}</h2>
          <p className="text-sm text-outline mb-6">You are authenticated with Supabase.</p>
          <button
            onClick={signOut}
            className="w-full bg-error text-on-error font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
          >
            Log Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-on-background tracking-tight">Aether Chat</h1>
          <p className="text-sm text-outline mt-1">
            {isSignUp ? 'Create an account to get started' : 'Sign in to continue'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-surface-variant rounded-2xl p-8 shadow-sm">
          <h2 className="text-lg font-bold text-on-background mb-6">
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </h2>

          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-outline mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-container border border-surface-variant outline-none text-on-surface placeholder:text-outline text-sm py-3 px-4 rounded-xl focus:border-primary transition-colors"
                placeholder="alice@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-outline mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container border border-surface-variant outline-none text-on-surface placeholder:text-outline text-sm py-3 px-4 rounded-xl focus:border-primary transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-on-primary font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-surface-variant text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage('');
              }}
              className="text-sm text-primary hover:underline cursor-pointer"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>

          {message && (
            <p
              className={`mt-4 text-center text-sm px-4 py-3 rounded-xl ${
                message.toLowerCase().includes('fail') ||
                message.toLowerCase().includes('error') ||
                message.toLowerCase().includes('invalid')
                  ? 'bg-error-container text-on-error-container'
                  : 'bg-tertiary-container text-on-tertiary-container'
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
