/**
 * StoreLanding — the first screen inside a store, mirroring the web agent's
 * landing: a brand marquee, a row of up to four HIGHLIGHT TILES rendered as
 * braille "images", and (rendered by App, just below) the search field.
 *
 * No search runs on entry — the landing invites a choice instead of dumping a
 * "best sellers" result. Pick a tile (1–4 / arrows+enter) or just type.
 *
 *   RAY-BAN
 *   pick a highlight or search anything
 *
 *   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
 *   │ ⠀⡀⣤⣶⣿⣶⣤⡀   │ │ ⣀⣤⣤⣤⣤⣄⡀    │ │  (no image)  │ │ ⠰⣿⣿⠟⠛⢿⢦    │
 *   │ ⠰⣿⠟⠉⠛⢿⢦    │ │ ⢾⣿⣿⣿⣿⣿⢷⡀   │ │   ⠐⠂⠠⠄⠂⠠   │ │ ⠈⠛⢿⠟⠈⢻⛛    │
 *   │ ▌ Sunglasses │ │   Eyeglasses │ │   Cases      │ │   Lenses     │
 *   │ [1]          │ │ [2]          │ │ [3]          │ │ [4]          │
 *   └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
 *
 * PRESENTATIONAL: a pure function of its props. App owns tile focus + keys.
 */

import React from "react";
import { Box, Text, useStdout } from "ink";
import type { BrandInfo, Highlight } from "../types.js";
import { stripAnsi, truncate } from "../format.js";

/** Max tiles shown — matches the web's four-up highlight strip. */
export const MAX_TILES = 4;

/** Fallback terminal width when stdout reports nothing usable. */
const FALLBACK_WIDTH = 80;
/** Horizontal gap between tiles. */
const GUTTER = 1;
/** Border (2) + paddingX 1 each side (2) consumed by a round tile box. */
const TILE_CHROME = 4;
/** Min/max total tile box width. */
const MIN_TILE = 16;
const MAX_TILE = 30;
/** Braille rows reserved in each tile (matches server DEFAULT_ROWS = 3). */
const THUMB_ROWS = 3;
/** Left-bar glyph marking the focused tile (matches the rest of the TUI). */
const LEFT_BAR = "▌";

export interface StoreLandingProps {
  /** The active brand (for the marquee). */
  brand?: BrandInfo;
  /** Highlights to surface as tiles (first {@link MAX_TILES} are shown). */
  highlights: Highlight[];
  /** Index of the focused tile (App owns this; -1/out-of-range = none). */
  tileIndex: number;
  /** Brand accent hex for the marquee, borders, and braille tint. */
  accent: string;
  /** True while highlights are still loading (shows a quiet placeholder). */
  loading?: boolean;
}

/** How many tiles fit per row at this width (1, 2, or up to `count`). */
function tilesPerRow(width: number, count: number): number {
  if (width >= count * (MIN_TILE + GUTTER)) return count;
  if (width >= 2 * (MIN_TILE + GUTTER)) return 2;
  return 1;
}

/** A faint dotted stand-in for a tile with no braille image. */
function placeholderRow(innerWidth: number): string {
  const pattern = "⠐⠂⠠⠄";
  let s = "";
  while (s.length < innerWidth) s += pattern;
  return s.slice(0, innerWidth);
}

/** Center `s` within `width` cols (used to center braille inside a wide tile). */
function center(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  const lead = Math.floor((width - s.length) / 2);
  return " ".repeat(lead) + s;
}

/** A single highlight tile. */
function Tile({
  item,
  number,
  focused,
  accent,
  innerWidth,
  tileWidth,
}: {
  item: Highlight;
  number: number;
  focused: boolean;
  accent: string;
  innerWidth: number;
  tileWidth: number;
}): React.ReactElement {
  const thumb = Array.isArray(item.thumbnail) ? item.thumbnail : [];
  const hasThumb = thumb.length > 0;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={focused ? accent : undefined}
      borderDimColor={!focused}
      paddingX={1}
      width={tileWidth}
    >
      {/* Braille "image" (or a faint placeholder), reserved to THUMB_ROWS so
          every tile in a row aligns to the same height. */}
      <Box flexDirection="column">
        {Array.from({ length: THUMB_ROWS }, (_, r) => {
          const line = hasThumb
            ? center(stripAnsi(thumb[r] ?? ""), innerWidth)
            : placeholderRow(innerWidth);
          return (
            <Text
              key={r}
              color={accent}
              dimColor={!hasThumb}
              wrap="truncate"
            >
              {line || " "}
            </Text>
          );
        })}
      </Box>

      {/* Title — left bar + accent/bold when focused. */}
      <Text color={focused ? accent : undefined} bold={focused} wrap="truncate">
        {focused ? `${LEFT_BAR} ` : "  "}
        {truncate(item.title, Math.max(1, innerWidth - 2))}
      </Text>

      {/* Quick-jump number. */}
      <Text dimColor wrap="truncate">
        {"  "}[{number}]
      </Text>
    </Box>
  );
}

export function StoreLanding({
  brand,
  highlights,
  tileIndex,
  accent,
  loading,
}: StoreLandingProps): React.ReactElement {
  const { stdout } = useStdout();
  const width =
    stdout?.columns && stdout.columns > 0 ? stdout.columns : FALLBACK_WIDTH;

  const tiles = highlights.slice(0, MAX_TILES);
  const brandName = brand?.name ?? "this store";

  // Marquee header — always shown.
  const marquee = (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={accent} bold>
        {brandName}
      </Text>
      <Text dimColor>
        {tiles.length > 0
          ? "pick a highlight or search anything"
          : loading
            ? "loading highlights…"
            : "search anything below to start"}
      </Text>
    </Box>
  );

  if (tiles.length === 0) {
    // No highlights (empty store, or still loading) — just the marquee; the
    // search field below is the call to action.
    return <Box flexDirection="column">{marquee}</Box>;
  }

  const perRow = tilesPerRow(width, tiles.length);
  const usable = Math.max(perRow * MIN_TILE, width);
  const tileWidth = Math.min(
    MAX_TILE,
    Math.max(MIN_TILE, Math.floor((usable - (perRow - 1) * GUTTER) / perRow)),
  );
  const innerWidth = Math.max(1, tileWidth - TILE_CHROME);

  // Pack tiles into rows of `perRow`.
  const rows: Highlight[][] = [];
  for (let i = 0; i < tiles.length; i += perRow) {
    rows.push(tiles.slice(i, i + perRow));
  }

  return (
    <Box flexDirection="column">
      {marquee}
      {rows.map((row, rowIdx) => (
        <Box key={`trow-${rowIdx}`} flexDirection="row" marginBottom={0}>
          {row.map((item, colIdx) => {
            const index = rowIdx * perRow + colIdx;
            return (
              <Box
                key={`${item.query}-${index}`}
                marginRight={colIdx < row.length - 1 ? GUTTER : 0}
              >
                <Tile
                  item={item}
                  number={index + 1}
                  focused={index === tileIndex}
                  accent={accent}
                  innerWidth={innerWidth}
                  tileWidth={tileWidth}
                />
              </Box>
            );
          })}
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>
          1-{tiles.length} jump · ↑↓ move · enter open · or type below ↓
        </Text>
      </Box>
    </Box>
  );
}

export default StoreLanding;
