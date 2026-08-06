/** Shared snooze presets, used by the header menu and the `s` shortcut. */
export interface SnoozePreset {
  key: string;
  label: string;
  /** Compute the wake time from "now". */
  until: () => Date;
}

function at(base: Date, hour: number): Date {
  const d = new Date(base);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** "Send later" options — deliberately business-hours friendly. */
export const SEND_LATER_PRESETS: SnoozePreset[] = [
  { key: 'in1h', label: 'In 1 hour', until: () => new Date(Date.now() + 3600_000) },
  {
    key: 'tomorrow9',
    label: 'Tomorrow, 9 AM',
    until: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return at(d, 9);
    },
  },
  {
    key: 'monday9',
    label: 'Monday, 9 AM',
    until: () => {
      const d = new Date();
      const day = d.getDay();
      d.setDate(d.getDate() + ((1 - day + 7) % 7 || 7));
      return at(d, 9);
    },
  },
];

export const SNOOZE_PRESETS: SnoozePreset[] = [
  {
    key: 'later',
    label: 'Later today',
    until: () => new Date(Date.now() + 3 * 3600_000),
  },
  {
    key: 'tomorrow',
    label: 'Tomorrow, 9 AM',
    until: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return at(d, 9);
    },
  },
  {
    key: 'weekend',
    label: 'Saturday, 9 AM',
    until: () => {
      const d = new Date();
      const day = d.getDay();
      d.setDate(d.getDate() + ((6 - day + 7) % 7 || 7));
      return at(d, 9);
    },
  },
  {
    key: 'nextweek',
    label: 'Next Monday, 9 AM',
    until: () => {
      const d = new Date();
      const day = d.getDay();
      d.setDate(d.getDate() + ((1 - day + 7) % 7 || 7));
      return at(d, 9);
    },
  },
];
