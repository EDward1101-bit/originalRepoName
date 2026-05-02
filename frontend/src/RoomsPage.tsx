import React, { useState } from 'react';
import { useMucContext } from './MucContext';
import { useNavigate } from 'react-router-dom';

export default function RoomsPage() {
  const { availableRooms, createRoom } = useMucContext();
  const navigate = useNavigate();

  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
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

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="flex-none p-6 border-b border-surface-variant bg-surface-container-lowest">
        <h1 className="text-2xl font-bold text-on-surface">Chat Rooms (Servers)</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Join a room to chat with multiple people simultaneously.
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Room List */}
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-lg font-semibold text-on-surface mb-4">Available Rooms</h2>
          {availableRooms.length === 0 ? (
            <p className="text-on-surface-variant text-sm italic">
              No rooms available. Create one to get started!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableRooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-surface-container p-5 rounded-2xl border border-surface-variant hover:border-primary transition-colors cursor-pointer group flex flex-col"
                  onClick={() => navigate(`/rooms/${room.name}`)}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      #
                    </div>
                    <div>
                      <h3 className="font-bold text-on-surface group-hover:text-primary transition-colors">
                        {room.name}
                      </h3>
                      <p className="text-xs text-on-surface-variant">
                        Created by {room.created_by}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-on-surface-variant flex-1 mb-4 mt-2">
                    {room.description || 'No description provided.'}
                  </p>
                  <button className="w-full py-2 rounded-xl bg-surface-variant text-on-surface font-medium group-hover:bg-primary group-hover:text-on-primary transition-colors">
                    Join Room
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Room Sidebar */}
        <div className="w-[320px] bg-surface-container-low border-l border-surface-variant flex flex-col p-6 overflow-y-auto">
          <h2 className="text-lg font-semibold text-on-surface mb-4">Create a Room</h2>
          <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Room Name</label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="e.g. general"
                className="w-full bg-surface border border-outline rounded-xl px-4 py-2 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                required
                pattern="^[a-zA-Z0-9_]+$"
                title="Only letters, numbers, and underscores are allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">
                Description <span className="text-on-surface-variant text-xs">(optional)</span>
              </label>
              <textarea
                value={newRoomDesc}
                onChange={(e) => setNewRoomDesc(e.target.value)}
                placeholder="What is this room about?"
                className="w-full bg-surface border border-outline rounded-xl px-4 py-2 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none h-24"
              />
            </div>

            {error && (
              <div className="p-3 bg-error/10 text-error rounded-xl text-sm border border-error/20">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isCreating || !newRoomName.trim()}
              className="mt-2 w-full bg-primary text-on-primary py-3 rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isCreating ? 'Creating...' : 'Create Room'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
