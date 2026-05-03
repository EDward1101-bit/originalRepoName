import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';
import { useTranslation } from './LanguageContext';
import { API_URL } from './config';
import { supabase } from './supabase';

export default function Auth() {
  const { signIn, signUp, signOut, user } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

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
        await signUp(email, password, username);
        setMessage('Account created! Check email to confirm, then login.');
        const synced = await syncUserToProsody(username, password);
        if (synced) {
          setMessage('Account created and synced!');
        }
      } else {
        await signIn(email, password);
        const localpart = email.split('@')[0];
        const synced = await syncUserToProsody(localpart, password);
        if (synced) {
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

  if (user) {
    return (
      <div className="h-screen w-full bg-[#0b0714] flex items-center justify-center p-6 text-white">
        <div className="w-full max-w-sm bg-[#120c1d] border border-[#241a38] rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold mb-2">Logged in as {user.email}</h2>
          <p className="text-sm text-[#94a3b8] mb-6">You are authenticated with Aether.</p>
          <button
            onClick={signOut}
            className="w-full bg-[#ef4444] text-white font-bold py-3 rounded-xl hover:bg-[#dc2626] transition-colors"
          >
            Log Out
          </button>
        </div>
      </div>
    );
  }

  // Forgot Password form
  if (isForgotPassword) {
    return (
      <div className="h-screen w-full bg-[#0b0714] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background glow */}
        <div className="fixed inset-0 pointer-events-none opacity-40 z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#14b8a6] rounded-full blur-[120px] mix-blend-screen opacity-20"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#8b5cf6] rounded-full blur-[120px] mix-blend-screen opacity-20"></div>
        </div>

        <div className="w-full max-w-[440px] bg-[#120c1d] border border-[#241a38] rounded-2xl p-8 shadow-2xl relative z-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#14b8a6] mx-auto mb-4 flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-white text-[32px]">lock_reset</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Reset Password</h1>
            <p className="text-[#94a3b8] text-[15px] mt-2">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          <form onSubmit={handleForgotPassword} className="flex flex-col gap-5">
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-widest text-[#94a3b8] mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#191228] border border-[#241a38] outline-none text-white text-[15px] px-4 py-3 rounded-xl focus:border-[#14b8a6] transition-colors"
                required
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#14b8a6] text-white font-bold text-[15px] py-3 rounded-xl hover:bg-[#0d9488] transition-colors disabled:opacity-50 shadow-md"
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
              className="text-[#14b8a6] text-[14px] font-medium hover:underline"
            >
              ← Back to Login
            </button>
          </div>

          {message && (
            <p
              className={`mt-4 text-sm text-center font-medium ${message.includes('Error') ? 'text-[#ef4444]' : 'text-[#10b981]'}`}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#0b0714] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none opacity-40 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#14b8a6] rounded-full blur-[120px] mix-blend-screen opacity-20"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#8b5cf6] rounded-full blur-[120px] mix-blend-screen opacity-20"></div>
      </div>

      <div className="w-full max-w-[440px] bg-[#120c1d] border border-[#241a38] rounded-2xl p-8 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#14b8a6] mx-auto mb-4 flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-white text-[32px]">
              {isSignUp ? 'person_add' : 'waving_hand'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {isSignUp ? t('register') : t('welcome')}
          </h1>
          <p className="text-[#94a3b8] text-[15px] mt-2">
            {isSignUp
              ? 'Set up your Aether identity'
              : 'Sign in to continue chatting'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-5">
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-widest text-[#94a3b8] mb-2">
              Email <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#191228] border border-[#241a38] outline-none text-white text-[15px] px-4 py-3 rounded-xl focus:border-[#14b8a6] transition-colors"
              required
              placeholder="you@example.com"
            />
          </div>

          {isSignUp && (
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-widest text-[#94a3b8] mb-2">
                Username <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#191228] border border-[#241a38] outline-none text-white text-[15px] px-4 py-3 rounded-xl focus:border-[#14b8a6] transition-colors"
                required
                placeholder="Choose a username"
              />
            </div>
          )}

          <div>
            <label className="block text-[12px] font-bold uppercase tracking-widest text-[#94a3b8] mb-2">
              Password <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#191228] border border-[#241a38] outline-none text-white text-[15px] px-4 py-3 rounded-xl focus:border-[#14b8a6] transition-colors"
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
                className="text-[#14b8a6] text-[13px] font-medium mt-2 block hover:underline"
              >
                {t('forgot_password')}
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#14b8a6] text-white font-bold text-[15px] py-3.5 rounded-xl hover:bg-[#0d9488] transition-colors mt-1 disabled:opacity-50 shadow-md"
          >
            {loading ? '...' : isSignUp ? t('register') : t('sign_in')}
          </button>
        </form>

        <div className="mt-5 text-[14px] text-center">
          <span className="text-[#94a3b8]">
            {isSignUp ? 'Already have an account? ' : 'Need an account? '}
          </span>
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage('');
            }}
            className="text-[#14b8a6] font-medium hover:underline"
          >
            {isSignUp ? 'Sign In' : 'Register'}
          </button>
        </div>

        {message && (
          <p
            className={`mt-4 text-sm text-center font-medium ${message.includes('fail') || message.includes('Error') || message.includes('error') ? 'text-[#ef4444]' : 'text-[#10b981]'}`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
