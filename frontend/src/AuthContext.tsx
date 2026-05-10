import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type SignInData = Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data'];
type SignUpData = Awaited<ReturnType<typeof supabase.auth.signUp>>['data'];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  password: string | null;
  signIn: (email: string, password: string) => Promise<SignInData>;
  signUp: (email: string, password: string, username?: string) => Promise<SignUpData>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (updates: { display_name?: string; avatar_url?: string }) => Promise<void>;
  savePassword: (pwd: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState<string | null>(() => {
    return localStorage.getItem('xmpp_password');
  });

  useEffect(() => {
    if (password) {
      localStorage.setItem('xmpp_password', password);
    }
  }, [password]);

  // Listen for profile update events from SettingsModal
  useEffect(() => {
    const handleProfileUpdate = () => {
      refreshUser();
    };
    window.addEventListener('user-profile-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('user-profile-updated', handleProfileUpdate);
    };
  }, []);

  useEffect(() => {
    // Safety timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('[Auth] Session check timed out, proceeding...');
        setLoading(false);
      }
    }, 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false); // Also set loading false on state change
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async (email: string, password: string, username?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username || email.split('@')[0],
          display_name: username || email.split('@')[0],
          email: email
        },
      },
    });
    if (error) throw error;
    return data;
  };

  const savePassword = (pwd: string) => {
    setPassword(pwd);
  };

  const refreshUser = async () => {
    const {
      data: { user: updatedUser },
      error,
    } = await supabase.auth.getUser();
    if (!error && updatedUser) {
      setUser(updatedUser);
    }
  };

  const updateProfile = async (updates: { display_name?: string; avatar_url?: string }) => {
    const { data, error } = await supabase.auth.updateUser({
      data: updates,
    });
    if (error) throw error;
    if (data.user) {
      setUser(data.user);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setPassword(null);
    localStorage.removeItem('xmpp_password');
    localStorage.removeItem('xmpp_jid');
    localStorage.removeItem('aether_avatar');
    localStorage.removeItem('aether_lang');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        password,
        signIn,
        signUp,
        signOut,
        refreshUser,
        updateProfile,
        savePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
