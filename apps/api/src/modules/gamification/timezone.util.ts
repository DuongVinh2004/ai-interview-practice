/**
 * Utility functions for Timezone-Aware Calculations (NEW-DATA-01)
 */

export function parseTimezoneOffsetMinutes(tz?: string): number | null {
  if (!tz || typeof tz !== 'string') return null;
  const trimmed = tz.trim();
  if (!trimmed) return null;

  if (trimmed.toUpperCase() === 'UTC' || trimmed.toUpperCase() === 'GMT' || trimmed === 'Z') {
    return 0;
  }

  // Matches "+07:00", "-05:00", "+0700", "-0500", "+07", "-5", "UTC+7", "UTC-05:00", "GMT+7"
  const match = trimmed.match(/^(?:UTC|GMT)?([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (match) {
    const sign = match[1] === '-' ? -1 : 1;
    const hours = parseInt(match[2], 10);
    const mins = match[3] ? parseInt(match[3], 10) : 0;
    return sign * (hours * 60 + mins);
  }

  return null;
}

export function normalizeTimezone(tz?: string): string {
  if (!tz || typeof tz !== 'string') return 'UTC';
  const trimmed = tz.trim();
  if (!trimmed) return 'UTC';

  const offsetMinutes = parseTimezoneOffsetMinutes(trimmed);
  if (offsetMinutes !== null) {
    return trimmed;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch {
    return 'UTC';
  }
}

export function getTimezoneOffsetMinutes(date: Date, timezone: string = 'UTC'): number {
  const explicitOffset = parseTimezoneOffsetMinutes(timezone);
  if (explicitOffset !== null) return explicitOffset;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const y = parseInt(parts.find(p => p.type === 'year')!.value, 10);
    const m = parseInt(parts.find(p => p.type === 'month')!.value, 10);
    const d = parseInt(parts.find(p => p.type === 'day')!.value, 10);
    let h = parseInt(parts.find(p => p.type === 'hour')!.value, 10);
    if (h === 24) h = 0;
    const min = parseInt(parts.find(p => p.type === 'minute')!.value, 10);
    const sec = parseInt(parts.find(p => p.type === 'second')!.value, 10);

    const localTimeAsUtc = Date.UTC(y, m - 1, d, h, min, sec);
    const actualUtc = date.getTime();
    return Math.round((localTimeAsUtc - actualUtc) / 60000);
  } catch {
    return 0;
  }
}

export function getLocalDateComponents(
  date: Date = new Date(),
  timezone: string = 'UTC',
): {
  year: number;
  month: number;
  day: number;
  dateStr: string;
} {
  const offsetMinutes = parseTimezoneOffsetMinutes(timezone);

  if (offsetMinutes !== null) {
    const targetMs = date.getTime() + offsetMinutes * 60 * 1000;
    const targetDate = new Date(targetMs);
    const year = targetDate.getUTCFullYear();
    const month = targetDate.getUTCMonth() + 1;
    const day = targetDate.getUTCDate();
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { year, month, day, dateStr };
  }

  try {
    const validTz = normalizeTimezone(timezone);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: validTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const year = parseInt(parts.find(p => p.type === 'year')!.value, 10);
    const month = parseInt(parts.find(p => p.type === 'month')!.value, 10);
    const day = parseInt(parts.find(p => p.type === 'day')!.value, 10);
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { year, month, day, dateStr };
  } catch {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { year, month, day, dateStr };
  }
}

export function getLocalDayBoundaries(
  date: Date = new Date(),
  timezone: string = 'UTC',
): {
  startOfDay: Date;
  endOfDay: Date;
  dateStr: string;
} {
  const { year, month, day, dateStr } = getLocalDateComponents(date, timezone);
  const offsetMinutes = getTimezoneOffsetMinutes(date, timezone);

  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMinutes * 60 * 1000;
  const endUtcMs = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - offsetMinutes * 60 * 1000;

  return {
    startOfDay: new Date(startUtcMs),
    endOfDay: new Date(endUtcMs),
    dateStr,
  };
}

export function calculateDayDifference(
  targetDateInput: Date | string,
  referenceDateInput: Date | string,
  timezone: string = 'UTC',
): number {
  const targetStr =
    typeof targetDateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(targetDateInput)
      ? targetDateInput
      : getLocalDateComponents(
          typeof targetDateInput === 'string' ? new Date(targetDateInput) : targetDateInput,
          timezone,
        ).dateStr;

  const refStr =
    typeof referenceDateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(referenceDateInput)
      ? referenceDateInput
      : getLocalDateComponents(
          typeof referenceDateInput === 'string'
            ? new Date(referenceDateInput)
            : referenceDateInput,
          timezone,
        ).dateStr;

  const [y1, m1, d1] = targetStr.split('-').map(Number);
  const [y2, m2, d2] = refStr.split('-').map(Number);

  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);

  return Math.round((utc1 - utc2) / (1000 * 60 * 60 * 24));
}
