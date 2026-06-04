import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';
import { useTranslation } from './LanguageContext';
import { API_URL } from './config';
import { supabase } from './supabase';
import { Lock, UserPlus, Hand } from 'lucide-react';

export default function Auth() {
  const { signIn, signUp, user, savePassword } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const isErrorMessage = (text: string) => {
    const normalized = text.toLowerCase();
    return normalized.includes('error') || normalized.includes('fail') || normalized.includes('taken');
  };

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

  const checkUsernameAvailable = async (name: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/users/${encodeURIComponent(name)}`);
      if (!response.ok) {
        throw new Error('Username availability check failed');
      }
      const data = (await response.json()) as { exists?: boolean };
      return !data.exists;
    } catch {
      throw new Error('Could not verify username availability. Please try again.');
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) {
      setMessage('Please enter your email address.');
      return;
    }
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}`,
    });

    setLoading(false);
    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Password reset email sent! Check your inbox.');
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
        const available = await checkUsernameAvailable(username.trim());
        if (!available) {
          setMessage('Username is already taken. Please choose another.');
          return;
        }
        const authData = await signUp(email, password, username);
        if (authData?.user?.id) {
          // Self-heal: Ensure public.users has the email populated
          await supabase.from('users').update({ email }).eq('id', authData.user.id);
        }
        setMessage('Account created! Check email to confirm, then login.');
        const localpart = email.split('@')[0];
        const synced = await syncUserToProsody(localpart, password);
        if (synced) {
          savePassword(password);
          setMessage('Account created and synced!');
        }
      } else {
        const authData = await signIn(email, password);
        if (authData?.user?.id) {
          // Self-heal: Ensure public.users has the email populated
          await supabase.from('users').update({ email }).eq('id', authData.user.id);
        }
        const localpart = email.split('@')[0];
        const synced = await syncUserToProsody(localpart, password);
        if (synced) {
          savePassword(password);
          setMessage('Logged in successfully!');
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

  // Forgot Password form
  if (isForgotPassword) {
    return (
      <div className="h-screen w-full bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-[440px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-8 shadow-lg">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[var(--brand)] mx-auto mb-4 flex items-center justify-center shadow-lg">
              <Lock size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-normal)] tracking-tight">Reset Password</h1>
            <p className="text-[var(--text-muted)] text-[15px] mt-2">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          <form onSubmit={handleForgotPassword} className="flex flex-col gap-5">
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--border)] outline-none text-[var(--text-normal)] text-[15px] px-4 py-3 rounded-xl focus:border-[var(--brand)] transition-colors"
                required
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--brand)] text-white font-bold text-[15px] py-3 rounded-xl hover:bg-[var(--brand-hover)] transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              onClick={() => {
                setIsForgotPassword(false);
                setMessage('');
              }}
              className="text-[var(--brand)] text-[14px] font-medium hover:underline"
            >
              ← Back to Login
            </button>
          </div>

          {message && (
            <p
              className={`mt-4 text-sm text-center font-medium ${isErrorMessage(message) ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-8 shadow-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[var(--brand)] mx-auto mb-4 flex items-center justify-center shadow-lg">
            {isSignUp ? <UserPlus size={32} className="text-white" /> : <Hand size={32} className="text-white" />}
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-normal)] tracking-tight">
            {isSignUp ? t('register') : t('welcome')}
          </h1>
          <p className="text-[var(--text-muted)] text-[15px] mt-2">
            {isSignUp ? 'Set up your Aether identity' : 'Sign in to continue chatting'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-5">
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
              Email <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--border)] outline-none text-[var(--text-normal)] text-[15px] px-4 py-3 rounded-xl focus:border-[var(--brand)] transition-colors"
              required
              placeholder="you@example.com"
            />
          </div>

          {isSignUp && (
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                Username <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--border)] outline-none text-[var(--text-normal)] text-[15px] px-4 py-3 rounded-xl focus:border-[var(--brand)] transition-colors"
                required
                placeholder="Choose a username"
              />
            </div>
          )}

          <div>
            <label className="block text-[12px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
              Password <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--border)] outline-none text-[var(--text-normal)] text-[15px] px-4 py-3 rounded-xl focus:border-[var(--brand)] transition-colors"
              required
              placeholder="••••••••"
            />
            {!isSignUp && (
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(true);
                  setMessage('');
                }}
                className="text-[var(--brand)] text-[13px] font-medium mt-2 block hover:underline"
              >
                {t('forgot_password')}
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--brand)] text-white font-bold text-[15px] py-3.5 rounded-xl hover:bg-[var(--brand-hover)] transition-colors mt-1 disabled:opacity-50 shadow-sm"
          >
            {loading ? '...' : isSignUp ? t('register') : t('sign_in')}
          </button>
        </form>

        <div className="mt-5 text-[14px] text-center">
          <span className="text-[var(--text-muted)]">
            {isSignUp ? t('have_account') + ' ' : t('no_account') + ' '}
          </span>
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage('');
            }}
            className="text-[var(--brand)] font-medium hover:underline"
          >
            {isSignUp ? t('sign_in') : t('register')}
          </button>
        </div>

        {message && (
          <p
            className={`mt-4 text-sm text-center font-medium ${isErrorMessage(message) ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
