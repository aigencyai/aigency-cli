/**
 * BrandPicker — the launch screen.
 *
 * A tasteful, width-responsive grid of all available brands. Each brand is
 * shown as its 1-based number plus its name rendered in that brand's OWN
 * accent color (luminance-adjusted via readableAccent so dark brand colors
 * stay legible on a dark terminal). The currently-highlighted brand (when
 * `selectedKey` matches) gets the design-system "selected" treatment: a
 * left-bar glyph (U+258C) in the accent, bold + accent text. Unselected cells
 * get two leading spaces so alignment is identical selected vs. not.
 *
 * Layout
 * ------
 *   ┌ title (dim) ─────────────────────────────────────────────┐
 *   │  1 Brooklinen      2 Away          3 Warby Parker  4 IKEA  │
 *   │  5 Ray-Ban         6 Allbirds      7 Alo Yoga      8 …     │  ← columns
 *   │  …                                                         │    from width
 *   └ footer hint (dim) ───────────────────────────────────────┘
 *
 * Columns (1–4) come from the shared columnsForPicker() so App's up/down arrow
 * stride moves exactly one visual row. Very narrow terminals collapse to a
 * single readable column. Cells are laid out row-major.
 *
 * PRESENTATIONAL ONLY: a pure function of its props. App owns all keyboard
 * handling and selection state, and passes `selectedKey` down.
 */

import React from "react";
import { Box, Text, useStdout } from "ink";
import type { BrandInfo } from "../types.js";
import { truncate } from "../format.js";
import { columnsForPicker, readableAccent } from "../layout.js";

export interface BrandPickerProps {
  /** Brands available for selection. */
  brands: BrandInfo[];
  /** Called when the user selects a brand. (App wires the keyboard.) */
  onSelect: (brand: BrandInfo) => void;
  /**
   * Optional key of the currently-highlighted brand. When it matches a
   * brand's `key`, that cell renders in the selected state. Presentational
   * only — App owns the selection and passes it in.
   */
  selectedKey?: string;
}

/** Fallback terminal width when stdout reports nothing usable. */
const FALLBACK_WIDTH = 80;
/** Left-bar glyph for the selected cell (matches the rest of the TUI). */
const BAR = "▌"; // ▌
/** Horizontal gap (in cells) between columns. */
const COL_GAP = 2;

export function BrandPicker({
  brands,
  selectedKey,
}: BrandPickerProps): React.ReactElement {
  const { stdout } = useStdout();
  const width =
    stdout && typeof stdout.columns === "number" && stdout.columns > 0
      ? stdout.columns
      : FALLBACK_WIDTH;

  if (brands.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>pick a store</Text>
        <Box marginTop={1}>
          <Text dimColor>no stores available · q quit</Text>
        </Box>
      </Box>
    );
  }

  // Divide the usable width (terminal minus the App's outer paddingX={1}) across
  // the columns and the gaps between them. Each cell carries a 2-char fixed
  // prefix (bar/spaces) + a 2-char right-aligned number + a single space.
  const columns = columnsForPicker(width);
  const usable = Math.max(columns, width - 4);
  const cellWidth = Math.floor((usable - COL_GAP * (columns - 1)) / columns);
  const nameWidth = Math.max(6, cellWidth - 5);

  // Build row-major rows so reading order matches the 1..N numbering.
  const rows: BrandInfo[][] = [];
  for (let i = 0; i < brands.length; i += columns) {
    rows.push(brands.slice(i, i + columns));
  }

  return (
    <Box flexDirection="column">
      <Text dimColor>pick a store · {brands.length} open</Text>

      <Box flexDirection="column" marginTop={1}>
        {rows.map((row, rowIdx) => (
          <Box key={`row-${row[0]?.key ?? rowIdx}`} flexDirection="row">
            {row.map((b, colIdx) => {
              // Stable, original index for the human-facing number.
              const index = rowIdx * columns + colIdx;
              const selected =
                selectedKey !== undefined && b.key === selectedKey;
              const number = String(index + 1).padStart(2, " ");
              const name = truncate(b.name, nameWidth);
              const color = readableAccent(b.accent);
              return (
                <Box
                  key={b.key}
                  width={cellWidth + (colIdx < row.length - 1 ? COL_GAP : 0)}
                >
                  <Text>
                    {selected ? (
                      <Text color={color}>{BAR} </Text>
                    ) : (
                      <Text>{"  "}</Text>
                    )}
                    <Text dimColor>{number}</Text>{" "}
                    <Text color={color} bold={selected}>
                      {name}
                    </Text>
                  </Text>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>arrows move · 1-9 jump · enter shop · q quit</Text>
      </Box>
    </Box>
  );
}

export default BrandPicker;
