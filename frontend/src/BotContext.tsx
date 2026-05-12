import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from './supabase';
import { useChatContext } from './ChatContext';
import { API_URL } from './config';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BotDefinition {
  id: string;
  name: string;
  description: string;
  emoji: string;
  tags?: string[];
  isBuiltin: boolean;
  isOnline: boolean;
  webhookUrl?: string | null;
  ownerUsername?: string | null;
}

// roomName -> botId[]
type RoomBotsMap = Record<string, string[]>;

interface RoomBotRow {
  id: string;
  room_id: string;
  bot_id: string;
  invited_by: string;
  rooms: { name: string } | null;
}

export interface RegisteredBot {
  bot_id: string;
  webhook_secret: string;
}

interface BotContextType {
  allBots: BotDefinition[];
  roomBots: RoomBotsMap;
  getBotsForRoom: (roomName: string) => BotDefinition[];
  isBotInRoom: (roomName: string, botId: string) => boolean;
  inviteBot: (roomId: string, roomName: string, botId: string) => Promise<void>;
  removeBot: (roomId: string, roomName: string, botId: string) => Promise<void>;
  triggerDispatch: (messageId: string, roomName: string, body: string) => void;
  registerBot: (params: {
    name: string;
    description: string;
    emoji: string;
    webhookUrl: string;
  }) => Promise<RegisteredBot>;
  deleteBot: (botId: string) => Promise<void>;
  refreshBots: () => Promise<void>;
}

const BotContext = createContext<BotContextType | undefined>(undefined);

// ── Provider ─────────────────────────────────────────────────────────────────
export function BotProvider({ children }: { children: ReactNode }) {
  const { myUsername } = useChatContext();
  const [allBots, setAllBots] = useState<BotDefinition[]>([]);
  const [roomBots, setRoomBots] = useState<RoomBotsMap>({});

  // Fetch the bots catalogue from the backend (which reads the bots table)
  const fetchAllBots = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/bots`);
      if (!res.ok) return;
      const data: any[] = await res.json();
      setAllBots(
        data.map((b) => ({
          id: b.id,
          name: b.name,
          description: b.description,
          emoji: b.emoji,
          isBuiltin: b.is_builtin,
          isOnline: b.is_online ?? false,
          webhookUrl: b.webhook_url,
          ownerUsername: b.owner_username,
        }))
      );
    } catch {
      // Backend unreachable — silently ignore, bots page will show empty
    }
  }, []);

  // Fetch which bots are in which rooms (from room_bots table)
  const fetchRoomBots = useCallback(async () => {
    const { data, error } = await supabase
      .from('room_bots')
      .select('id, room_id, bot_id, invited_by, rooms(name)');

    if (error) {
      console.error('[BotContext] Failed to fetch room_bots:', error);
      return;
    }

    const rows = (data as unknown) as RoomBotRow[];
    const map: RoomBotsMap = {};
    for (const row of rows) {
      const roomName = row.rooms?.name;
      if (!roomName) continue;
      if (!map[roomName]) map[roomName] = [];
      if (!map[roomName].includes(row.bot_id)) map[roomName].push(row.bot_id);
    }
    setRoomBots(map);
  }, []);

  // Fetch bot catalogue on mount and poll every 15s for live online status
  useEffect(() => {
    fetchAllBots();
    const interval = setInterval(fetchAllBots, 15_000);
    return () => clearInterval(interval);
  }, [fetchAllBots]);

  // Fetch room<->bot associations — needs the user to be identified
  useEffect(() => {
    if (!myUsername) return;
    fetchRoomBots();
  }, [myUsername, fetchRoomBots]);

  // Realtime subscription on room_bots
  useEffect(() => {
    if (!myUsername) return;
    const channel = supabase
      .channel('room_bots_realtime_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_bots' }, () => {
        fetchRoomBots();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myUsername, fetchRoomBots]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getBotsForRoom = useCallback(
    (roomName: string): BotDefinition[] => {
      const botIds = roomBots[roomName] || [];
      return botIds
        .map((id) => allBots.find((b) => b.id === id))
        .filter(Boolean) as BotDefinition[];
    },
    [roomBots, allBots]
  );

  const isBotInRoom = useCallback(
    (roomName: string, botId: string): boolean =>
      (roomBots[roomName] || []).includes(botId),
    [roomBots]
  );

  const inviteBot = useCallback(
    async (roomId: string, roomName: string, botId: string) => {
      if (!myUsername) return;
      const { error } = await supabase.from('room_bots').insert({
        room_id: roomId,
        bot_id: botId,
        invited_by: myUsername,
      });
      if (error) throw error;
      setRoomBots((prev) => {
        const existing = prev[roomName] || [];
        if (existing.includes(botId)) return prev;
        return { ...prev, [roomName]: [...existing, botId] };
      });
    },
    [myUsername]
  );

  const removeBot = useCallback(
    async (roomId: string, roomName: string, botId: string) => {
      const { error } = await supabase
        .from('room_bots')
        .delete()
        .eq('room_id', roomId)
        .eq('bot_id', botId);
      if (error) throw error;
      setRoomBots((prev) => ({
        ...prev,
        [roomName]: (prev[roomName] || []).filter((id) => id !== botId),
      }));
    },
    []
  );

  // ── Core: async dispatch ─────────────────────────────────────────────────
  const triggerDispatch = useCallback(
    (messageId: string, roomName: string, body: string) => {
      const activeBots = getBotsForRoom(roomName);
      if (activeBots.length === 0) return;

      fetch(`${API_URL}/api/bots/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, room_name: roomName, body, sender: myUsername }),
      }).catch(() => {
        // Silently ignore if backend is down, message was already sent
      });
    },
    [getBotsForRoom, myUsername]
  );

  // ── Bot registration / deletion ───────────────────────────────────────────
  const registerBot = useCallback(
    async (params: {
      name: string;
      description: string;
      emoji: string;
      webhookUrl: string;
    }): Promise<RegisteredBot> => {
      const res = await fetch(`${API_URL}/api/bots/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: params.name,
          description: params.description,
          emoji: params.emoji,
          webhook_url: params.webhookUrl,
          owner_username: myUsername,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to register bot');
      }
      const data = await res.json();
      await fetchAllBots();
      return { bot_id: data.bot_id, webhook_secret: data.webhook_secret };
    },
    [myUsername, fetchAllBots]
  );

  const deleteBot = useCallback(
    async (botId: string) => {
      const res = await fetch(
        `${API_URL}/api/bots/${botId}?owner_username=${encodeURIComponent(myUsername || '')}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to delete bot');
      }
      await fetchAllBots();
    },
    [myUsername, fetchAllBots]
  );

  return (
    <BotContext.Provider
      value={{
        allBots,
        roomBots,
        getBotsForRoom,
        isBotInRoom,
        inviteBot,
        removeBot,
        triggerDispatch,
        registerBot,
        deleteBot,
        refreshBots: fetchAllBots,
      }}
    >
      {children}
    </BotContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBotContext() {
  const ctx = useContext(BotContext);
  if (!ctx) throw new Error('useBotContext must be used within a BotProvider');
  return ctx;
}
