/**
 * Shared layout + color utilities for the aigency TUI.
 *
 * Two cross-cutting concerns the components must agree on:
 *
 *  - columnsForPicker — the brand-grid column count derived from terminal
 *    width. Used by BOTH BrandPicker (to lay the grid out) and App (to size the
 *    up/down arrow stride so vertical navigation moves exactly one visual row).
 *
 *  - readableAccent — brand accents are the real brand colors, and several are
 *    very dark (navy, maroon, charcoal) — unreadable as foreground text on a
 *    dark terminal. This lightens a too-dark accent while PRESERVING its hue, so
 *    "Brooklinen" stays recognizably navy-blue but legible. Already-readable
 *    accents pass through untouched.
 */

/** Brand-grid columns for a given terminal width (shared by App + BrandPicker). */
export function columnsForPicker(width: number): number {
  if (width >= 100) return 4;
  if (width >= 72) return 3;
  if (width >= 44) return 2;
  return 1;
}

// ── Color helpers ────────────────────────────────────────────────────────────

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parse a #rrggbb (or rrggbb) hex string to RGB, or null if malformed. */
function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** RGB → HSL. h in [0,360), s & l in [0,1]. */
function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h *= 60;
  }
  return { h, s, l };
}

/** HSL → #rrggbb. */
function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g] = [c, x];
  else if (hh < 120) [r, g] = [x, c];
  else if (hh < 180) [g, b] = [c, x];
  else if (hh < 240) [g, b] = [x, c];
  else if (hh < 300) [r, b] = [x, c];
  else [r, b] = [c, x];
  const to = (v: number): string =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Below this HSL lightness an accent reads as too-dark on a dark terminal. */
const MIN_LIGHTNESS = 0.4;
/** Lightness we lift a too-dark accent to (keeps hue, gains legibility). */
const TARGET_LIGHTNESS = 0.62;

/**
 * Return an accent safe to use as foreground text on a dark terminal. If the
 * given hex is already light enough (or unparseable / undefined) it is returned
 * unchanged; otherwise its hue is preserved but lightened so it stays legible.
 */
export function readableAccent(hex?: string): string | undefined {
  if (!hex) return hex;
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const { h, s, l } = rgbToHsl(rgb);
  // Trigger on HSL lightness, NOT WCAG luminance: luminance underweights
  // saturated reds/blues and would wash out vivid brand colors (e.g. Ray-Ban
  // red, lum 0.17) that read perfectly on a dark terminal. Lightness cleanly
  // separates genuinely-dark muted accents (navy, charcoal) from vivid ones.
  if (l >= MIN_LIGHTNESS) return hex;
  // Keep some saturation so the brand color stays recognizable (skip for true
  // grays, where s === 0), then lift lightness into the readable range.
  const sat = s === 0 ? 0 : Math.max(0.45, Math.min(s, 0.9));
  return hslToHex(h, sat, TARGET_LIGHTNESS);
}
