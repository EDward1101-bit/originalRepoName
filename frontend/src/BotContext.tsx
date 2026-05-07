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
import { ALL_BOTS, getBotById, type BotDefinition } from './bots/botRegistry';

// roomName -> botId[]
type RoomBotsMap = Record<string, string[]>;

interface RoomBotRow {
  id: string;
  room_id: string;
  bot_id: string;
  invited_by: string;
  rooms: { name: string } | null;
}

interface BotContextType {
  roomBots: RoomBotsMap;
  allBots: BotDefinition[];
  getBotsForRoom: (roomName: string) => BotDefinition[];
  isBotInRoom: (roomName: string, botId: string) => boolean;
  inviteBot: (roomId: string, roomName: string, botId: string) => Promise<void>;
  removeBot: (roomId: string, roomName: string, botId: string) => Promise<void>;
  applyFilters: (roomName: string, body: string) => string;
}

const BotContext = createContext<BotContextType | undefined>(undefined);

export function BotProvider({ children }: { children: ReactNode }) {
  const { myUsername } = useChatContext();
  const [roomBots, setRoomBots] = useState<RoomBotsMap>({});

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
      if (!map[roomName].includes(row.bot_id)) {
        map[roomName].push(row.bot_id);
      }
    }
    setRoomBots(map);
  }, []);

  useEffect(() => {
    if (!myUsername) return;
    fetchRoomBots();
  }, [myUsername, fetchRoomBots]);

  // Subscribe to realtime changes on room_bots
  useEffect(() => {
    if (!myUsername) return;
    const channel = supabase
      .channel('room_bots_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_bots' }, () => {
        fetchRoomBots();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myUsername, fetchRoomBots]);

  const getBotsForRoom = useCallback(
    (roomName: string): BotDefinition[] => {
      const botIds = roomBots[roomName] || [];
      return botIds.map((id) => getBotById(id)).filter(Boolean) as BotDefinition[];
    },
    [roomBots]
  );

  const isBotInRoom = useCallback(
    (roomName: string, botId: string): boolean => {
      return (roomBots[roomName] || []).includes(botId);
    },
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
      if (error) {
        console.error('[BotContext] Failed to invite bot:', error);
        throw error;
      }
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
      if (error) {
        console.error('[BotContext] Failed to remove bot:', error);
        throw error;
      }
      setRoomBots((prev) => ({
        ...prev,
        [roomName]: (prev[roomName] || []).filter((id) => id !== botId),
      }));
    },
    []
  );

  const applyFilters = useCallback(
    (roomName: string, body: string): string => {
      const bots = getBotsForRoom(roomName);
      return bots.reduce((text, bot) => {
        if (bot.filter) return bot.filter(text);
        return text;
      }, body);
    },
    [getBotsForRoom]
  );

  return (
    <BotContext.Provider
      value={{ roomBots, allBots: ALL_BOTS, getBotsForRoom, isBotInRoom, inviteBot, removeBot, applyFilters }}
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
