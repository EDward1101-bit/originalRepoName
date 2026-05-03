import { useState } from 'react';
import { useAuth } from '../AuthContext';

interface SettingsModalProps {
  onClose: () => void;
  myUsername?: string;
}

export default function SettingsModal({ onClose, myUsername }: SettingsModalProps) {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('My Account');
  const [theme, setTheme] = useState(document.documentElement.classList.contains('dark') ? 'dark' : 'light');

  const tabs = [
    { name: 'My Account', category: 'USER SETTINGS' },
    { name: 'Profiles', category: 'USER SETTINGS' },
    { name: 'Appearance', category: 'APP SETTINGS' },
    { name: 'Language', category: 'APP SETTINGS' },
    { name: 'Voice & Video', category: 'APP SETTINGS' },
    { name: 'Integrations', category: 'APP SETTINGS' },
  ];

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'My Account':
        return (
          <div className="max-w-2xl text-[var(--text-normal)]">
            <h2 className="text-xl font-bold mb-6">My Account</h2>
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 flex gap-4 items-center">
              <div className="w-20 h-20 bg-[var(--brand)] rounded-full flex items-center justify-center text-white text-3xl font-bold">
                {myUsername?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                <div className="text-lg font-bold">{myUsername}</div>
                <div className="text-sm text-[var(--text-muted)]">{user?.email}</div>
              </div>
              <button className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-4 py-2 rounded transition-colors text-sm font-semibold">
                Edit User Profile
              </button>
            </div>
          </div>
        );
      case 'Appearance':
        return (
          <div className="max-w-2xl text-[var(--text-normal)]">
            <h2 className="text-xl font-bold mb-6">Appearance</h2>
            <div className="mb-4">
              <h3 className="text-xs font-bold text-[var(--text-muted)] mb-2 uppercase tracking-wide">Theme</h3>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="theme" checked={theme === 'dark'} onChange={() => handleThemeChange('dark')} className="accent-[var(--brand)]" />
                  <span>Dark</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="theme" checked={theme === 'light'} onChange={() => handleThemeChange('light')} className="accent-[var(--brand)]" />
                  <span>Light</span>
                </label>
              </div>
            </div>
          </div>
        );
      case 'Language':
        return (
          <div className="max-w-2xl text-[var(--text-normal)]">
            <h2 className="text-xl font-bold mb-6">Language</h2>
            <select className="bg-[var(--input-bg)] border-none text-[var(--text-normal)] rounded p-2 outline-none w-64">
              <option value="en">English (US)</option>
              <option value="ro">Română</option>
              <option value="fr">Français</option>
            </select>
          </div>
        );
      case 'Integrations':
        return (
          <div className="max-w-2xl text-[var(--text-normal)]">
            <h2 className="text-xl font-bold mb-6">Integrations</h2>
            <p className="text-[var(--text-muted)] text-sm mb-4">Connect your favorite apps.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--bg-tertiary)] p-4 rounded-xl flex items-center justify-between">
                <span className="font-bold">Discord Placeholder</span>
                <button className="text-[var(--brand)] text-sm font-semibold">Connect</button>
              </div>
            </div>
          </div>
        );
      case 'Voice & Video':
        return (
          <div className="max-w-2xl text-[var(--text-normal)]">
            <h2 className="text-xl font-bold mb-6">Voice & Video Settings</h2>
            <p className="text-[var(--text-muted)] text-sm">Select your input and output devices.</p>
            {/* Placeholders for settings */}
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Input Device</label>
                <select className="bg-[var(--input-bg)] border-none text-[var(--text-normal)] rounded p-2 outline-none w-full">
                  <option>Default</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Output Device</label>
                <select className="bg-[var(--input-bg)] border-none text-[var(--text-normal)] rounded p-2 outline-none w-full">
                  <option>Default</option>
                </select>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="text-[var(--text-normal)]">
            <h2 className="text-xl font-bold mb-4">{activeTab}</h2>
            <p className="text-[var(--text-muted)]">This section is under construction.</p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <div className="w-[30%] bg-[var(--bg-secondary)] flex justify-end">
        <div className="w-64 py-14 px-4 flex flex-col gap-1">
          {tabs.map((tab, idx) => {
            const isNewCategory = idx === 0 || tabs[idx - 1].category !== tab.category;
            return (
              <div key={tab.name}>
                {isNewCategory && (
                  <div className="text-xs font-bold text-[var(--text-muted)] mb-2 mt-4 px-2 uppercase">
                    {tab.category}
                  </div>
                )}
                <button
                  onClick={() => setActiveTab(tab.name)}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    activeTab === tab.name
                      ? 'bg-[var(--bg-modifier-selected)] text-[var(--text-normal)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)]'
                  }`}
                >
                  {tab.name}
                </button>
              </div>
            );
          })}
          <div className="h-[1px] bg-[var(--border)] my-2 mx-2" />
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-1.5 rounded text-sm font-medium text-[var(--color-status-dnd)] hover:bg-[var(--bg-modifier-hover)] transition-colors"
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-[var(--bg-primary)] relative">
        <div className="py-14 px-10 h-full overflow-y-auto">
          {renderContent()}
        </div>
        
        {/* Close Button */}
        <div className="absolute top-14 right-10 flex flex-col items-center gap-1">
          <button
            onClick={onClose}
            className="w-9 h-9 border-2 border-[var(--text-muted)] rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
          <span className="text-xs font-semibold text-[var(--text-muted)]">ESC</span>
        </div>
      </div>
    </div>
  );
}
