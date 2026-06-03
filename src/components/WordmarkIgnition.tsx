/**
 * WordmarkIgnition — the cold-open. A self-aware little flex: we built a
 * shopping mall in a terminal, so of course the wordmark *ignites* out of a
 * burst of braille sparks before it lets you in.
 *
 *   frames 0–8     a field of braille embers blooms around the center
 *   frames 9–21    "aigency" ignites letter-by-letter, left → right
 *   frames 22–28   full wordmark at peak glow + a pulsing accent underline
 *   frames 29–43   the tagline types out beneath it
 *   frame  45      onDone() — hand off to the picker
 *
 *        ⠁   ⢀    ⠠       ⡀     ⠂
 *      ⠄                         ⢀
 *            a i g e n c y          ← ignites L→R, accent + bold
 *            ─────────────          ← pulsing underline (glow phase)
 *      ⡀          ⠐        ⠈     ⠠
 *        online shopping was fine.
 *             we fixed it anyway.
 *
 * Every frame is a PURE function of the frame counter (sparks included, via a
 * cheap positional hash) so re-renders are stable and a single frame can be
 * rendered statically for previews/tests via `previewFrame`. Skippable: App
 * routes any keypress in the intro view to the same onDone().
 */

import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useStdout } from "ink";

export interface WordmarkIgnitionProps {
  /** Brand/neutral accent the wordmark + embers are tinted with. */
  accent: string;
  /** Called once when the animation finishes (or is rendered past its end). */
  onDone: () => void;
  /**
   * Render this exact frame statically and do NOT start the timer. For the
   * preview harness and unit tests; unused in the live app.
   */
  previewFrame?: number;
}

/** Frame cadence — ~22fps reads as lively without thrashing the renderer. */
const FRAME_MS = 45;

/** The wordmark, laid out letter-spaced. */
const LETTERS = ["a", "i", "g", "e", "n", "c", "y"];
const WORD_W = LETTERS.length * 2 - 1; // "a i g e n c y" → 13 cols
const TAGLINE = "online shopping was fine. we fixed it anyway.";

/** Animation keyframes. */
const IGNITE_START = 9;
const IGNITE_STEP = 2; // last letter (i=6) lights at frame 21
const GLOW_START = 22;
const GLOW_END = 28;
const TAGLINE_START = 29;
const TAGLINE_FRAMES = 14;
const END_FRAME = TAGLINE_START + TAGLINE_FRAMES + 2; // 45

/** Max width of the art canvas; clamped to the terminal at render time. */
const CANVAS_W = 46;
/** Ember rows above / below the wordmark. */
const ROWS_ABOVE = 2;
const ROWS_BELOW = 2;

/** Faint braille embers, picked per-cell by hash. */
const EMBERS = ["⠁", "⠂", "⠄", "⡀", "⢀", "⠠", "⠐", "⠈", "⠒", "⠉", "⢂", "⡠"];

/** Cheap, stable positional hash — same (a,b,c) always yields the same value. */
function hash(a: number, b: number, c: number): number {
  let h = (a * 92821) ^ (b * 68917) ^ (c * 53987);
  h = (h ^ (h >>> 13)) >>> 0;
  return h;
}

/** Ember density (% of cells lit) for a frame: blooms by ~f6, gone by ~f26. */
function densityPct(frame: number): number {
  if (frame <= 6) return frame * 8; // 0 → 48
  if (frame <= 26) return Math.max(0, 50 - (50 * (frame - 6)) / 20); // 50 → 0
  return 0;
}

/** Frame at which letter `i` ignites. */
function igniteAt(i: number): number {
  return IGNITE_START + i * IGNITE_STEP;
}

/** Build one ember row (exactly `width` chars) for a frame. */
function emberRow(row: number, frame: number, width: number): string {
  const density = densityPct(frame);
  if (density <= 0) return " ".repeat(width);
  let out = "";
  for (let col = 0; col < width; col++) {
    const h = hash(row + 100, col, frame);
    if (h % 100 < density) {
      out += EMBERS[(h >>> 7) % EMBERS.length];
    } else {
      out += " ";
    }
  }
  return out;
}

export function WordmarkIgnition({
  accent,
  onDone,
  previewFrame,
}: WordmarkIgnitionProps): React.ReactElement {
  const [frame, setFrame] = useState<number>(previewFrame ?? 0);
  const doneRef = useRef(false);
  const { stdout } = useStdout();
  // Clamp the canvas to the terminal so the ember rows never wrap on a narrow
  // window (the rows are fixed-width strings rendered verbatim).
  const cols = stdout?.columns && stdout.columns > 0 ? stdout.columns : CANVAS_W;

  useEffect(() => {
    if (previewFrame !== undefined) return; // static render, no timer
    const id = setInterval(() => {
      setFrame((f) => {
        if (f >= END_FRAME) {
          clearInterval(id);
          if (!doneRef.current) {
            doneRef.current = true;
            onDone();
          }
          return f;
        }
        return f + 1;
      });
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [onDone, previewFrame]);

  const width = Math.min(CANVAS_W, Math.max(WORD_W, cols - 2));
  const lead = Math.max(0, Math.floor((width - WORD_W) / 2));
  const inGlow = frame >= GLOW_START && frame <= GLOW_END;
  const allLit = frame >= igniteAt(LETTERS.length - 1);

  // Wordmark row: padding + per-letter span (lit accent/bold, else a flicker).
  const wordmark: React.ReactNode[] = [];
  for (let i = 0; i < LETTERS.length; i++) {
    const lit = frame >= igniteAt(i);
    const justLit = frame === igniteAt(i) || frame === igniteAt(i) + 1;
    if (lit) {
      wordmark.push(
        <Text key={`l${i}`} color={accent} bold={inGlow || justLit}>
          {LETTERS[i]}
        </Text>,
      );
    } else {
      // Not yet ignited — a flickering ember stands in for the letter.
      const g = EMBERS[hash(i, frame, 9) % EMBERS.length];
      wordmark.push(
        <Text key={`l${i}`} color={accent} dimColor>
          {g}
        </Text>,
      );
    }
    if (i < LETTERS.length - 1) wordmark.push(<Text key={`s${i}`}> </Text>);
  }

  // Underline pulse, only during/after the glow; parity gives a soft fl<->bright.
  const showRule = frame >= GLOW_START && frame <= GLOW_END + 6;
  const ruleDim = frame % 2 === 0;

  // Tagline types out across TAGLINE_FRAMES.
  const typed =
    frame < TAGLINE_START
      ? 0
      : Math.min(
          TAGLINE.length,
          Math.round(
            ((frame - TAGLINE_START) / TAGLINE_FRAMES) * TAGLINE.length,
          ),
        );

  const aboveRows = Array.from({ length: ROWS_ABOVE }, (_, r) =>
    emberRow(r, frame, width),
  );
  const belowRows = Array.from({ length: ROWS_BELOW }, (_, r) =>
    emberRow(r + 50, frame, width),
  );

  return (
    <Box
      width="100%"
      height="100%"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
    >
      <Box flexDirection="column">
        {aboveRows.map((line, r) => (
          <Text key={`a${r}`} color={accent} dimColor>
            {line}
          </Text>
        ))}

        <Text>
          {" ".repeat(lead)}
          {wordmark}
        </Text>

        <Text color={accent} dimColor={ruleDim}>
          {" ".repeat(lead)}
          {showRule ? "─".repeat(WORD_W) : " ".repeat(WORD_W)}
        </Text>

        {belowRows.map((line, r) => (
          <Text key={`b${r}`} color={accent} dimColor>
            {line}
          </Text>
        ))}

        <Box marginTop={1} justifyContent="center" width={width}>
          <Text dimColor>{allLit ? TAGLINE.slice(0, typed) : ""}</Text>
        </Box>
      </Box>
    </Box>
  );
}

export default WordmarkIgnition;
