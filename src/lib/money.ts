/** Format a number as Indian Rupees, tolerating null/undefined values. */
export function inr(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}
