/**
 * Pure formatting helpers — no I/O, no React. Kept side-effect-free so they
 * are trivially unit-testable.
 */

/** Filled star glyph for rating display. */
const STAR_FILLED = "★"; // ★
/** Empty star glyph for rating display. */
const STAR_EMPTY = "☆"; // ☆

/**
 * Format a price for display.
 *
 * Accepts the loose `number | string | undefined` shape the API may return:
 * - numbers are rendered as USD with two decimals ("$49.99")
 * - strings are returned as-is if they already look formatted, otherwise
 *   coerced through the numeric path when parseable
 * - missing / unparseable values yield an empty string
 */
export function formatPrice(p?: number | string): string {
  if (p === undefined || p === null) return "";

  if (typeof p === "number") {
    if (!Number.isFinite(p)) return "";
    return `$${p.toFixed(2)}`;
  }

  const trimmed = p.trim();
  if (trimmed === "") return "";
  // Already contains a currency symbol or non-numeric formatting — trust it.
  if (/[^0-9.,\s]/.test(trimmed)) return trimmed;

  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : trimmed;
}

/**
 * Render a 0–5 rating as a 5-character star string.
 *
 * Rounds to the nearest whole star and clamps out-of-range / missing values.
 * E.g. stars(4.2) → "★★★★☆".
 */
export function stars(rating?: number): string {
  const safe =
    typeof rating === "number" && Number.isFinite(rating) ? rating : 0;
  const filled = Math.max(0, Math.min(5, Math.round(safe)));
  return STAR_FILLED.repeat(filled) + STAR_EMPTY.repeat(5 - filled);
}

/**
 * Truncate `s` to at most `n` characters, appending an ellipsis when cut.
 * Returns an empty string for nullish input and never returns more than
 * `n` characters total (the ellipsis counts toward the budget).
 */
export function truncate(s: string | undefined, n: number): string {
  if (!s) return "";
  if (n <= 0) return "";
  if (s.length <= n) return s;
  if (n === 1) return "…"; // …
  return s.slice(0, n - 1) + "…";
}
