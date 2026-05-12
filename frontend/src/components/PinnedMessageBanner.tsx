import { useEffect, useState, useCallback } from 'react';
import { Pin, X } from 'lucide-react';
import { supabase } from '../supabase';

interface PinnedEntry {
  id: string;
  message_id: string;
  body_preview: string;
  pinned_by: string;
  pinned_at: string;
}

interface PinnedMessageBannerProps {
  conversationKey: string;
  messageType: 'dm' | 'room';
  currentUserId: string;
  onJumpToMessage?: (messageId: string) => void;
}

const TABLE = {
  dm: 'pinned_dm_messages',
  room: 'pinned_room_messages',
} as const;

const KEY_COLUMN = {
  dm: 'conversation_key',
  room: 'room_name',
} as const;

export default function PinnedMessageBanner({
  conversationKey,
  messageType,
  currentUserId,
  onJumpToMessage,
}: PinnedMessageBannerProps) {
  const [pinned, setPinned] = useState<PinnedEntry | null>(null);
  const table = TABLE[messageType];
  const keyCol = KEY_COLUMN[messageType];

  const fetchPinned = useCallback(async () => {
    const { data } = await supabase
      .from(table)
      .select('id, message_id, body_preview, pinned_by, pinned_at')
      .eq(keyCol, conversationKey)
      .order('pinned_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setPinned(data ?? null);
  }, [table, keyCol, conversationKey]);

  useEffect(() => {
    fetchPinned();

    const channel = supabase
      .channel(`pinned-${table}-${conversationKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => fetchPinned())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [table, conversationKey, fetchPinned]);

  const handleUnpin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pinned) return;
    await supabase.from(table).delete().eq('id', pinned.id);
  };

  if (!pinned) return null;

  const preview =
    pinned.body_preview.length > 80
      ? pinned.body_preview.slice(0, 80) + '…'
      : pinned.body_preview;

  return (
    <div
      onClick={() => onJumpToMessage?.(pinned.message_id)}
      className="flex items-center gap-3 px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)] cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors group"
    >
      <Pin size={14} className="text-[var(--brand)] shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-[12px] font-semibold text-[var(--brand)] mr-2">Pinned Message</span>
        <span className="text-[13px] text-[var(--text-muted)] truncate">{preview}</span>
      </div>
      {currentUserId === pinned.pinned_by && (
        <button
          onClick={handleUnpin}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-[var(--danger)] p-1 rounded"
          title="Unpin message"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
