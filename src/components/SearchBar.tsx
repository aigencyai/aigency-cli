/**
 * SearchBar — a command-line-style input plus selectable suggested-query chips.
 *
 * Layout
 * ------
 *   › <text-input: search, type #2 for details, or "compare 1 and 2"…>
 *   try: [Chip One] [Chip Two] [Chip Three] …            (wrapped, max 6)
 *
 * The prompt chevron, the chip brackets, and the focused chip's label all use
 * the brand accent. The focused chip (focusedChipIndex) is rendered bold +
 * accent — the chip-row equivalent of the design-system "selected" state.
 * If `chips` is empty, only the input line renders.
 *
 * PRESENTATIONAL: a pure function of its props. App owns all keyboard handling
 * (Tab cycles `focusedChipIndex`, Enter submits) — there is no useInput, no
 * data fetching, no internal timers or state here.
 */

import React from "react";
import { Box, Text, useStdout } from "ink";
import TextInput from "ink-text-input";
import type { Highlight } from "../types.js";
import { truncate } from "../format.js";

export interface SearchBarProps {
  /** Current input value (controlled). */
  value: string;
  /** Called on every keystroke with the new value. */
  onChange: (value: string) => void;
  /** Called when the user submits (Enter). */
  onSubmit: (value: string) => void;
  /** Suggested-query chips to display beneath the input. */
  chips: Highlight[];
  /** Optional brand accent hex for theming the prompt / chips. */
  brandAccent?: string;
  /**
   * Index of the chip the user has cycled focus to (Tab, owned by App).
   * When >= 0 the matching chip is highlighted (selected-state). Out-of-range
   * or omitted values highlight nothing.
   */
  focusedChipIndex?: number;
  /** Override the input placeholder (defaults to the command-line hint). */
  placeholder?: string;
}

/** Placeholder copy that teaches the command-line affordances. */
const DEFAULT_PLACEHOLDER = 'search, type #2 for details, or "compare 1 and 2"…';

/** Max chips shown — restraint over clutter (this is a showpiece). */
const MAX_CHIPS = 6;

/** Per-chip label cap so a long highlight title can't blow out the row. */
const CHIP_LABEL_MAX = 22;

/** Fallback terminal width when stdout columns are unavailable. */
const FALLBACK_COLUMNS = 80;

export function SearchBar({
  value,
  onChange,
  onSubmit,
  chips,
  brandAccent,
  focusedChipIndex,
  placeholder = DEFAULT_PLACEHOLDER,
}: SearchBarProps): React.ReactElement {
  const { stdout } = useStdout();
  // Width is read so the wrapped chip row honors the real terminal; Ink's
  // flexWrap does the wrapping, but capping the box keeps it from overflowing
  // narrow terminals.
  const columns = stdout?.columns || FALLBACK_COLUMNS;

  const visibleChips = chips.slice(0, MAX_CHIPS);

  return (
    <Box flexDirection="column">
      {/* Command-line input line. */}
      <Box>
        <Text color={brandAccent} bold>
          {"› "}
        </Text>
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder={placeholder}
        />
      </Box>

      {/* Suggested-query chips — only when there are any. */}
      {visibleChips.length > 0 ? (
        <Box flexWrap="wrap" width={columns}>
          <Text dimColor>try: </Text>
          {visibleChips.map((chip, i) => {
            const focused = focusedChipIndex === i;
            const label = truncate(chip.title, CHIP_LABEL_MAX);
            // Stable key: pair the query (stable identity) with index to keep
            // it unique if two highlights share a query string.
            return (
              <Text key={`${chip.query}-${i}`}>
                <Text color={brandAccent} bold={focused}>
                  [
                </Text>
                <Text color={focused ? brandAccent : undefined} bold={focused}>
                  {label}
                </Text>
                <Text color={brandAccent} bold={focused}>
                  ]
                </Text>{" "}
              </Text>
            );
          })}
        </Box>
      ) : null}
    </Box>
  );
}

export default SearchBar;
