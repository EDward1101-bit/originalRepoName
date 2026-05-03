function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Returns a smart relative timestamp like WhatsApp:
 * - "Just now" (< 1 min)
 * - "5 min ago"
 * - "2 hours ago"
 * - "Yesterday at 14:30"
 * - "3 days ago"
 * - "Mar 15 at 14:30"
 * - "Mar 15, 2024 at 14:30"
 */
export function formatMessageTimestamp(value: Date | string | number, now = new Date()): string {
  const date = toDate(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const timeStr = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Less than 1 minute
  if (diffSec < 60) {
    return 'Just now';
  }

  // Less than 1 hour
  if (diffMin < 60) {
    return `${diffMin} min ago`;
  }

  // Less than 24 hours
  if (diffHour < 24) {
    return `${diffHour}h ago`;
  }

  // Yesterday
  if (diffDay === 1) {
    return `Yesterday at ${timeStr}`;
  }

  // Less than 7 days
  if (diffDay < 7) {
    return `${diffDay} days ago`;
  }

  // Same year
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${timeStr}`;
  }

  // Different year
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at ${timeStr}`;
}
