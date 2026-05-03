import React, { useState } from 'react';
import { useMucContext } from './MucContext';
import { useChatContext } from './ChatContext';
import { useNavigate } from 'react-router-dom';

export default function RoomsPage() {
  const { availableRooms, createRoom, deleteRoom } = useMucContext();
  const { myUsername } = useChatContext();
  const navigate = useNavigate();

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
      setError(err.message || 'Failed to create room.');
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
      setError(err.message || 'Failed to delete room.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-normal)]">
      {/* Header */}
      <div className="flex-none p-6 bg-[var(--bg-secondary)] border-b border-[var(--border)] text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--brand)] to-[#8A2BE2] opacity-20 pointer-events-none" />
        <h1 className="text-2xl font-bold relative z-10">Discover Servers</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1 relative z-10">
          Find a community to chat, play, and hang out with.
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Room List */}
        <div className="flex-1 overflow-y-auto p-8">
          <h2 className="text-[20px] font-bold text-[var(--text-normal)] mb-6">Featured Communities</h2>
          {error && (
            <div className="mb-4 p-3 bg-[var(--color-status-dnd)] text-white rounded-md text-sm">
              {error}
            </div>
          )}
          {availableRooms.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">
              No servers available. Create one to get started!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {availableRooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-[var(--bg-secondary)] rounded-lg overflow-hidden border border-[var(--border)] hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group flex flex-col"
                  onClick={() => navigate(`/rooms/${room.name}`)}
                >
                  <div className="h-24 bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-modifier-hover)] relative">
                     <div className="absolute -bottom-6 left-4 w-12 h-12 rounded-xl bg-[var(--bg-primary)] p-1">
                        <div className="w-full h-full rounded-lg bg-[var(--brand)] flex items-center justify-center text-white font-bold text-lg">
                           #
                        </div>
                     </div>
                  </div>
                  <div className="p-4 pt-8 flex-1 flex flex-col">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-[16px] text-[var(--text-normal)]">
                          {room.name}
                        </h3>
                        <p className="text-xs text-[var(--text-muted)]">
                          Created by {room.created_by}
                        </p>
                      </div>

                      {/* Delete button — only visible to the creator */}
                      {room.created_by === myUsername && (
                        <button
                          onClick={(e) => handleDeleteRoom(e, room.id, room.name)}
                          disabled={deletingId === room.id}
                          title="Delete server"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--color-status-dnd)] hover:text-white transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        >
                          {deletingId === room.id ? (
                            <span className="material-symbols-outlined text-[18px] animate-spin">
                              progress_activity
                            </span>
                          ) : (
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          )}
                        </button>
                      )}
                    </div>

                    <p className="text-[14px] text-[var(--text-muted)] flex-1 mt-2 line-clamp-3">
                      {room.description || 'Welcome to our server! Hang out and chat with us.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Room Sidebar */}
        <div className="w-[340px] bg-[var(--bg-secondary)] border-l border-[var(--border)] flex flex-col p-6 overflow-y-auto hidden lg:flex">
          <h2 className="text-[20px] font-bold text-[var(--text-normal)] mb-6">Create a Server</h2>
          <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Server Name</label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="e.g. general"
                className="w-full bg-[var(--input-bg)] border-none rounded-[3px] px-3 py-2.5 text-[var(--text-normal)] text-[15px] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-all"
                required
                pattern="^[a-zA-Z0-9_]+$"
                title="Only letters, numbers, and underscores are allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">
                Description <span className="lowercase text-[10px]">(optional)</span>
              </label>
              <textarea
                value={newRoomDesc}
                onChange={(e) => setNewRoomDesc(e.target.value)}
                placeholder="What is this server about?"
                className="w-full bg-[var(--input-bg)] border-none rounded-[3px] px-3 py-2.5 text-[var(--text-normal)] text-[15px] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-all resize-none h-24"
              />
            </div>

            <button
              type="submit"
              disabled={isCreating || !newRoomName.trim()}
              className="mt-2 w-full bg-[var(--brand)] text-white py-2.5 rounded-[3px] font-medium hover:bg-[var(--brand-hover)] disabled:opacity-50 transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
