/**
 * view.ts — picks which results layout to render for a result set, mirroring
 * the web app's getQueryResponseType: 1 product → a single detail view, 2–3 →
 * a side-by-side comparison, 4+ → the grid. Pure + exported for unit tests.
 */

/** The three result layouts, matching the web app's view types. */
export type ResultsView = "single" | "comparison" | "grid";

/**
 * Choose the results layout for `count` products. Matches the web heuristic so
 * the terminal UI behaves like the site: one match opens as a detail card, a
 * handful compare side-by-side, more fill the grid. Zero falls through to grid,
 * which renders its own "no matches" empty state.
 */
export function resultsView(count: number): ResultsView {
  if (count === 1) return "single";
  if (count === 2 || count === 3) return "comparison";
  return "grid";
}
