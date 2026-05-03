const TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatCalendarDate(date: Date): string {
  const includeYear = date.getFullYear() !== new Date().getFullYear();

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  }).format(date);
}

export function formatMessageTimestamp(value: Date | string | number, now = new Date()): string {
  const date = toDate(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const time = TIME_FORMAT.format(date);

  if (isSameLocalDay(date, now)) {
    return time;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameLocalDay(date, yesterday)) {
    return `Yesterday • ${time}`;
  }

  return `${formatCalendarDate(date)} • ${time}`;
}
