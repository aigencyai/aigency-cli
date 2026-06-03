/**
 * Comparison — the side-by-side view, mirroring the web app's comparison
 * layout for 2–3 products. Each product is a column; sections (title, price +
 * rating, colors, sizes, "why it matches") are padded to a FIXED line count so
 * the rows line up across columns — the terminal equivalent of the web's
 * equalizer height-sync.
 *
 *   ┌──────────────────┐ ┌──────────────────┐
 *   │ ⠀⡀⣤⣶⣿⣶⣤⡀       │ │ ⣀⣤⣤⣤⣤⣄⡀        │  ← braille thumbnail
 *   │ ▌ Aviator        │ │   Wayfarer       │  ← title (2 lines, padded)
 *   │   Classic        │ │                  │
 *   │ $215  ★★★★★      │ │ $161  ★★★★★      │  ← price + rating
 *   │ Colors Gold, …   │ │ Colors Black     │  ← colors (1 line)
 *   │ Sizes 55, 58     │ │ Sizes 50, 52     │  ← sizes (1 line)
 *   │ Iconic teardrop  │ │ The original     │  ← why (3 lines, padded)
 *   │ shape with …     │ │ everyday frame…  │
 *   └──────────────────┘ └──────────────────┘
 *
 * PRESENTATIONAL ONLY: a pure function of props. App owns selection + keys.
 */

import React from "react";
import { Box, Text, useStdout } from "ink";
import type { Product } from "../types.js";
import { formatPrice, stars, stripAnsi, truncate, wrapText } from "../format.js";

/** Fallback terminal width when stdout reports nothing usable. */
const FALLBACK_WIDTH = 80;
/** Horizontal gap between columns. */
const GUTTER = 2;
/** Border (2) + paddingX 1 each side (2) consumed by a round column box. */
const COL_CHROME = 4;
/** Min total column width before things get unreadable. */
const MIN_COL = 18;
/** Braille rows reserved per column (matches server DEFAULT_ROWS = 3). */
const THUMB_ROWS = 3;
/** Fixed line budgets per section so columns align. */
const TITLE_LINES = 2;
const WHY_LINES = 3;
/** Left-bar glyph marking the selected column. */
const LEFT_BAR = "▌";

export interface ComparisonProps {
  /** The products to compare side-by-side (2–3 in practice). */
  products: Product[];
  /** Index of the currently selected product (highlights its column). */
  selectedIndex: number;
  /** Brand accent hex for the selected column + braille tint. */
  accent?: string;
}

/** Pad/truncate `lines` to exactly `n` entries so sibling columns align. */
function fixLines(lines: string[], n: number): string[] {
  const out = lines.slice(0, n);
  while (out.length < n) out.push("");
  return out;
}

/** Center `s` within `width` cols (used to center braille in a wide column). */
function center(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  return " ".repeat(Math.floor((width - s.length) / 2)) + s;
}

/** A single comparison column. */
function Column({
  product,
  selected,
  accent,
  innerWidth,
  colWidth,
}: {
  product: Product;
  selected: boolean;
  accent?: string;
  innerWidth: number;
  colWidth: number;
}): React.ReactElement {
  const thumb = Array.isArray(product.thumbnail) ? product.thumbnail : [];
  const hasThumb = thumb.length > 0;

  const price = formatPrice(product.price);
  const rating =
    typeof product.rating_value === "number" ? stars(product.rating_value) : "";
  const meta = [price, rating].filter(Boolean).join("  ");

  const titleLines = fixLines(
    wrapText(product.title, Math.max(1, innerWidth - 2)),
    TITLE_LINES,
  );

  const colors = Array.isArray(product.colors) ? product.colors : [];
  const colorLine = colors.length ? `Colors ${colors.join(", ")}` : "";

  const sizes = Array.isArray(product.available_sizes)
    ? product.available_sizes
    : Array.isArray(product.sizes)
      ? product.sizes
      : [];
  const sizeLine = sizes.length ? `Sizes ${sizes.join(", ")}` : "";

  const whyLines = fixLines(
    product.why_it_matches
      ? wrapText(product.why_it_matches, innerWidth)
      : [],
    WHY_LINES,
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={selected ? accent : undefined}
      borderDimColor={!selected}
      paddingX={1}
      width={colWidth}
    >
      {/* Braille thumbnail (or a blank reserved block) so columns align. */}
      <Box flexDirection="column">
        {Array.from({ length: THUMB_ROWS }, (_, r) => (
          <Text key={`t${r}`} color={accent} wrap="truncate">
            {hasThumb ? center(stripAnsi(thumb[r] ?? ""), innerWidth) : " "}
          </Text>
        ))}
      </Box>

      {/* Title (TITLE_LINES, padded). First line carries the selected bar. */}
      {titleLines.map((line, i) => (
        <Text
          key={`title-${i}`}
          color={selected ? accent : undefined}
          bold={selected}
          wrap="truncate"
        >
          {i === 0 ? (selected ? `${LEFT_BAR} ` : "  ") : "  "}
          {truncate(line, Math.max(1, innerWidth - 2))}
        </Text>
      ))}

      {/* Price + rating. */}
      <Text dimColor wrap="truncate">
        {"  "}
        {truncate(meta, Math.max(1, innerWidth - 2))}
      </Text>

      {/* Colors + sizes (one line each; blank when absent). */}
      <Text dimColor wrap="truncate">
        {"  "}
        {truncate(colorLine, Math.max(1, innerWidth - 2)) || " "}
      </Text>
      <Text dimColor wrap="truncate">
        {"  "}
        {truncate(sizeLine, Math.max(1, innerWidth - 2)) || " "}
      </Text>

      {/* Why it matches (WHY_LINES, padded). */}
      {whyLines.map((line, i) => (
        <Text key={`why-${i}`} wrap="truncate">
          {"  "}
          {line || " "}
        </Text>
      ))}
    </Box>
  );
}

export function Comparison({
  products,
  selectedIndex,
  accent,
}: ComparisonProps): React.ReactElement {
  const { stdout } = useStdout();
  const width =
    stdout?.columns && stdout.columns > 0 ? stdout.columns : FALLBACK_WIDTH;

  if (products.length === 0) {
    return (
      <Box marginTop={1}>
        <Text dimColor>Nothing to compare.</Text>
      </Box>
    );
  }

  const n = products.length;
  const colWidth = Math.max(
    MIN_COL,
    Math.floor((width - (n - 1) * GUTTER) / n),
  );
  const innerWidth = Math.max(1, colWidth - COL_CHROME);
  const safeSelected = Math.min(Math.max(0, selectedIndex), n - 1);

  return (
    <Box flexDirection="row">
      {products.map((product, i) => {
        const stableKey = `${(product.url as string) || product.title}-${i}`;
        return (
          <Box key={stableKey} marginRight={i < n - 1 ? GUTTER : 0}>
            <Column
              product={product}
              selected={i === safeSelected}
              accent={accent}
              innerWidth={innerWidth}
              colWidth={colWidth}
            />
          </Box>
        );
      })}
    </Box>
  );
}

export default Comparison;
