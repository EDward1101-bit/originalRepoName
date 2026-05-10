import { useTranslation } from '../LanguageContext';
import { Globe } from 'lucide-react';

export default function LanguageSelector() {
  const { language, setLanguage } = useTranslation();

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ro', name: 'Română', flag: '🇷🇴' },
  ];

  return (
    <div className="flex items-center gap-3">
      <Globe size={16} className="text-[var(--text-muted)]" />
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as 'en' | 'ro')}
        className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-[var(--text-normal)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}
