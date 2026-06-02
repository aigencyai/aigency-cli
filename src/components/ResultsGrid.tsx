/**
 * ResultsGrid — the centerpiece results view.
 *
 * A width-responsive grid of product CARDS. Each card is a round bordered box
 * laid out as a column:
 *
 *   ┌────────────────────┐
 *   │▌ ⠀⡀⣤⣶⣿⣿⣿⣶⣤⡀     │  ← braille thumbnail (verbatim, single-width rows)
 *   │  ⠰⣿⣿⠟⠋⠛⢿⣿⢦       │     OR a same-height blank spacer when absent, so
 *   │  ⠈⠛⢿⠟⠈⢻⢿⠛        │     every card in a row aligns to the same height.
 *   │  Aviator Classic…   │  ← title, truncated to card width
 *   │  $215.00  ★★★★★     │  ← dim meta line: price + (optional) stars
 *   └────────────────────┘
 *
 * The selected card is emphasized (accent border, bold/accent title, left bar).
 * Long lists are WINDOWED: only a slice centered on the selection is rendered,
 * with dim "↑ N more" / "↓ N more" indicators above/below.
 *
 * Layout math
 * ───────────
 *   cols      = how many cards fit across the terminal (>=1)
 *   cardWidth = floor(width / cols) - GUTTER       (total box width incl. border)
 *   innerW    = cardWidth - CARD_CHROME            (room for text inside)
 *
 * CARD_CHROME = round border (1 left + 1 right) + paddingX 1 (left + right) = 4.
 *
 * PRESENTATIONAL ONLY: a pure function of props. No keyboard handling, no data
 * fetching, no timers — App owns all of that.
 */

import React from "react";
import { Box, Text, useStdout } from "ink";
import type { Product } from "../types.js";
import { formatPrice, stars, truncate } from "../format.js";

/** Fallback terminal width when stdout reports nothing usable. */
const FALLBACK_WIDTH = 80;
/** Horizontal space reserved between adjacent cards. */
const GUTTER = 2;
/** Min total card width; below this we collapse to a single column. */
const MIN_CARD_WIDTH = 22;
/** Border (2) + paddingX 1 on each side (2) consumed by a round Box. */
const CARD_CHROME = 4;
/** Default number of card rows kept visible before windowing kicks in. */
const DEFAULT_MAX_ROWS = 2;
/** Left-bar glyph (U+258C) marking the selected card. */
const LEFT_BAR = "▌";

export interface ResultsGridProps {
  /** Products to display. */
  products: Product[];
  /** Index of the currently selected product. */
  selectedIndex: number;
  /** Optional brand accent hex for highlighting the selected card. */
  accent?: string;
  /**
   * Optional cap on the number of card ROWS kept visible. The grid windows the
   * list to at most `maxRows * cols` cards, centered on the selection. Defaults
   * to {@link DEFAULT_MAX_ROWS}.
   */
  maxRows?: number;
}

/** Read the current terminal width, defending against unset / zero values. */
function useTerminalWidth(): number {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? process.stdout.columns;
  return cols && cols > 0 ? cols : FALLBACK_WIDTH;
}

/** A single product card. Memoized — cards only re-render when their inputs change. */
const Card = React.memo(function Card({
  product,
  selected,
  accent,
  innerWidth,
  cardWidth,
  thumbRows,
}: {
  product: Product;
  selected: boolean;
  accent?: string;
  /** Usable text width inside the card. */
  innerWidth: number;
  /** Total card box width (incl. border). */
  cardWidth: number;
  /** Number of braille rows to reserve, so sibling cards align. */
  thumbRows: number;
}): React.ReactElement {
  const thumb = product.thumbnail ?? [];
  const price = formatPrice(product.price);
  const rating =
    typeof product.rating_value === "number" ? stars(product.rating_value) : "";
  const meta = [price, rating].filter(Boolean).join("  ");

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={selected ? accent : undefined}
      borderDimColor={!selected}
      paddingX={1}
      width={cardWidth}
    >
      {/* Braille thumbnail: stacked, verbatim, never wrapped. A blank spacer of
          the same height stands in when a card has no thumbnail so the row's
          cards stay vertically aligned. */}
      {thumbRows > 0 && (
        <Box flexDirection="column">
          {Array.from({ length: thumbRows }, (_, r) => (
            // A lone space keeps an absent braille row from collapsing to zero
            // height, so a no-thumbnail card's title aligns with its siblings'.
            <Text key={r} wrap="truncate">
              {thumb[r] ?? " "}
            </Text>
          ))}
        </Box>
      )}

      {/* Title — left bar + accent/bold when selected, two spaces otherwise so
          the text starts at the same column either way. */}
      <Text
        color={selected ? accent : undefined}
        bold={selected}
        wrap="truncate"
      >
        {selected ? `${LEFT_BAR} ` : "  "}
        {truncate(product.title, Math.max(1, innerWidth - 2))}
      </Text>

      {/* Dim meta line: price + optional stars. */}
      <Text dimColor wrap="truncate">
        {"  "}
        {truncate(meta, Math.max(1, innerWidth - 2))}
      </Text>
    </Box>
  );
});

export function ResultsGrid({
  products,
  selectedIndex,
  accent,
  maxRows = DEFAULT_MAX_ROWS,
}: ResultsGridProps): React.ReactElement {
  const width = useTerminalWidth();

  if (products.length === 0) {
    return (
      <Box marginTop={1}>
        <Text dimColor>No matches — try another search.</Text>
      </Box>
    );
  }

  // ── Column count ────────────────────────────────────────────────────────
  // Greedily fit as many MIN_CARD_WIDTH (+gutter) columns as the width allows,
  // never fewer than one — so narrow terminals collapse to a single column.
  // Greedily fit columns, then shrink until a full row (cards + the gutters
  // between them) genuinely fits the width. Clamping cardWidth up to
  // MIN_CARD_WIDTH without this guard overflows at the boundary (e.g. 2 cards +
  // gutter = 48 cols at width 46). cardWidth is then derived from the width that
  // actually remains after the inter-card gutters, so the row never exceeds it.
  let cols = Math.max(1, Math.floor((width + GUTTER) / (MIN_CARD_WIDTH + GUTTER)));
  while (cols > 1 && cols * MIN_CARD_WIDTH + (cols - 1) * GUTTER > width) cols--;
  const cardWidth = Math.max(1, Math.floor((width - (cols - 1) * GUTTER) / cols));
  const innerWidth = Math.max(1, cardWidth - CARD_CHROME);

  // ── Windowing ─────────────────────────────────────────────────────────────
  // Cap visible cards to maxRows*cols and slide a window so the selection stays
  // inside it. Clamp selectedIndex defensively (App may pass a stale value).
  const visibleRows = Math.max(1, maxRows);
  const capacity = Math.min(products.length, visibleRows * cols);
  const safeSelected = Math.min(
    Math.max(0, selectedIndex),
    products.length - 1,
  );

  // Center the window on the selection, then clamp to list bounds.
  let start = safeSelected - Math.floor(capacity / 2);
  start = Math.max(0, Math.min(start, products.length - capacity));
  const end = start + capacity;
  const hiddenAbove = start;
  const hiddenBelow = products.length - end;

  // Slice into rows of `cols` cards each. Reserve braille height per ROW (the
  // tallest thumbnail in that row) so every card in a row aligns.
  const visible = products.slice(start, end);
  const rows: Product[][] = [];
  for (let i = 0; i < visible.length; i += cols) {
    rows.push(visible.slice(i, i + cols));
  }

  return (
    <Box flexDirection="column">
      {hiddenAbove > 0 && (
        <Text dimColor>{`  ↑ ${hiddenAbove} more`}</Text>
      )}

      {rows.map((row, rowIdx) => {
        const thumbRows = row.reduce(
          (max, p) => Math.max(max, p.thumbnail?.length ?? 0),
          0,
        );
        return (
          <Box key={`row-${start + rowIdx * cols}`} marginBottom={1}>
            {row.map((p, colIdx) => {
              const absIndex = start + rowIdx * cols + colIdx;
              // Stable key: prefer a stable field (url) over title, fall back to
              // title; suffix with absolute index to disambiguate dupes.
              const stableKey = `${(p.url as string) || p.title}-${absIndex}`;
              return (
                <Box
                  key={stableKey}
                  marginRight={colIdx < row.length - 1 ? GUTTER : 0}
                >
                  <Card
                    product={p}
                    selected={absIndex === safeSelected}
                    accent={accent}
                    innerWidth={innerWidth}
                    cardWidth={cardWidth}
                    thumbRows={thumbRows}
                  />
                </Box>
              );
            })}
          </Box>
        );
      })}

      {hiddenBelow > 0 && (
        <Text dimColor>{`  ↓ ${hiddenBelow} more`}</Text>
      )}
    </Box>
  );
}

export default ResultsGrid;
