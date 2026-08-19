/**
 * Date utility functions for timezone-resilient date operations.
 * Prevents UTC shift anomalies in negative timezones (e.g. UTC-3 Brasília).
 */

/**
 * Returns 'YYYY-MM-DD' formatted date string based on local calendar year, month, and day.
 * Unlike toISOString().split('T')[0], this prevents date shifting between 21:00 and 23:59 in UTC-3.
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Safely formats 'YYYY-MM-DD' to 'DD/MM/YYYY' for display without UTC shift.
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

/**
 * Returns a Date object for a 'YYYY-MM-DD' string pinned to local noon (12:00:00)
 * to avoid midnight timezone or daylight saving boundary shifts.
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}
