import { formatDistanceToNowStrict, format, isToday, isYesterday } from 'date-fns';

export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function shortTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, h:mm a');
}

export function listTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}
