/**
 * resolve.ts — the command-line interpreter for the results-view input.
 *
 * The SearchBar input is a *command line*, not just a search box. When the user
 * presses Enter with no chip focused, App routes the raw input through
 * {@link resolveInput} to decide what it means. Arrow keys are sugar over the
 * same intents (move the selection, then Enter to open).
 *
 * Grammar (all matching is on the TRIMMED input):
 *
 *   ""                      → { kind: 'current' }     open the selected card
 *   "#3" | "3"              → { kind: 'open',   ... }  open the Nth result (1-based)
 *   "compare 1 and 2"       → { kind: 'compare', ... } compare 2+ in-range results
 *   "compare #1 #3"         → { kind: 'compare', ... }
 *   "compare 1"             → { kind: 'search', ... }  <2 valid → falls through
 *   "red dress"             → { kind: 'search', ... }  anything else is a query
 *
 * `open`/`compare` indices are returned 0-BASED so callers can index `results`
 * directly. Out-of-range numbers are rejected (an out-of-range "open" becomes a
 * plain search; a "compare" keeps only in-range numbers and needs 2+ to count).
 *
 * Pure & exported so it is trivially unit-testable (see __tests__/resolve.test.ts).
 */

/** The decoded meaning of a results-view Enter. */
export type Resolved =
  | { kind: "current" }
  | { kind: "open"; index: number }
  | { kind: "compare"; indices: number[] }
  | { kind: "search"; query: string };

/** Matches a bare result reference: an optional leading '#' then digits. */
const OPEN_RE = /^#?(\d+)$/;
/** Pulls every number (with or without a leading '#') out of a compare phrase. */
const NUMBER_RE = /#?(\d+)/g;

/**
 * Decode `raw` into an intent given how many results are currently shown.
 *
 * @param raw          The verbatim input value (untrimmed; we trim internally).
 * @param resultCount  How many results exist, so we can range-check references.
 */
export function resolveInput(raw: string, resultCount: number): Resolved {
  const text = raw.trim();

  // Empty input → act on the current selection.
  if (text === "") return { kind: "current" };

  // A bare "#N" / "N" reference → open that result if it's in range. An
  // out-of-range or zero reference is NOT a valid command, so it falls through
  // to a normal search (the user may genuinely be searching for "99").
  const openMatch = OPEN_RE.exec(text);
  if (openMatch) {
    const n = Number.parseInt(openMatch[1], 10);
    if (n >= 1 && n <= resultCount) {
      return { kind: "open", index: n - 1 };
    }
    return { kind: "search", query: text };
  }

  // A phrase beginning with "compare" (case-insensitive) → gather every
  // in-range number it mentions. With 2+ distinct valid references we compare;
  // with fewer it isn't a meaningful compare, so we fall through to search.
  if (/^compare\b/i.test(text)) {
    const indices: number[] = [];
    const seen = new Set<number>();
    for (const m of text.matchAll(NUMBER_RE)) {
      const n = Number.parseInt(m[1], 10);
      if (n >= 1 && n <= resultCount) {
        const zero = n - 1;
        if (!seen.has(zero)) {
          seen.add(zero);
          indices.push(zero);
        }
      }
    }
    if (indices.length >= 2) {
      return { kind: "compare", indices };
    }
    return { kind: "search", query: text };
  }

  // Everything else is a normal search query.
  return { kind: "search", query: text };
}

/** The decoded meaning of an Enter on the store LANDING (before any search). */
export type LandingResolved =
  | { kind: "tile"; index: number }
  | { kind: "search"; query: string };

/**
 * Decode a landing-view Enter. Unlike the results grammar, the landing only
 * distinguishes "open a highlight tile" from "search":
 *
 *   ""          → open the focused tile (`tileIndex`)
 *   "1".."N"    → open that tile (1-based, in range)
 *   anything    → search (incl. an out-of-range or zero number, which is a
 *                 legitimate query like "0" or "99")
 *
 * `index` is 0-BASED. The caller still range-checks `index` against the live
 * tiles array (an empty box with no tiles resolves to index `tileIndex`, which
 * the caller treats as a no-op when no tile exists there).
 */
export function resolveLanding(
  raw: string,
  tileCount: number,
  tileIndex: number,
): LandingResolved {
  const text = raw.trim();
  if (text === "") return { kind: "tile", index: tileIndex };
  if (/^\d+$/.test(text)) {
    const n = Number.parseInt(text, 10);
    if (n >= 1 && n <= tileCount) return { kind: "tile", index: n - 1 };
  }
  return { kind: "search", query: text };
}
