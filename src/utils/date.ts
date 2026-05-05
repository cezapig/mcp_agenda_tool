/**
 * Returns an array of ISO date strings (YYYY-MM-DD) for the next `count` days
 * starting from `from` (inclusive).
 */
export function getNextDays(from: Date, count: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    dates.push(toISODate(d));
  }
  return dates;
}

/**
 * Returns YYYY-MM-DD string from a Date (UTC-safe via local date parts).
 */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns true if the given ISO date string is a weekday (Mon–Fri).
 */
export function isWeekday(isoDate: string): boolean {
  const date = new Date(`${isoDate}T12:00:00`);
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

/**
 * Generates slot time blocks for a given day.
 * Returns pairs of [startTime, endTime] in 24-h "HH:MM" format.
 */
export function generateTimeBlocks(
  startHour: number,
  endHour: number,
  durationMinutes: number
): Array<{ startTime: string; endTime: string }> {
  const blocks: Array<{ startTime: string; endTime: string }> = [];
  let current = startHour * 60;
  const end = endHour * 60;

  while (current + durationMinutes <= end) {
    blocks.push({
      startTime: minutesToTime(current),
      endTime: minutesToTime(current + durationMinutes),
    });
    current += durationMinutes;
  }
  return blocks;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Simple email format check.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Simple phone format check — at least 7 digits, optional leading +.
 */
export function isValidPhone(phone: string): boolean {
  return /^\+?[\d\s\-()]{7,}$/.test(phone);
}
