import { describe, it, expect } from 'vitest';
import { formatMessageTimestamp } from './time';

describe('time utils', () => {
  it('formats less than a minute ago correctly', () => {
    const now = new Date('2024-03-15T14:30:00Z');
    const past = new Date('2024-03-15T14:29:30Z');
    expect(formatMessageTimestamp(past, now)).toBe('Just now');
  });

  it('formats minutes ago correctly', () => {
    const now = new Date('2024-03-15T14:30:00Z');
    const past = new Date('2024-03-15T14:25:00Z');
    expect(formatMessageTimestamp(past, now)).toBe('5 min ago');
  });

  it('formats hours ago correctly', () => {
    const now = new Date('2024-03-15T14:30:00Z');
    const past = new Date('2024-03-15T12:30:00Z');
    expect(formatMessageTimestamp(past, now)).toBe('2h ago');
  });
});
