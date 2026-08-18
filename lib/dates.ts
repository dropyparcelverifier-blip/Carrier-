/**
 * A bare date ("10 Aug 2026") makes a customer do the subtraction
 * themselves. This does it for them — "in 3 days" is the thing that's
 * actually easy to scan, the exact date is what confirms it. Whole-day
 * diff (midnight to midnight), not a 24h rolling window, so "tomorrow"
 * means the calendar day after today regardless of what time it is now.
 */
export function relativeDays(dateStr: string): string | null {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;

  const now = new Date();
  const target = Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((target - today) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}
