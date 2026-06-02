/**
 * StatusBar — a single-line footer summarizing context + a contextual hint.
 *
 *   Ray-Ban  ·  3 results  ·  214ms        ↑↓ select · enter open · esc back
 *   └──────── status (accent, dim) ───────┘ └────────── hint (dim) ──────────┘
 *
 * The status segment (brand · count · duration) is tinted with the (already
 * readability-adjusted) brand accent passed by App; the hint is plain dim.
 *
 * The line is WIDTH-BUDGETED so it never wraps into a ragged two-liner: status
 * gets up to ~45% of the terminal width (truncated), the hint takes the rest,
 * right-aligned and truncated. Every field is optional so the bar renders
 * cleanly in every view.
 *
 * Presentational: a pure function of its props.
 */

import React from "react";
import { Box, Text, useStdout } from "ink";
import type { BrandInfo } from "../types.js";

export interface StatusBarProps {
  /** Current brand, when one is selected. */
  brand?: BrandInfo;
  /** Number of results currently shown. */
  count?: number;
  /** Last search duration in milliseconds. */
  durationMs?: number;
  /** Contextual hint (keybindings for the current view). */
  hint?: string;
  /** Pre-resolved (readable) accent for the status tint. */
  accent?: string;
}

/** Fallback terminal width when stdout reports nothing usable. */
const FALLBACK_WIDTH = 80;

export function StatusBar({
  brand,
  count,
  durationMs,
  hint,
  accent,
}: StatusBarProps): React.ReactElement {
  const { stdout } = useStdout();
  const width =
    stdout?.columns && stdout.columns > 0 ? stdout.columns : FALLBACK_WIDTH;

  const parts: string[] = [];
  if (brand) parts.push(brand.name);
  if (typeof count === "number") {
    parts.push(`${count} ${count === 1 ? "result" : "results"}`);
  }
  if (typeof durationMs === "number") parts.push(`${durationMs}ms`);
  const status = parts.join("  ·  ");

  // Budget the line so status + hint always share ONE row.
  const statusWidth = Math.max(8, Math.floor(width * 0.45));

  return (
    <Box marginTop={1} width={width}>
      <Box width={statusWidth}>
        <Text color={accent} dimColor wrap="truncate">
          {status}
        </Text>
      </Box>
      <Box flexGrow={1} justifyContent="flex-end">
        {hint ? (
          <Text dimColor wrap="truncate">
            {hint}
          </Text>
        ) : null}
      </Box>
    </Box>
  );
}

export default StatusBar;
