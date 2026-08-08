/**
 * Free slots computed from the workspace business hours, for offering times
 * over text without leaving the thread.
 *
 * Comms doesn't sync an external calendar, so "free" means "inside the hours
 * this workspace answers messages" — which is the honest version of the
 * feature: the slots you offer a customer are the slots someone will actually
 * be at the keyboard. The picker inserts them as plain text, because the
 * other side of an iMessage thread has no booking widget.
 */

/** Mirrors the worker's business-hours shape stored in app_settings. */
export interface BusinessHours {
  /** 0 = Sunday … 6 = Saturday. */
  days: number[];
  /** Minutes from midnight, workspace-local. */
  startMinutes: number;
  endMinutes: number;
  timezone?: string;
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  days: [1, 2, 3, 4, 5],
  startMinutes: 9 * 60,
  endMinutes: 17 * 60,
};

export interface AvailabilitySlot {
  start: Date;
  end: Date;
}

/**
 * Upcoming slots inside business hours.
 *
 * Slots start on the hour or half-hour, never in the past, and skip the
 * remainder of today once it's within `leadMinutes` — offering a time fifteen
 * minutes from now reads as desperate, not accommodating.
 */
export function computeSlots(
  hours: BusinessHours,
  opts: {
    durationMinutes: number;
    /** How many calendar days ahead to look (default 5 offered days). */
    daysAhead?: number;
    /** Max slots per day, spread across the window rather than clustered. */
    perDay?: number;
    now?: Date;
    leadMinutes?: number;
  },
): AvailabilitySlot[] {
  const now = opts.now ?? new Date();
  const daysAhead = opts.daysAhead ?? 7;
  const perDay = opts.perDay ?? 3;
  const lead = (opts.leadMinutes ?? 60) * 60_000;
  const duration = opts.durationMinutes * 60_000;

  const slots: AvailabilitySlot[] = [];

  for (let offset = 0; offset <= daysAhead; offset += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    if (!hours.days.includes(day.getDay())) continue;

    const dayStart = new Date(day);
    dayStart.setHours(0, hours.startMinutes, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(0, hours.endMinutes, 0, 0);

    // Candidate starts every 30 minutes; pick evenly to reach `perDay`.
    const candidates: Date[] = [];
    for (let t = dayStart.getTime(); t + duration <= dayEnd.getTime(); t += 30 * 60_000) {
      if (t < now.getTime() + lead) continue;
      candidates.push(new Date(t));
    }
    if (candidates.length === 0) continue;

    const step = Math.max(1, Math.floor(candidates.length / perDay));
    for (let i = 0; i < candidates.length && slots.filter(sameDay(day)).length < perDay; i += step) {
      slots.push({ start: candidates[i]!, end: new Date(candidates[i]!.getTime() + duration) });
    }
  }

  return slots;

  function sameDay(day: Date) {
    return (s: AvailabilitySlot) =>
      s.start.getFullYear() === day.getFullYear() &&
      s.start.getMonth() === day.getMonth() &&
      s.start.getDate() === day.getDate();
  }
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatSlotLabel(slot: AvailabilitySlot, now: Date = new Date()): string {
  const day = slot.start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isToday = slot.start.toDateString() === now.toDateString();
  const isTomorrow = slot.start.toDateString() === tomorrow.toDateString();
  const prefix = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : day;
  return `${prefix} ${fmtTime(slot.start)}–${fmtTime(slot.end)}`;
}

/**
 * The message text for a set of picked slots. Reads like something a person
 * would type, because the recipient is a person reading a text.
 */
export function formatSlotsAsText(slots: AvailabilitySlot[], now: Date = new Date()): string {
  if (slots.length === 0) return '';
  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
  if (sorted.length === 1) return `Would ${formatSlotLabel(sorted[0]!, now)} work for you?`;
  const lines = sorted.map((s) => `• ${formatSlotLabel(s, now)}`);
  return `Would any of these times work?\n${lines.join('\n')}`;
}
