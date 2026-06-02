/**
 * ProductDetail — drill-in panel for a single product.
 *
 * A presentational, pure-function-of-props view: braille thumbnail, title,
 * a price/rating/stock meta line, a "why it matches" rationale, a clipped
 * description, colorways, sizes, the PDP url, and a key-hint footer.
 *
 * Everything except `title` is optional and rendered defensively — the backend
 * is a fast-iterating prototype and may omit any field at any time. No hooks
 * beyond reading terminal width, no input handling, no timers: App owns all
 * keyboard state and navigation.
 *
 *   ╭──────────────────────────────────────────╮
 *   │ ⠀⡀⣤⣶⣿⣿⣿⣿⣶⣤⡀                            │  ← braille thumbnail (verbatim)
 *   │ Aviator Classic Polarized                 │  ← title (bold, accent)
 *   │ $215.00   ★★★★★ 4.6                        │  ← meta (dim) + · out of stock
 *   │ Why it matches  <wrapped rationale>        │  ← accent label + wrapped text
 *   │ <wrapped description, clipped to ~6 lines> │
 *   │ Colors  Gold / Green Classic, …           │  ← dim label + wrapped values
 *   │ Sizes   55, 58, 62                         │
 *   │ https://www.ray-ban.com/aviator           │  ← url (dim)
 *   │ esc back · o open · q quit                 │  ← footer (dim)
 *   ╰──────────────────────────────────────────╯
 */

import React from "react";
import { Box, Text, useStdout } from "ink";
import type { Product } from "../types.js";
import { formatPrice, stars, stripAnsi } from "../format.js";

/** Border (2 cols) + paddingX 1 each side (2 cols) eaten by the panel chrome. */
const PANEL_CHROME_COLS = 4;
/** Fallback width when the terminal does not report a usable column count. */
const FALLBACK_COLUMNS = 80;
/** Hard cap on description lines so a long body never dominates the panel. */
const DESCRIPTION_MAX_LINES = 6;

export interface ProductDetailProps {
  /** The product to display in detail. */
  product: Product;
  /** Optional brand accent hex for headings, labels, and the panel border. */
  accent?: string;
}

/**
 * Greedily word-wrap `text` to at most `width` columns, returning one string
 * per line. Single words longer than `width` are hard-split so nothing
 * overflows the panel. Returns an empty array for blank input.
 */
function wrapText(text: string, width: number): string[] {
  if (!text || width <= 0) return [];
  const lines: string[] = [];
  let current = "";

  for (const rawWord of text.split(/\s+/)) {
    if (rawWord === "") continue;

    let word = rawWord;
    // Hard-split words that can never fit on a single line.
    while (word.length > width) {
      if (current !== "") {
        lines.push(current);
        current = "";
      }
      lines.push(word.slice(0, width));
      word = word.slice(width);
    }

    if (current === "") {
      current = word;
    } else if (current.length + 1 + word.length <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current !== "") lines.push(current);
  return lines;
}

/** Render an array of pre-wrapped lines as stacked, non-reflowing Text rows. */
function Lines({
  lines,
  keyPrefix,
  dim,
}: {
  lines: string[];
  keyPrefix: string;
  dim?: boolean;
}): React.ReactElement {
  return (
    <>
      {lines.map((line, i) => (
        <Text key={`${keyPrefix}-${i}`} dimColor={dim} wrap="truncate">
          {line}
        </Text>
      ))}
    </>
  );
}

export function ProductDetail({
  product,
  accent,
}: ProductDetailProps): React.ReactElement {
  const { stdout } = useStdout();
  const columns = stdout?.columns || FALLBACK_COLUMNS;
  // Width available for content inside the bordered, padded panel.
  const innerWidth = Math.max(1, columns - PANEL_CHROME_COLS);

  const thumb = Array.isArray(product.thumbnail) ? product.thumbnail : [];
  const priceText = formatPrice(product.price);
  const hasRating = typeof product.rating_value === "number";

  // Meta line: "$215.00   ★★★★★ 4.6 · out of stock" — assembled from the parts
  // that are actually present so we never render dangling separators.
  const metaParts: string[] = [];
  if (priceText) metaParts.push(priceText);
  if (hasRating) {
    metaParts.push(`${stars(product.rating_value)} ${product.rating_value}`);
  }
  let metaText = metaParts.join("   ");
  if (product.in_stock === false) {
    metaText = metaText ? `${metaText} · out of stock` : "out of stock";
  }

  const whyLines = product.why_it_matches
    ? wrapText(product.why_it_matches, innerWidth)
    : [];

  const descLines = product.description
    ? wrapText(product.description, innerWidth).slice(0, DESCRIPTION_MAX_LINES)
    : [];

  const colors = Array.isArray(product.colors) ? product.colors : [];
  const colorLines = colors.length
    ? wrapText(`Colors  ${colors.join(", ")}`, innerWidth)
    : [];

  // Prefer the variant-resolved size list when the backend provides it; the
  // plain `sizes` index field can be a stale superset (see API contract review).
  const sizes = Array.isArray(product.available_sizes)
    ? product.available_sizes
    : Array.isArray(product.sizes)
      ? product.sizes
      : [];
  const sizeLines = sizes.length
    ? wrapText(`Sizes  ${sizes.join(", ")}`, innerWidth)
    : [];

  const urlLines =
    typeof product.url === "string" && product.url
      ? wrapText(product.url, innerWidth)
      : [];

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={accent}
      paddingX={1}
    >
      {thumb.length > 0 ? (
        <Box flexDirection="column" marginBottom={1}>
          {thumb.map((line, i) => (
            // Braille is fixed single-width art: render verbatim, never wrap.
            // Strip any ANSI tint the server added; we color it ourselves.
            <Text key={`thumb-${i}`} color={accent} wrap="truncate">
              {stripAnsi(line)}
            </Text>
          ))}
        </Box>
      ) : null}

      <Text bold color={accent} wrap="truncate">
        {product.title}
      </Text>

      {metaText ? (
        <Text dimColor wrap="truncate">
          {metaText}
        </Text>
      ) : null}

      {whyLines.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={accent}>
            Why it matches
          </Text>
          <Lines lines={whyLines} keyPrefix="why" />
        </Box>
      ) : null}

      {descLines.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Lines lines={descLines} keyPrefix="desc" />
        </Box>
      ) : null}

      {colorLines.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Lines lines={colorLines} keyPrefix="colors" dim />
        </Box>
      ) : null}

      {sizeLines.length > 0 ? (
        <Box flexDirection="column">
          <Lines lines={sizeLines} keyPrefix="sizes" dim />
        </Box>
      ) : null}

      {urlLines.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Lines lines={urlLines} keyPrefix="url" dim />
        </Box>
      ) : null}

      <Box marginTop={1}>
        <Text dimColor>esc back · o open · q quit</Text>
      </Box>
    </Box>
  );
}

export default ProductDetail;
