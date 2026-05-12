import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../supabase';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '💯', '🎉'];

interface Reaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface ReactionBarProps {
  messageId: string;
  messageType: 'dm' | 'room';
  currentUserId: string;
}

const TABLE = {
  dm: 'message_reactions',
  room: 'room_message_reactions',
} as const;

export default function ReactionBar({ messageId, messageType, currentUserId }: ReactionBarProps) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const table = TABLE[messageType];

  const buildReactions = useCallback(
    (rows: { emoji: string; user_id: string }[]): Reaction[] => {
      const map = new Map<string, { count: number; hasReacted: boolean }>();
      for (const row of rows) {
        const entry = map.get(row.emoji) ?? { count: 0, hasReacted: false };
        entry.count += 1;
        if (row.user_id === currentUserId) entry.hasReacted = true;
        map.set(row.emoji, entry);
      }
      return Array.from(map.entries()).map(([emoji, { count, hasReacted }]) => ({
        emoji,
        count,
        hasReacted,
      }));
    },
    [currentUserId]
  );

  const fetchReactions = useCallback(async () => {
    const { data } = await supabase
      .from(table)
      .select('emoji, user_id')
      .eq('message_id', messageId);
    if (data) setReactions(buildReactions(data));
  }, [messageId, table, buildReactions]);

  useEffect(() => {
    fetchReactions();

    const channel = supabase
      .channel(`reactions-${table}-${messageId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `message_id=eq.${messageId}` },
        () => fetchReactions()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [messageId, table, fetchReactions]);

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handle = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showPicker]);

  const toggleReaction = async (emoji: string) => {
    const existing = reactions.find((r) => r.emoji === emoji);
    if (existing?.hasReacted) {
      await supabase
        .from(table)
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', currentUserId)
        .eq('emoji', emoji);
    } else {
      await supabase
        .from(table)
        .insert({ message_id: messageId, user_id: currentUserId, emoji });
    }
    // fetchReactions will be triggered by the realtime subscription
  };

  if (reactions.length === 0 && !showPicker) {
    return (
      <div className="flex items-center mt-1">
        <AddReactionButton onClick={() => setShowPicker(true)} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => toggleReaction(r.emoji)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[13px] border transition-colors ${
            r.hasReacted
              ? 'bg-[var(--brand)]/15 border-[var(--brand)]/40 text-[var(--brand)]'
              : 'bg-[var(--bg-tertiary)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--brand)]/40 hover:text-[var(--text-normal)]'
          }`}
        >
          <span>{r.emoji}</span>
          <span className="font-semibold">{r.count}</span>
        </button>
      ))}

      <div className="relative" ref={pickerRef}>
        <AddReactionButton onClick={() => setShowPicker((v) => !v)} />
        {showPicker && (
          <div className="absolute bottom-8 left-0 z-50 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl shadow-2xl p-2 flex gap-1 flex-wrap w-[200px]">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  toggleReaction(emoji);
                  setShowPicker(false);
                }}
                className="w-9 h-9 flex items-center justify-center text-[20px] rounded-xl hover:bg-[var(--bg-modifier-hover)] transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AddReactionButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[13px] border border-transparent text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border)] hover:text-[var(--text-normal)] transition-colors opacity-0 group-hover:opacity-100"
    >
      <span className="text-[16px]">😄</span>
      <span>+</span>
    </button>
  );
}
