import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';
import { API_URL } from './config';

export default function Auth() {
  const { signIn, signUp, signOut, user } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const syncUserToProsody = async (username: string, password: string) => {
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

    try {
      if (isSignUp) {
        if (!username) {
          throw new Error('Username is required for sign up.');
        }
        await signUp(email, password); // Note: Assuming signUp saves metadata or we do it post-signup
        setMessage('Account created! Check email to confirm, then login.');
        const synced = await syncUserToProsody(username, password);
        if (synced) {
          setMessage('Account created and synced to Prosody!');
        }
      } else {
        await signIn(email, password);
        // We use email localpart as a fallback if username isn't known at sign-in time
        const localpart = email.split('@')[0];
        const synced = await syncUserToProsody(localpart, password);
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
      <div className="h-screen w-full bg-[var(--bg-primary)] flex items-center justify-center p-6 text-[var(--text-normal)]">
        <div className="w-full max-w-sm bg-[var(--bg-secondary)] rounded p-8 shadow-md">
          <h2 className="text-xl font-bold mb-2">Logged in as {user.email}</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            You are authenticated with Supabase.
          </p>
          <button
            onClick={signOut}
            className="w-full bg-[var(--color-status-dnd)] text-white font-semibold py-3 rounded hover:opacity-90 transition-opacity"
          >
            Log Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#313338] flex items-center justify-center p-4">
      <div className="w-full max-w-[480px] bg-[#313338] sm:bg-[#2B2D31] sm:shadow-lg rounded-[5px] p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#F2F3F5]">
            {isSignUp ? 'Create an account' : 'Welcome back!'}
          </h1>
          <p className="text-[#B5BAC1] text-[15px] mt-2">
            {isSignUp ? '' : "We're so excited to see you again!"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-[#B5BAC1] mb-2">
              Email <span className="text-[#DA373C]">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#1E1F22] outline-none text-[#DBDEE1] text-[15px] p-[10px] rounded focus:ring-2 focus:ring-[#00A8FC]"
              required
            />
          </div>

          {isSignUp && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#B5BAC1] mb-2">
                Username <span className="text-[#DA373C]">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#1E1F22] outline-none text-[#DBDEE1] text-[15px] p-[10px] rounded focus:ring-2 focus:ring-[#00A8FC]"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-[#B5BAC1] mb-2">
              Password <span className="text-[#DA373C]">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#1E1F22] outline-none text-[#DBDEE1] text-[15px] p-[10px] rounded focus:ring-2 focus:ring-[#00A8FC]"
              required
            />
            {!isSignUp && (
              <a href="#" className="text-[#00A8FC] text-sm font-medium mt-2 block hover:underline">
                Forgot your password?
              </a>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#5865F2] text-white font-medium text-[15px] py-[10px] rounded hover:bg-[#4752C4] transition-colors mt-2 disabled:opacity-50"
          >
            {loading ? 'Processing...' : isSignUp ? 'Continue' : 'Log In'}
          </button>
        </form>

        <div className="mt-4 text-sm">
          <span className="text-[#949BA4]">
            {isSignUp ? (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setIsSignUp(false);
                }}
                className="text-[#00A8FC] hover:underline"
              >
                Already have an account?
              </a>
            ) : (
              'Need an account? '
            )}
          </span>
          {!isSignUp && (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setIsSignUp(true);
                setMessage('');
              }}
              className="text-[#00A8FC] hover:underline"
            >
              Register
            </a>
          )}
        </div>

        {message && (
          <p
            className={`mt-4 text-sm ${message.includes('fail') || message.includes('error') ? 'text-[#DA373C]' : 'text-[#23A559]'}`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
