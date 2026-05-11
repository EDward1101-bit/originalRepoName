import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { useTranslation } from '../LanguageContext';
import { supabase } from '../supabase';
import { Language } from '../i18n';
import { Settings, User, Palette, Mic, Puzzle, LogOut, X, Camera, Loader2, Moon, Sun } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
  myUsername?: string;
}

const LANGUAGES = [
  { code: 'en', label: 'English (US)' },
  { code: 'ro', label: 'Română' },
];

export default function SettingsModal({ onClose, myUsername }: SettingsModalProps) {
  const { user, signOut, updateProfile } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const [activeTab, setActiveTab] = useState('General');
  const [theme, setTheme] = useState(
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

  // Profile picture
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    () => user?.user_metadata?.avatar_url || localStorage.getItem('aether_avatar') || null
  );
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Username change
  const [newUsername, setNewUsername] = useState('');
  const [usernameMsg, setUsernameMsg] = useState('');
  const [isChangingUsername, setIsChangingUsername] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const tabs = [
    { name: 'General', label: t('general'), Icon: Settings, category: t('user_settings') },
    { name: 'My Account', label: t('account'), Icon: User, category: t('user_settings') },
    { name: 'Appearance', label: t('appearance'), Icon: Palette, category: t('app_settings') },
    { name: 'Voice & Video', label: t('voice_video'), Icon: Mic, category: t('app_settings') },
    { name: 'Integrations', label: t('integrations'), Icon: Puzzle, category: t('app_settings') },
  ];

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    localStorage.setItem('aether_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLanguageChange = (code: string) => {
    setLanguage(code as Language);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `avatar_${myUsername}_${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage.from('chat-media').upload(fileName, file);
    setIsUploadingAvatar(false);

    if (error) {
      console.error('Avatar upload error:', error);
      return;
    }

    const { data } = supabase.storage.from('chat-media').getPublicUrl(fileName);
    if (data?.publicUrl) {
      setAvatarUrl(data.publicUrl);
      localStorage.setItem('aether_avatar', data.publicUrl);

      try {
        await updateProfile({ avatar_url: data.publicUrl });
        // Also update the public users table for others to see
        await supabase
          .from('users')
          .update({ avatar_url: data.publicUrl } as any)
          .eq('id', user?.id);
      } catch (err) {
        console.error('Failed to sync avatar to DB:', err);
      }
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg('Passwords do not match.');
      return;
    }

    setIsChangingPassword(true);

    // Ensure the session is fresh before calling updateUser
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      setPasswordMsg(`Error: Auth session missing! Please sign out and back in.`);
      setIsChangingPassword(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsChangingPassword(false);

    if (error) {
      setPasswordMsg(`Error: ${error.message}`);
    } else {
      setPasswordMsg('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const refreshUserData = useCallback(async () => {
    if (!user?.id) return;
    // Refresh the user's data to get updated metadata
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      // Trigger a refresh in AuthContext if available
      window.dispatchEvent(new CustomEvent('user-profile-updated'));
    }
  }, [user?.id]);

  const handleChangeUsername = async () => {
    if (!newUsername.trim()) {
      setUsernameMsg('Username cannot be empty.');
      return;
    }

    setIsChangingUsername(true);
    try {
      // Ensure the session is fresh before calling updateUser
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed?.session) {
        // Session truly gone — update only the public table and local state
        await supabase.from('users').update({ username: newUsername.trim() }).eq('id', user?.id);
        await refreshUserData();
        setUsernameMsg(t('profile_updated'));
        setNewUsername('');
        return;
      }

      await updateProfile({ display_name: newUsername.trim() });

      // Update public users table
      await supabase.from('users').update({ username: newUsername.trim() }).eq('id', user?.id);

      // Refresh user data to propagate changes
      await refreshUserData();

      setUsernameMsg(t('profile_updated'));
      setNewUsername('');
    } catch (error: any) {
      setUsernameMsg(`Error: ${error.message}`);
    } finally {
      setIsChangingUsername(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'General':
        return (
          <div className="max-w-2xl text-[var(--text-normal)]">
            <h2 className="text-2xl font-bold mb-2 tracking-tight">{t('general')}</h2>
            <p className="text-[var(--text-muted)] text-[15px] mb-8">
              {t('general_subtitle')}
            </p>

            {/* Profile Picture */}
            <div className="mb-8">
              <h3 className="text-[13px] font-bold text-[var(--text-muted)] mb-4 uppercase tracking-wide">
                {t('profile_picture')}
              </h3>
              <div className="flex items-center gap-6">
                <div className="relative group">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-20 h-20 rounded-full object-cover border-2 border-[var(--border)] shadow-md"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-[var(--brand)] text-white flex items-center justify-center text-3xl font-bold border-2 border-[var(--border)] shadow-md">
                      {user?.user_metadata?.display_name?.[0]?.toUpperCase() || myUsername?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {isUploadingAvatar ? <Loader2 size={28} className="text-white animate-spin" /> : <Camera size={28} className="text-white" />}
                  </button>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
                <div>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="bg-[var(--brand)] text-white px-5 py-2.5 rounded-xl font-bold text-[14px] hover:bg-[var(--brand-hover)] transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isUploadingAvatar ? 'Uploading...' : t('change_avatar')}
                  </button>
                  {avatarUrl && (
                    <button
                      onClick={async () => {
                        setAvatarUrl(null);
                        localStorage.removeItem('aether_avatar');
                        try {
                          await updateProfile({ avatar_url: '' });
                          await supabase
                            .from('users')
                            .update({ avatar_url: null } as any)
                            .eq('id', user?.id);
                        } catch (err) {
                          console.error('Failed to sync avatar removal to DB:', err);
                        }
                      }}
                      className="ml-3 text-[14px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors font-medium"
                    >
                      {t('remove')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Language */}
            <div className="mb-8">
              <h3 className="text-[13px] font-bold text-[var(--text-muted)] mb-4 uppercase tracking-wide">
                {t('language')}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`px-4 py-3 rounded-xl text-[14px] font-medium border transition-all ${
                      language === lang.code
                        ? 'bg-[var(--brand)] text-white border-[var(--brand)] shadow-sm'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-normal)] border-[var(--border)] hover:border-[var(--brand)] hover:text-[var(--brand)]'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Display Name Change */}
            <div className="mb-8">
              <h3 className="text-[13px] font-bold text-[var(--text-muted)] mb-4 uppercase tracking-wide">
                {t('display_name')}
              </h3>
              <p className="text-[14px] text-[var(--text-muted)] mb-3">
                {t('current')}:{' '}
                <span className="font-bold text-[var(--text-normal)]">
                  {user?.user_metadata?.display_name || myUsername}
                </span>
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder={`${t('enter_new')} ${t('display_name').toLowerCase()}`}
                  className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text-normal)] placeholder:text-[var(--text-muted)] text-[15px] outline-none focus:border-[var(--brand)] transition-colors"
                />
                <button
                  onClick={handleChangeUsername}
                  disabled={isChangingUsername || !newUsername.trim()}
                  className="bg-[var(--brand)] text-white px-6 py-3 rounded-xl font-bold text-[14px] hover:bg-[var(--brand-hover)] transition-colors disabled:opacity-50 shadow-sm"
                >
                  {isChangingUsername ? 'Saving...' : t('save')}
                </button>
              </div>
              {usernameMsg && (
                <p
                  className={`mt-2 text-[13px] font-medium ${usernameMsg.includes('Error') ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}
                >
                  {usernameMsg}
                </p>
              )}
            </div>
          </div>
        );

      case 'My Account':
        return (
          <div className="max-w-2xl text-[var(--text-normal)]">
            <h2 className="text-2xl font-bold mb-2 tracking-tight">{t('account')}</h2>
            <p className="text-[var(--text-muted)] text-[15px] mb-8">
              {t('account_subtitle')}
            </p>

            {/* Account Info Card */}
            <div className="bg-[var(--bg-tertiary)] rounded-2xl p-6 flex gap-5 items-center mb-8 border border-[var(--border)]">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover shadow-md"
                />
              ) : (
                <div className="w-16 h-16 bg-[var(--brand)] rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md">
                  {user?.user_metadata?.display_name?.[0]?.toUpperCase() || myUsername?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-1">
                <div className="text-[18px] font-bold">{myUsername}</div>
                <div className="text-[14px] text-[var(--text-muted)]">{user?.email}</div>
              </div>
            </div>

            {/* Change Password */}
            <div className="mb-8">
              <h3 className="text-[13px] font-bold text-[var(--text-muted)] mb-4 uppercase tracking-wide">
                {t('update_password')}
              </h3>
              <div className="flex flex-col gap-3">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('new_password') + ' (min. 6 characters)'}
                  className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text-normal)] placeholder:text-[var(--text-muted)] text-[15px] outline-none focus:border-[var(--brand)] transition-colors"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('confirm_password')}
                  className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text-normal)] placeholder:text-[var(--text-muted)] text-[15px] outline-none focus:border-[var(--brand)] transition-colors"
                />
                <div className="flex items-center gap-3 mt-1">
                  <button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !newPassword}
                    className="bg-[var(--brand)] text-white px-6 py-3 rounded-xl font-bold text-[14px] hover:bg-[var(--brand-hover)] transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {isChangingPassword ? 'Updating...' : t('update_password')}
                  </button>
                  {passwordMsg && (
                    <p
                      className={`text-[13px] font-medium ${passwordMsg.includes('Error') ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}
                    >
                      {passwordMsg}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div>
              <h3 className="text-[13px] font-bold text-[var(--danger)] mb-4 uppercase tracking-wide">
                {t('danger_zone')}
              </h3>
              <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[15px]">{t('delete_account')}</p>
                    <p className="text-[13px] text-[var(--text-muted)]">
                      {t('delete_account_desc')}
                    </p>
                  </div>
                  <button className="bg-[var(--danger)] text-white px-5 py-2.5 rounded-xl font-bold text-[14px] hover:bg-[var(--danger-strong)] transition-colors shadow-sm">
                    {t('delete_account')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'Appearance':
        return (
          <div className="max-w-2xl text-[var(--text-normal)]">
            <h2 className="text-2xl font-bold mb-2 tracking-tight">{t('appearance')}</h2>
            <p className="text-[var(--text-muted)] text-[15px] mb-8">
              {t('appearance_subtitle')}
            </p>

            <div className="mb-8">
              <h3 className="text-[13px] font-bold text-[var(--text-muted)] mb-4 uppercase tracking-wide">
                {t('theme')}
              </h3>
              <div className="flex gap-4">
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`flex-1 p-6 rounded-2xl border-2 transition-all ${
                    theme === 'dark'
                      ? 'border-[var(--brand)] bg-[var(--brand)]/10 shadow-md'
                      : 'border-[var(--border)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--preview-dark-bg)] mb-4 border border-[var(--preview-dark-border)] flex items-center justify-center">
                    <Moon size={24} className="text-[var(--brand)]" />
                  </div>
                  <p className="font-bold text-[16px] text-left">{t('dark')}</p>
                  <p className="text-[13px] text-[var(--text-muted)] text-left mt-1">
                    {t('easy_on_eyes')}
                  </p>
                </button>
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`flex-1 p-6 rounded-2xl border-2 transition-all ${
                    theme === 'light'
                      ? 'border-[var(--brand)] bg-[var(--brand)]/10 shadow-md'
                      : 'border-[var(--border)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--preview-light-bg)] mb-4 border border-[var(--preview-light-border)] flex items-center justify-center">
                    <Sun size={24} className="text-[var(--brand)]" />
                  </div>
                  <p className="font-bold text-[16px] text-left">{t('light')}</p>
                  <p className="text-[13px] text-[var(--text-muted)] text-left mt-1">
                    {t('clean_and_bright')}
                  </p>
                </button>
              </div>
            </div>
          </div>
        );

      case 'Voice & Video':
        return (
          <div className="max-w-2xl text-[var(--text-normal)]">
            <h2 className="text-2xl font-bold mb-2 tracking-tight">{t('voice_video')}</h2>
            <p className="text-[var(--text-muted)] text-[15px] mb-8">
              {t('select_your_input_and_output_devices')}
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[13px] font-bold text-[var(--text-muted)] uppercase mb-3 tracking-wide">
                  {t('input_device')}
                </label>
                <select className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-normal)] rounded-xl px-4 py-3 outline-none focus:border-[var(--brand)] transition-colors">
                  <option>Default</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[var(--text-muted)] uppercase mb-3 tracking-wide">
                  Output Device
                </label>
                <select className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-normal)] rounded-xl px-4 py-3 outline-none focus:border-[var(--brand)] transition-colors">
                  <option>Default</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 'Integrations':
        return (
          <div className="max-w-2xl text-[var(--text-normal)]">
            <h2 className="text-2xl font-bold mb-2 tracking-tight">{t('integrations')}</h2>
            <p className="text-[var(--text-muted)] text-[15px] mb-8">
              {t('integrations_subtitle')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[var(--bg-tertiary)] p-5 rounded-2xl flex items-center justify-between border border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center">
                    <Puzzle size={22} className="text-white" />
                  </div>
                  <span className="font-bold text-[15px]">{t('coming_soon')}</span>
                </div>
                <button className="text-[var(--brand)] text-[14px] font-bold opacity-50 cursor-not-allowed">
                  {t('connect')}
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-[var(--text-normal)]">
            <h2 className="text-2xl font-bold mb-4 tracking-tight">{activeTab}</h2>
            <p className="text-[var(--text-muted)]">{t('under_construction')}</p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <div className="w-[30%] bg-[var(--bg-secondary)] flex justify-end border-r border-[var(--border)]">
        <div className="w-64 py-14 px-4 flex flex-col gap-1">
          {tabs.map((tab, idx) => {
            const isNewCategory = idx === 0 || tabs[idx - 1].category !== tab.category;
            return (
              <div key={tab.name}>
                {isNewCategory && (
                  <div className="text-[11px] font-bold text-[var(--text-muted)] mb-2 mt-6 px-3 uppercase tracking-widest">
                    {tab.category}
                  </div>
                )}
                <button
                  onClick={() => setActiveTab(tab.name)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all flex items-center gap-3 ${
                    activeTab === tab.name
                      ? 'bg-[var(--brand)]/10 text-[var(--brand)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)]'
                  }`}
                >
                  <tab.Icon size={20} />
                  {tab.label}
                </button>
              </div>
            );
          })}
          <div className="h-[1px] bg-[var(--border)] my-3 mx-2" />
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2.5 rounded-xl text-[14px] font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors flex items-center gap-3"
          >
            <LogOut size={20} />
            {t('logout')}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-[var(--bg-primary)] relative">
        <div className="py-14 px-10 h-full overflow-y-auto">{renderContent()}</div>

        {/* Close Button */}
        <div className="absolute top-14 right-10 flex flex-col items-center gap-1">
          <button
            onClick={onClose}
            className="w-10 h-10 border-2 border-[var(--text-muted)] rounded-full flex items-center justify-center text-[var(--text-muted)] hover:border-[var(--text-normal)] hover:text-[var(--text-normal)] transition-colors"
          >
            <X size={20} />
          </button>
          <span className="text-[11px] font-bold text-[var(--text-muted)] tracking-wide">ESC</span>
        </div>
      </div>
    </div>
  );
}
