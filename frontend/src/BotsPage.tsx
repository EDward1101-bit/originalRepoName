import { useState } from 'react';
import { useBotContext } from './BotContext';
import { useMucContext } from './MucContext';
import { useChatContext } from './ChatContext';
import type { BotDefinition } from './bots/botRegistry';
import { CheckCircle2, XCircle, Bot, Shield, Tag, ChevronRight } from 'lucide-react';

export default function BotsPage() {
  const { allBots, isBotInRoom, inviteBot, removeBot } = useBotContext();
  const { availableRooms } = useMucContext();
  const { myUsername } = useChatContext();

  const [selectedBot, setSelectedBot] = useState<BotDefinition | null>(allBots[0] ?? null);
  const [loadingRoomId, setLoadingRoomId] = useState<string | null>(null);

  const myRooms = availableRooms.filter((r) => r.created_by === myUsername);

  const handleToggle = async (roomId: string, roomName: string, botId: string) => {
    setLoadingRoomId(roomId);
    try {
      if (isBotInRoom(roomName, botId)) {
        await removeBot(roomId, roomName, botId);
      } else {
        await inviteBot(roomId, roomName, botId);
      }
    } catch (err) {
      console.error('Failed to toggle bot:', err);
    } finally {
      setLoadingRoomId(null);
    }
  };

  const tagColors: Record<string, string> = {
    moderation: 'bg-[#ef4444]/10 text-[#ef4444]',
    filter: 'bg-[var(--brand)]/10 text-[var(--brand)]',
    utility: 'bg-[#10b981]/10 text-[#10b981]',
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-normal)]">
      {/* Header */}
      <div className="flex-none p-6 bg-[var(--bg-secondary)] border-b border-[var(--border)] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--brand)] to-[#8b5cf6] opacity-20 pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/20 flex items-center justify-center">
            <Bot size={22} className="text-[var(--brand)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Bot Directory</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Invite bots to your rooms to add new capabilities.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Bot List */}
        <div className="flex-1 overflow-y-auto p-8">
          <h2 className="text-[13px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4">
            Available Bots — {allBots.length}
          </h2>

          <div className="flex flex-col gap-3">
            {allBots.map((bot) => {
              const isSelected = selectedBot?.id === bot.id;
              return (
                <button
                  key={bot.id}
                  onClick={() => setSelectedBot(bot)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all duration-200 flex items-start gap-4 group ${
                    isSelected
                      ? 'bg-[var(--brand)]/10 border-[var(--brand)]/40 shadow-md'
                      : 'bg-[var(--bg-secondary)] border-[var(--border)] hover:border-[var(--brand)]/30 hover:bg-[var(--bg-secondary)] hover:-translate-y-0.5 hover:shadow-lg'
                  }`}
                >
                  {/* Emoji Avatar */}
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 shadow-inner transition-all ${
                      isSelected
                        ? 'bg-[var(--brand)]/20'
                        : 'bg-[var(--bg-tertiary)] group-hover:bg-[var(--brand)]/10'
                    }`}
                  >
                    {bot.emoji}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-[16px] text-[var(--text-normal)]">
                        {bot.name}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand)]/15 text-[var(--brand)] uppercase tracking-wide">
                        BOT
                      </span>
                    </div>
                    <p className="text-[13px] text-[var(--text-muted)] leading-relaxed mb-3">
                      {bot.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {bot.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                            tagColors[tag] ?? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                          }`}
                        >
                          <Tag size={10} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <ChevronRight
                    size={18}
                    className={`flex-shrink-0 mt-1 transition-all ${
                      isSelected
                        ? 'text-[var(--brand)] rotate-90'
                        : 'text-[var(--text-muted)] group-hover:text-[var(--text-normal)]'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Management Panel */}
        <div className="w-[360px] bg-[var(--bg-secondary)] border-l border-[var(--border)] flex flex-col overflow-hidden hidden lg:flex">
          {selectedBot ? (
            <>
              {/* Bot Detail Header */}
              <div className="p-6 border-b border-[var(--border)]">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--brand)]/15 flex items-center justify-center text-4xl shadow-inner">
                    {selectedBot.emoji}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[18px] text-[var(--text-normal)]">
                        {selectedBot.name}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand)]/15 text-[var(--brand)] uppercase tracking-wide">
                        BOT
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                      Hardcoded · Always available
                    </p>
                  </div>
                </div>
                <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
                  {selectedBot.description}
                </p>
              </div>

              {/* Room Management */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Shield size={14} className="text-[var(--text-muted)]" />
                  <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Your Rooms
                  </p>
                </div>

                {myRooms.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">
                      🏠
                    </div>
                    <p className="text-[13px] text-[var(--text-muted)] italic">
                      You haven't created any rooms yet.
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] opacity-60 mt-1">
                      Create a room to invite bots.
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
                              ? 'bg-[var(--brand)]/8 border-[var(--brand)]/30'
                              : 'bg-[var(--bg-primary)] border-[var(--border)] hover:border-[var(--border)]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                                active
                                  ? 'bg-[var(--brand)] text-white'
                                  : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                              }`}
                            >
                              #
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-[var(--text-normal)] truncate">
                                {room.name}
                              </p>
                              {active && (
                                <p className="text-[11px] text-[var(--brand)] font-medium">
                                  Active
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => handleToggle(room.id, room.name, selectedBot.id)}
                            disabled={isLoading}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all flex-shrink-0 disabled:opacity-50 ${
                              active
                                ? 'bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20'
                                : 'bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] shadow-sm'
                            }`}
                          >
                            {isLoading ? (
                              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : active ? (
                              <>
                                <XCircle size={13} />
                                Remove
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={13} />
                                Invite
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center mb-4 text-3xl">
                🤖
              </div>
              <p className="text-[14px] text-[var(--text-muted)] italic">
                Select a bot to manage its rooms.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
