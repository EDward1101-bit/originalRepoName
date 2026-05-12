import React, { useState } from 'react';
import { useBotContext } from './BotContext';
import type { BotDefinition, RegisteredBot } from './BotContext';
import { useMucContext } from './MucContext';
import { useChatContext } from './ChatContext';
import { useTranslation } from './LanguageContext';
import {
  CheckCircle2,
  XCircle,
  Bot,
  Shield,
  ChevronRight,
  Plus,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

type Panel = 'manage' | 'register';

export default function BotsPage() {
  const { allBots, isBotInRoom, inviteBot, removeBot, registerBot, deleteBot } = useBotContext();
  const { availableRooms } = useMucContext();
  const { myUsername } = useChatContext();
  const { t } = useTranslation();

  const [selectedBot, setSelectedBot] = useState<BotDefinition | null>(allBots[0] ?? null);
  const [panel, setPanel] = useState<Panel>('manage');
  const [loadingRoomId, setLoadingRoomId] = useState<string | null>(null);
  const [deletingBotId, setDeletingBotId] = useState<string | null>(null);
  const [botToDelete, setBotToDelete] = useState<BotDefinition | null>(null);

  // Registration form
  const [form, setForm] = useState({ name: '', description: '', emoji: '🤖', webhookUrl: '' });
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registeredResult, setRegisteredResult] = useState<RegisteredBot | null>(null);
  const [copied, setCopied] = useState(false);

  const getLocalizedDescription = (desc: string) => {
    if (desc === 'Automatically censors profanity in messages before they are sent. All room members see clean, filtered text.') return t('swear_shield_desc');
    if (desc === 'Says pong!') return t('ping_bot_desc');
    return desc;
  };

  const myRooms = availableRooms.filter((r) => r.created_by === myUsername);

  const handleToggle = async (roomId: string, roomName: string, botId: string) => {
    setLoadingRoomId(roomId);
    try {
      if (isBotInRoom(roomName, botId)) {
        await removeBot(roomId, roomName, botId);
      } else {
        await inviteBot(roomId, roomName, botId);
      }
    } finally {
      setLoadingRoomId(null);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.webhookUrl.trim()) return;
    setIsRegistering(true);
    setRegisterError(null);
    setRegisteredResult(null);
    try {
      const result = await registerBot({
        name: form.name,
        description: form.description,
        emoji: form.emoji || '🤖',
        webhookUrl: form.webhookUrl,
      });
      setRegisteredResult(result);
      setForm({ name: '', description: '', emoji: '🤖', webhookUrl: '' });
    } catch (err: any) {
      setRegisterError(err.message || 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleCopySecret = () => {
    if (registeredResult?.webhook_secret) {
      navigator.clipboard.writeText(registeredResult.webhook_secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const confirmDeleteBot = async () => {
    if (!botToDelete) return;
    setDeletingBotId(botToDelete.id);
    try {
      await deleteBot(botToDelete.id);
      if (selectedBot?.id === botToDelete.id) setSelectedBot(null);
    } finally {
      setDeletingBotId(null);
      setBotToDelete(null);
    }
  };

  const inputCls =
    'w-full bg-[var(--input-bg,var(--bg-tertiary))] border border-(--border) rounded-xl px-3 py-2.5 text-(--text-normal) text-[14px] focus:outline-none focus:ring-2 focus:ring-(--brand)/50 transition-all placeholder:text-(--text-muted)';

  return (
    <div className="flex flex-col h-full bg-(--bg-primary) text-(--text-normal)">
      {/* Header */}
      <div className="flex-none p-6 bg-(--bg-secondary) border-b border-(--border) relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-(--brand) to-(--accent) opacity-20 pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-(--brand)/20 flex items-center justify-center">
              <Bot size={22} className="text-(--brand)" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('bot_directory')}</h1>
              <p className="text-sm text-(--text-muted) mt-0.5">
                {t('invite_bots')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setPanel(panel === 'register' ? 'manage' : 'register')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all ${
              panel === 'register'
                ? 'bg-(--brand) text-white'
                : 'bg-(--bg-primary) border border-(--border) text-(--text-normal) hover:border-(--brand)/50'
            }`}
          >
            <Plus size={15} />
            {t('register_bot')}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Bot List */}
        <div className="flex-1 overflow-y-auto p-8">
          <h2 className="text-[13px] font-bold text-(--text-muted) uppercase tracking-wider mb-4">
            {t('available_bots')} — {allBots.length}
          </h2>

          {allBots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-(--bg-secondary) flex items-center justify-center mb-4 text-4xl">
                🤖
              </div>
              <p className="text-[15px] text-(--text-muted) italic">{t('no_bots')}</p>
              <p className="text-[12px] text-(--text-muted) opacity-60 mt-1">
                {t('be_the_first')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {allBots.map((bot) => {
                const isSelected = selectedBot?.id === bot.id && panel === 'manage';
                const isOwner = bot.ownerUsername === myUsername;
                return (
                  <button
                    key={bot.id}
                    onClick={() => { setSelectedBot(bot); setPanel('manage'); }}
                    className={`w-full text-left p-5 rounded-2xl border transition-all duration-200 flex items-start gap-4 group ${
                      isSelected
                        ? 'bg-(--brand)/10 border-(--brand)/40 shadow-md'
                        : 'bg-(--bg-secondary) border-(--border) hover:border-(--brand)/30 hover:-translate-y-0.5 hover:shadow-lg'
                    }`}
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-inner transition-all ${
                        isSelected ? 'bg-(--brand)/20' : 'bg-(--bg-tertiary) group-hover:bg-(--brand)/10'
                      }`}
                    >
                      {bot.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-[16px]">{bot.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-(--brand)/15 text-(--brand) uppercase tracking-wide">
                          BOT
                        </span>
                        {bot.isBuiltin && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-(--success)/15 text-(--success) uppercase tracking-wide">
                            {t('official')}
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                          bot.isOnline
                            ? 'bg-(--status-online)/15 text-(--status-online)'
                            : 'bg-(--text-muted)/10 text-(--text-muted)'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            bot.isOnline ? 'bg-(--status-online) shadow-[0_0_4px_var(--status-online)]' : 'bg-(--text-muted)'
                          }`} />
                          {bot.isOnline ? t('online') : t('offline')}
                        </span>
                      </div>
                      <p className="text-[13px] text-(--text-muted) leading-relaxed">
                        {getLocalizedDescription(bot.description)}
                      </p>
                      {bot.webhookUrl && (
                        <p className="text-[11px] text-(--text-muted) opacity-50 mt-1 flex items-center gap-1">
                          <ExternalLink size={10} />
                          {bot.webhookUrl}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isOwner && !bot.isBuiltin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setBotToDelete(bot); }}
                          disabled={deletingBotId === bot.id}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-(--text-muted) hover:text-(--danger) hover:bg-(--danger)/10 transition-all opacity-0 group-hover:opacity-100"
                          title="Delete bot"
                        >
                          {deletingBotId === bot.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      )}
                      <ChevronRight
                        size={18}
                        className={`transition-all ${
                          isSelected ? 'text-(--brand) rotate-90' : 'text-(--text-muted)'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="w-[380px] bg-(--bg-secondary) border-l border-(--border) flex flex-col overflow-hidden hidden lg:flex">

          {/* ── Register Panel ── */}
          {panel === 'register' && (
            <>
              <div className="p-6 border-b border-(--border)">
                <h3 className="font-bold text-[18px]">{t('register_bot')}</h3>
                <p className="text-[12px] text-(--text-muted) mt-1 leading-relaxed">
                  {t('webhook_desc')}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {registeredResult ? (
                  <div className="flex flex-col gap-4">
                    <div className="p-4 bg-(--success)/10 border border-(--success)/30 rounded-xl">
                      <p className="text-[13px] font-bold text-(--success) mb-1">{t('bot_registered')}</p>
                      <p className="text-[12px] text-(--text-muted) leading-relaxed">
                        {t('copy_secret_warning')}
                      </p>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider block mb-2">
                        {t('bot_id')}
                      </label>
                      <code className="text-[13px] bg-(--bg-tertiary) px-3 py-2 rounded-lg block text-(--text-normal) font-mono">
                        {registeredResult.bot_id}
                      </code>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider block mb-2">
                        {t('webhook_secret')}
                      </label>
                      <div className="flex gap-2">
                        <code className="flex-1 text-[12px] bg-(--bg-tertiary) px-3 py-2 rounded-lg text-(--text-normal) font-mono truncate border border-(--brand)/30">
                          {registeredResult.webhook_secret}
                        </code>
                        <button
                          onClick={handleCopySecret}
                          className="px-3 py-2 rounded-lg bg-(--brand) text-white hover:bg-(--brand-hover) transition-colors shrink-0"
                        >
                          {copied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => setRegisteredResult(null)}
                      className="w-full py-2.5 rounded-xl bg-(--brand) text-white font-bold text-[13px] hover:bg-(--brand-hover) transition-colors mt-2"
                    >
                      {t('register_another_bot')}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRegister} className="flex flex-col gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider block mb-2">
                        {t('bot_name')}
                      </label>
                      <input
                        className={inputCls}
                        placeholder="e.g. MyFilterBot"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider block mb-2">
                        {t('description')}
                      </label>
                      <textarea
                        className={`${inputCls} resize-none h-20`}
                        placeholder={t('bot_desc_placeholder')}
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider block mb-2">
                        {t('emoji_icon')}
                      </label>
                      <input
                        className={inputCls}
                        placeholder="🤖"
                        value={form.emoji}
                        onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                        maxLength={4}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider block">
                          {t('webhook_url')}
                        </label>
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, webhookUrl: 'http://172.17.0.1:4001/webhook' }))}
                          className="text-[10px] font-bold text-(--brand) hover:opacity-80 uppercase tracking-wide bg-(--brand)/10 px-2 py-1 rounded transition-colors"
                        >
                          {t('localhost')}
                        </button>
                      </div>
                      <input
                        className={inputCls}
                        placeholder="https://my-bot.example.com/webhook"
                        value={form.webhookUrl}
                        onChange={(e) => setForm((f) => ({ ...f, webhookUrl: e.target.value }))}
                        type="url"
                        required
                      />
                    </div>
                    {registerError && (
                      <p className="text-[12px] text-(--danger) bg-(--danger)/10 px-3 py-2 rounded-lg">
                        {registerError}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={isRegistering || !form.name.trim() || !form.webhookUrl.trim()}
                      className="w-full py-2.5 rounded-xl bg-(--brand) text-white font-bold text-[13px] hover:bg-(--brand-hover) transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isRegistering ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                      {isRegistering ? t('registering') : t('register_bot')}
                    </button>
                  </form>
                )}
              </div>
            </>
          )}

          {/* ── Manage Panel ── */}
          {panel === 'manage' && selectedBot && (
            <>
              <div className="p-6 border-b border-(--border)">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-(--brand)/15 flex items-center justify-center text-4xl shadow-inner">
                    {selectedBot.emoji}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[18px]">{selectedBot.name}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-(--brand)/15 text-(--brand) uppercase tracking-wide">BOT</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                        selectedBot.isOnline ? 'text-(--status-online)' : 'text-(--text-muted)'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          selectedBot.isOnline ? 'bg-(--status-online) shadow-[0_0_6px_var(--status-online)]' : 'bg-(--text-muted)'
                        }`} />
                        {selectedBot.isOnline ? t('online') : t('offline')}
                      </span>
                      <span className="text-[11px] text-(--text-muted)">
                        · {selectedBot.isBuiltin ? t('official_always_available') : t('by_author').replace('{author}', selectedBot.ownerUsername ?? t('unknown'))}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[13px] text-(--text-muted) leading-relaxed">
                  {getLocalizedDescription(selectedBot.description)}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Shield size={14} className="text-(--text-muted)" />
                  <p className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider">
                    {t('your_rooms')}
                  </p>
                </div>

                {myRooms.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="text-4xl mb-3">🏠</div>
                    <p className="text-[13px] text-(--text-muted) italic">
                      {t('no_rooms_created')}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {myRooms.map((room) => {
                      const active = isBotInRoom(room.name, selectedBot.id);
                      const isLoading = loadingRoomId === room.id;
                      return (
                        <div
                          key={room.id}
                          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                            active
                              ? 'bg-(--brand)/8 border-(--brand)/30'
                              : 'bg-(--bg-primary) border-(--border)'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                                active ? 'bg-(--brand) text-white' : 'bg-(--bg-tertiary) text-(--text-muted)'
                              }`}
                            >
                              #
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold truncate">{room.name}</p>
                              {active && <p className="text-[11px] text-(--brand) font-medium">{t('active')}</p>}
                            </div>
                          </div>
                          <button
                            onClick={() => handleToggle(room.id, room.name, selectedBot.id)}
                            disabled={isLoading}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all shrink-0 disabled:opacity-50 ${
                              active
                                ? 'bg-(--danger)/10 text-(--danger) hover:bg-(--danger)/20'
                                : 'bg-(--brand) text-white hover:bg-(--brand-hover) shadow-sm'
                            }`}
                          >
                            {isLoading ? (
                              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : active ? (
                              <><XCircle size={13} /> {t('remove')}</>
                            ) : (
                              <><CheckCircle2 size={13} /> {t('invite')}</>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {panel === 'manage' && !selectedBot && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="text-5xl mb-4">🤖</div>
              <p className="text-[14px] text-(--text-muted) italic">{t('select_bot_manage')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Bot Modal */}
      {botToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-(--bg-primary) border border-(--border) rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-(--danger)/10 flex items-center justify-center text-(--danger) mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2 tracking-tight">{t('delete_bot')}</h3>
              <p className="text-[14px] text-(--text-muted) leading-relaxed">
                {t('delete_bot_desc').replace('{botName}', botToDelete.name)}
              </p>
            </div>
            <div className="p-4 bg-(--bg-secondary) border-t border-(--border) flex gap-3 justify-end">
              <button
                onClick={() => setBotToDelete(null)}
                disabled={deletingBotId !== null}
                className="px-4 py-2 rounded-xl text-[14px] font-medium text-(--text-normal) hover:bg-(--bg-modifier-hover) transition-colors disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={confirmDeleteBot}
                disabled={deletingBotId !== null}
                className="px-5 py-2 rounded-xl text-[14px] font-medium bg-(--danger) text-white hover:bg-(--danger)/90 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {deletingBotId !== null && <Loader2 size={16} className="animate-spin" />}
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
