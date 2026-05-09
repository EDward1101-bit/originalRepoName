import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMucContext } from './MucContext';

/**
 * When the user navigates to /rooms, redirect them to:
 *  1. The first room they're in (joinedRooms[0]), or
 *  2. /rooms/explore if they haven't joined any rooms yet.
 */
export default function RoomsRedirect() {
  const { joinedRooms } = useMucContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (joinedRooms.length > 0) {
      navigate(`/rooms/${joinedRooms[0]}`, { replace: true });
    } else {
      navigate('/rooms/explore', { replace: true });
    }
  }, [joinedRooms, navigate]);

  return null;
}
