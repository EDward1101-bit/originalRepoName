import React, { useState } from 'react';
import { useMucContext } from './MucContext';
import { useChatContext } from './ChatContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from './LanguageContext';
import { Loader2, Trash2 } from 'lucide-react';

export default function RoomsPage() {
  const { availableRooms, joinedRooms, createRoom, deleteRoom } = useMucContext();
  const { myUsername, getUserProfile } = useChatContext();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    setIsCreating(true);
    setError(null);
    try {
      await createRoom(newRoomName, newRoomDesc);
      setNewRoomName('');
      setNewRoomDesc('');
    } catch (err: any) {
      setError(err.message || t('failed_to_create_room'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRoom = async (e: React.MouseEvent, roomId: string, roomName: string) => {
    e.stopPropagation(); // don't navigate into the room
    if (!confirm(`Delete room "#${roomName}"? This cannot be undone.`)) return;

    setDeletingId(roomId);
    setError(null);
    try {
      await deleteRoom(roomId, roomName);
    } catch (err: any) {
      setError(err.message || t('failed_to_delete_room'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-(--bg-primary) text-(--text-normal)">
      {/* Header */}
      <div className="flex-none p-8 bg-(--bg-secondary) border-b border-(--border) relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-(--brand)/10 via-transparent to-(--accent)/10 pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <h1 className="text-3xl font-black tracking-tight text-(--text-normal)">
            {t('find_your_community')}
          </h1>
          <p className="text-[15px] text-(--text-muted) mt-2 max-w-lg">
            {t('discover_new_spaces')}
          </p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Room List */}
        <div className="flex-1 overflow-y-auto p-8">
          <h2 className="text-[20px] font-bold text-(--text-normal) mb-6">
            {t('featured_communities')}
          </h2>
          {error && (
            <div className="mb-4 p-3 bg-(--danger) text-white rounded-md text-sm">
              {error}
            </div>
          )}
          {availableRooms.length === 0 ? (
            <p className="text-(--text-muted) text-sm">
              {t('no_servers')}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {availableRooms.map((room) => {
                const creatorProfile = getUserProfile(room.created_by);
                const creatorName = creatorProfile?.username || room.created_by;
                return (
                  <div
                    key={room.id}
                    className="bg-(--bg-secondary) rounded-md overflow-hidden border border-(--border) hover:border-(--brand)/50 hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col h-[200px]"
                    onClick={() => navigate(`/rooms/${room.name}`)}
                    data-testid="room-card"
                  >
                  <div className="h-16 bg-gradient-to-r from-(--bg-tertiary) to-(--bg-modifier-hover) relative shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-(--brand)/10 to-transparent" />
                    <div className="absolute -bottom-5 left-4 w-10 h-10 rounded-md bg-(--bg-primary) p-0.5 shadow-lg group-hover:scale-110 transition-transform">
                      <div className="w-full h-full rounded-[9px] bg-(--brand) flex items-center justify-center text-white font-bold text-base">
                        #
                      </div>
                    </div>
                  </div>
                  <div className="p-4 pt-6 flex-1 flex flex-col min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <h3
                          className="font-bold text-[15px] text-(--text-normal) truncate group-hover:text-(--brand) transition-colors inline-block px-2 py-0.5 rounded-md bg-(--bg-primary)/40 border border-(--border)/30"
                          data-testid="room-name"
                        >
                          {room.name}
                        </h3>
                        <p className="text-[10px] text-(--text-muted) font-medium mt-1">
                          by {creatorName}
                        </p>
                      </div>

                      {room.created_by === myUsername && (
                        <button
                          onClick={(e) => handleDeleteRoom(e, room.id, room.name)}
                          disabled={deletingId === room.id}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-(--text-muted) hover:bg-(--danger) hover:text-white transition-all shrink-0 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        >
                          {deletingId === room.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      )}
                    </div>

                    <p className="text-[13px] text-(--text-muted) flex-1 line-clamp-2 leading-relaxed">
                      {room.description || t('welcome_to_our_server')}
                    </p>

                    {joinedRooms.includes(room.name) && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-(--status-online)" />
                        <span className="text-[10px] font-bold text-(--status-online) uppercase tracking-wider">{t('joined')}</span>
                      </div>
                    )}
                  </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Room Sidebar */}
        <div className="w-[340px] bg-(--bg-secondary) border-l border-(--border) flex flex-col p-8 overflow-y-auto hidden lg:flex shadow-[-4px_0_20px_rgba(0,0,0,0.05)]">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-(--text-normal) tracking-tight">
              {t('build_a_space')}
            </h2>
            <p className="text-[13px] text-(--text-muted) mt-1">
              {t('give_your_community_a_name')}
            </p>
          </div>
          <form onSubmit={handleCreateRoom} className="flex flex-col gap-6">
            <div className="space-y-2">
              <label className="block text-[11px] font-black text-(--text-muted) uppercase tracking-widest ml-1">
                {t('server_name')}
              </label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder={t('gamers_haven_placeholder')}
                className="w-full bg-(--bg-primary) border border-(--border) rounded-md px-4 py-3 text-(--text-normal) text-[15px] focus:outline-none focus:ring-2 focus:ring-(--brand)/50 transition-all shadow-sm"
                required
                pattern="^[a-zA-Z0-9_]+$"
                title={t('only_letters_numbers')}
                data-testid="create-room-name"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-black text-(--text-muted) uppercase tracking-widest ml-1">
                {t('description')}
              </label>
              <textarea
                value={newRoomDesc}
                onChange={(e) => setNewRoomDesc(e.target.value)}
                placeholder={t('server_about_placeholder')}
                className="w-full bg-(--bg-primary) border border-(--border) rounded-md px-4 py-3 text-(--text-normal) text-[15px] focus:outline-none focus:ring-2 focus:ring-(--brand)/50 transition-all resize-none h-32 shadow-sm"
                data-testid="create-room-description"
              />
            </div>

            <button
              type="submit"
              disabled={isCreating || !newRoomName.trim()}
              className="mt-4 w-full bg-(--brand) text-white py-3.5 rounded-md font-bold text-[15px] hover:bg-(--brand-hover) hover:shadow-lg hover:shadow-(--brand)/20 active:scale-95 disabled:opacity-50 transition-all"
              data-testid="create-room-submit"
            >
              {isCreating ? <Loader2 className="animate-spin mx-auto" size={20} /> : t('create')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
