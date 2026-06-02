/**
 * Static brand registry for the CLI.
 *
 * Accent hex values are copied from the server's ANSI renderer accent map
 * (server/services/ansi-render/brand-accent.ts) so the TUI wordmark/theming
 * matches the rest of the product. Brands not present in that map fall through
 * to the neutral cyan default.
 */

import type { BrandInfo } from "./types.js";

/** Neutral cyan fallback — mirrors brand-accent.ts FALLBACK. */
const FALLBACK_ACCENT = "#7dd3fc";

export const BRANDS: BrandInfo[] = [
  { key: "brooklinen", name: "Brooklinen", accent: "#283455" },
  { key: "away", name: "Away", accent: "#5b7f9c" },
  { key: "warby-parker", name: "Warby Parker", accent: "#1050d0" },
  { key: "ikea", name: "IKEA", accent: "#0058A3" },
  { key: "ray-ban", name: "Ray-Ban", accent: "#e80c00" },
  { key: "allbirds", name: "Allbirds", accent: "#93c45f" },
  { key: "alo-yoga", name: "Alo Yoga", accent: "#c89b4e" },
  { key: "nike-mens-shoes", name: "Nike Men's Shoes", accent: "#ff6a00" },
  { key: "skims", name: "SKIMS", accent: "#a89684" },
  { key: "tumi", name: "TUMI", accent: "#c2a375" },
  { key: "lululemon", name: "lululemon", accent: "#D31334" },
  { key: "american-eagle", name: "American Eagle", accent: "#1F3044" },
  { key: "abercrombie", name: "Abercrombie & Fitch", accent: "#3c4a6b" },
  { key: "ashley-furniture", name: "Ashley Furniture", accent: "#a37a4d" },
  // Not present in brand-accent.ts → neutral fallback.
  { key: "living-spaces", name: "Living Spaces", accent: "#003B5C" },
  { key: "sunglass-hut", name: "Sunglass Hut", accent: "#7B0000" },
  { key: "boll-and-branch", name: "Boll & Branch", accent: "#c9a788" },
  // madison-reed, rothys, tommy-john, drunk-elephant, vuori are absent from
  // brand-accent.ts → neutral fallback.
  { key: "madison-reed", name: "Madison Reed", accent: FALLBACK_ACCENT },
  { key: "rothys", name: "Rothy's", accent: FALLBACK_ACCENT },
  { key: "tommy-john", name: "Tommy John", accent: FALLBACK_ACCENT },
  { key: "drunk-elephant", name: "Drunk Elephant", accent: FALLBACK_ACCENT },
  { key: "vuori", name: "Vuori", accent: FALLBACK_ACCENT },
];

/** Look up a brand by key. Returns undefined if not found. */
export function getBrand(key: string): BrandInfo | undefined {
  return BRANDS.find((b) => b.key === key);
}
