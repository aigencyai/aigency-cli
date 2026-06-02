/**
 * TypewriterText — progressively reveals `text` one character at a time.
 *
 * Used to "type out" the conversational answer above the results, giving the
 * TUI a live, assistant-is-talking feel (à la Claude Code). When `text` changes
 * the reveal restarts from the beginning; when it finishes (or the component
 * unmounts) the interval is cleaned up so no timer leaks.
 *
 *   text:  "These aviators ship free."
 *   t=0ms  ›
 *   t=12ms › T
 *   t=24ms › Th
 *   …            (≈ text.length * speed ms to fully reveal)
 *
 * Presentational + one effect; no data fetching, no input handling.
 */

import React, { useEffect, useState } from "react";
import { Text } from "ink";

export interface TypewriterTextProps {
  /** The full text to reveal. */
  text: string;
  /** Milliseconds between revealed characters. Defaults to ~12ms/char. */
  speed?: number;
  /** Optional color for the revealed text. */
  color?: string;
}

/** Default per-character delay — fast enough to feel snappy, slow enough to read. */
const DEFAULT_SPEED_MS = 12;

export function TypewriterText({
  text,
  speed = DEFAULT_SPEED_MS,
  color,
}: TypewriterTextProps): React.ReactElement {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    // Restart the reveal whenever the source text (or cadence) changes.
    setCount(0);

    if (!text) return;

    // Reveal in small chunks so a long answer doesn't trigger hundreds of
    // full-frame redraws — cap total ticks at ~100 regardless of length.
    const step = Math.max(1, Math.ceil(text.length / 100));
    const interval = setInterval(() => {
      setCount((c) => {
        const next = c + step;
        // Stop the timer the moment we've revealed everything.
        if (next >= text.length) clearInterval(interval);
        return Math.min(next, text.length);
      });
    }, Math.max(1, speed));

    return () => clearInterval(interval);
  }, [text, speed]);

  return <Text color={color}>{text.slice(0, count)}</Text>;
}

export default TypewriterText;
