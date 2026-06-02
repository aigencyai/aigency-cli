/**
 * Wordmark — the small, tasteful header at the very top of the app.
 *
 *   aigency · online shopping was fine. we fixed it anyway.
 *
 * The wordmark itself is lowercase, bold, and tinted with the active accent
 * (the brand's color once one is picked, a neutral cyan beforehand). The
 * tagline is dim so it reads as a quiet aside, not a banner. A single clean
 * line keeps the chrome out of the way of the actual shopping.
 *
 * Presentational: a pure function of its one optional prop.
 */

import React from "react";
import { Box, Text } from "ink";

export interface WordmarkProps {
  /** Accent hex for the wordmark. Falls back to a neutral cyan. */
  accent?: string;
}

/** Neutral cyan used before a brand is chosen — matches brands.ts FALLBACK. */
const DEFAULT_ACCENT = "#7dd3fc";

/** The dim, faintly self-aware tagline. */
const TAGLINE = "online shopping was fine. we fixed it anyway.";

export function Wordmark({ accent }: WordmarkProps): React.ReactElement {
  return (
    <Box>
      <Text bold color={accent ?? DEFAULT_ACCENT}>
        aigency
      </Text>
      <Text dimColor>{"  ·  "}{TAGLINE}</Text>
    </Box>
  );
}

export default Wordmark;
