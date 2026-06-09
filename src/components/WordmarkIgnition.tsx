/**
 * WordmarkIgnition — the cold-open. A self-aware little flex: we built a
 * shopping mall in a terminal, so of course the wordmark *ignites* out of a
 * burst of braille sparks before it lets you in.
 *
 * Three phases, gated so the funny tagline can't be missed:
 *
 *   IGNITING  embers bloom → "aigency" lights L→R → glow + underline → tagline
 *             types. Plays automatically (~2s). A keypress fast-forwards to the
 *             fully-revealed welcome (so an impatient masher still SEES it).
 *   READY     holds the finished wordmark + tagline + a pulsing
 *             "press any key to enter ›". Waits — no auto-advance. This is the
 *             whole point: the welcome screen stays up until you choose to leave.
 *   ENTERING  a keypress kicks off the exit — the wordmark spreads its letter-
 *             spacing wider and wider while fading, like the camera pushing
 *             through it into the store. Then onDone() → the picker.
 *
 *        ⠁   ⢀    ⠠       ⡀     ⠂      (igniting)
 *            a i g e n c y          ← ignites L→R, accent + bold
 *            ─────────────          ← pulsing underline (glow phase)
 *        online shopping was fine. we fixed it anyway.
 *            press any key to enter ›   (ready — pulses)
 *
 *            a     i     g     e     n     c     y   (entering — spreads + fades)
 *
 * Drive model: App owns keyboard input and bumps `advanceSignal` on each intro
 * keypress; this component interprets that signal by phase (reveal / enter /
 * skip). Every frame is still a PURE function of its counter (sparks via a cheap
 * positional hash), so a single frame renders statically for previews/tests via
 * `previewFrame` (igniting) or `previewPhase` (ready / entering).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text, useStdout } from "ink";

/** The lifecycle of the cold-open. */
export type IntroPhase = "igniting" | "ready" | "entering";

export interface WordmarkIgnitionProps {
  /** Brand/neutral accent the wordmark + embers are tinted with. */
  accent: string;
  /** Called once when the ENTERING animation finishes (hand off to the picker). */
  onDone: () => void;
  /**
   * Monotonic counter; increment it once per intro keypress. The component
   * interprets each bump by its current phase: igniting → reveal (ready),
   * ready → entering, entering → skip straight to done.
   */
  advanceSignal?: number;
  /**
   * Render a single IGNITING frame statically and do NOT start any timer. For
   * the preview harness and unit tests; unused in the live app.
   */
  previewFrame?: number;
  /**
   * Force a phase for a static render (preview/tests). With "ready" or
   * "entering" no timers run and no phase transitions happen.
   */
  previewPhase?: IntroPhase;
  /** Entering-animation frame to freeze on when previewPhase === "entering". */
  previewEnterFrame?: number;
  /**
   * Whether the terminal can deliver keypresses (raw mode). When false there's
   * no way to pass the "press any key" gate, so the ignition plays once and
   * hands off automatically instead of stranding on READY forever. Default true.
   */
  interactive?: boolean;
}

/** Frame cadence — ~22fps reads as lively without thrashing the renderer. */
const FRAME_MS = 45;
/** Pulse cadence for the "press any key" prompt while we hold on READY. */
const PULSE_MS = 450;

/** The wordmark, laid out letter-spaced. */
const LETTERS = ["a", "i", "g", "e", "n", "c", "y"];
const WORD_W = LETTERS.length * 2 - 1; // "a i g e n c y" → 13 cols
const TAGLINE = "online shopping was fine. we fixed it anyway.";
const PROMPT = "press any key to enter ›";

/** Ignition keyframes. */
const IGNITE_START = 9;
const IGNITE_STEP = 2; // last letter (i=6) lights at frame 21
const GLOW_START = 22;
const GLOW_END = 28;
const TAGLINE_START = 29;
const TAGLINE_FRAMES = 14;
/** Frame at which ignition completes and we HOLD on the welcome (was the old end). */
const READY_AT = TAGLINE_START + TAGLINE_FRAMES + 2; // 45

/** Entering (warp/zoom-through) keyframes. */
const ENTER_FRAMES = 12; // ~0.55s
/** Widest inter-letter gap the spread reaches (clamped to fit the terminal). */
const ENTER_MAX_GAP = 7;

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

/**
 * The lit wordmark with a given inter-letter gap, used by the READY hold and
 * the ENTERING spread. `bold`/`dim` model the warp's fade.
 */
function litWordmark(
  accent: string,
  gap: number,
  bold: boolean,
  dim: boolean,
): React.ReactNode[] {
  const sep = " ".repeat(Math.max(1, gap));
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < LETTERS.length; i++) {
    nodes.push(
      <Text key={`l${i}`} color={accent} bold={bold} dimColor={dim}>
        {LETTERS[i]}
      </Text>,
    );
    if (i < LETTERS.length - 1) nodes.push(<Text key={`s${i}`}>{sep}</Text>);
  }
  return nodes;
}

/** Visible width of the wordmark for a given gap. */
function wordWidth(gap: number): number {
  return LETTERS.length + (LETTERS.length - 1) * Math.max(1, gap);
}

/**
 * Where a single keypress moves the cold-open, and whether it hands off to the
 * picker. Pure so the phase machine is unit-testable in isolation:
 *   igniting → ready    (reveal the full welcome; do NOT leave yet)
 *   ready    → entering (begin the warp)
 *   entering → entering + done (a key mid-warp skips straight to the picker)
 */
export function advanceIntro(phase: IntroPhase): {
  phase: IntroPhase;
  done: boolean;
} {
  if (phase === "igniting") return { phase: "ready", done: false };
  if (phase === "ready") return { phase: "entering", done: false };
  return { phase: "entering", done: true };
}

export function WordmarkIgnition({
  accent,
  onDone,
  advanceSignal = 0,
  previewFrame,
  previewPhase,
  previewEnterFrame,
  interactive = true,
}: WordmarkIgnitionProps): React.ReactElement {
  // Static render (preview harness / tests): freeze a frame, run no timers.
  const isStatic = previewFrame !== undefined || previewPhase !== undefined;

  const [frame, setFrame] = useState<number>(previewFrame ?? 0);
  const [enterFrame, setEnterFrame] = useState<number>(previewEnterFrame ?? 0);
  const [phase, setPhase] = useState<IntroPhase>(previewPhase ?? "igniting");
  const [pulseOn, setPulseOn] = useState<boolean>(true);

  const { stdout } = useStdout();
  // Clamp the canvas to the terminal so rows never wrap on a narrow window.
  const cols = stdout?.columns && stdout.columns > 0 ? stdout.columns : CANVAS_W;
  const width = Math.min(CANVAS_W, Math.max(WORD_W, cols - 2));

  // ── Phase machine ────────────────────────────────────────────────────────
  // onDone fires exactly once, whether by the entering timer or a skip.
  const doneRef = useRef(false);
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  // Mirror phase into a ref so the advance handler reads the CURRENT phase
  // (its closure would otherwise see a stale value).
  const phaseRef = useRef<IntroPhase>(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // IGNITING: tick the ignition frame up to READY_AT.
  useEffect(() => {
    if (isStatic || phase !== "igniting") return;
    const id = setInterval(() => {
      setFrame((f) => (f >= READY_AT ? f : f + 1));
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [isStatic, phase]);

  // Ignition complete → hold on READY for a keypress. But if the terminal can't
  // deliver keys, there's no way past the gate, so hand off instead of hanging.
  useEffect(() => {
    if (isStatic || phase !== "igniting" || frame < READY_AT) return;
    if (interactive) setPhase("ready");
    else finish();
  }, [isStatic, phase, frame, interactive, finish]);

  // READY: gently pulse the "press any key" prompt.
  useEffect(() => {
    if (isStatic || phase !== "ready") return;
    const id = setInterval(() => setPulseOn((p) => !p), PULSE_MS);
    return () => clearInterval(id);
  }, [isStatic, phase]);

  // ENTERING: tick the warp frames, then hand off.
  useEffect(() => {
    if (isStatic || phase !== "entering") return;
    const id = setInterval(() => {
      setEnterFrame((e) => {
        if (e >= ENTER_FRAMES) {
          clearInterval(id);
          finish();
          return e;
        }
        return e + 1;
      });
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [isStatic, phase, finish]);

  // Keypress (App bumps advanceSignal): interpret by current phase.
  const lastSignal = useRef<number>(advanceSignal);
  useEffect(() => {
    if (isStatic) return;
    if (advanceSignal === lastSignal.current) return; // initial mount / no change
    lastSignal.current = advanceSignal;
    const p = phaseRef.current;
    const { phase: next, done } = advanceIntro(p);
    if (p === "igniting") setFrame(READY_AT); // reveal the complete welcome
    if (p === "ready") setEnterFrame(0); // (re)start the warp counter
    if (next !== p) setPhase(next);
    if (done) finish(); // a key mid-warp skips straight to the picker
  }, [advanceSignal, isStatic, finish]);

  // ── Derived render state ───────────────────────────────────────────────────
  const inGlow = frame >= GLOW_START && frame <= GLOW_END;
  const allLit = frame >= igniteAt(LETTERS.length - 1);

  // ── ENTERING render (warp / zoom-through) ──────────────────────────────────
  if (phase === "entering") {
    const t = ENTER_FRAMES > 0 ? Math.min(1, enterFrame / ENTER_FRAMES) : 1;
    // Spread the letters apart, clamped so the row can't wrap on this terminal.
    const fitGap = Math.max(
      1,
      Math.floor((width - LETTERS.length) / (LETTERS.length - 1)),
    );
    const targetGap = Math.min(ENTER_MAX_GAP, fitGap);
    const gap = 1 + Math.round(t * (targetGap - 1));
    const lead = Math.max(0, Math.floor((width - wordWidth(gap)) / 2));
    // Fade: bold → normal → dim across the warp.
    const bold = t < 0.34;
    const dim = t >= 0.67;
    return (
      <Box
        width="100%"
        height="100%"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
      >
        <Box flexDirection="column">
          {/* Blank ember band keeps the wordmark vertically anchored. */}
          {Array.from({ length: ROWS_ABOVE }, (_, r) => (
            <Text key={`a${r}`}>{" ".repeat(width)}</Text>
          ))}
          <Text>
            {" ".repeat(lead)}
            {litWordmark(accent, gap, bold, dim)}
          </Text>
          {/* Underline + tagline fade out early in the warp; prompt is gone. */}
          <Text> </Text>
          {Array.from({ length: ROWS_BELOW }, (_, r) => (
            <Text key={`b${r}`}>{" ".repeat(width)}</Text>
          ))}
          <Box marginTop={1} justifyContent="center" width={width}>
            <Text dimColor>{t < 0.5 ? TAGLINE : ""}</Text>
          </Box>
          <Box justifyContent="center" width={width}>
            <Text> </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // ── READY render (hold the finished welcome) ───────────────────────────────
  if (phase === "ready") {
    const lead = Math.max(0, Math.floor((width - WORD_W) / 2));
    return (
      <Box
        width="100%"
        height="100%"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
      >
        <Box flexDirection="column">
          {Array.from({ length: ROWS_ABOVE }, (_, r) => (
            <Text key={`a${r}`}>{" ".repeat(width)}</Text>
          ))}
          <Text>
            {" ".repeat(lead)}
            {litWordmark(accent, 1, true, false)}
          </Text>
          <Text color={accent}>
            {" ".repeat(lead)}
            {"─".repeat(WORD_W)}
          </Text>
          {Array.from({ length: ROWS_BELOW }, (_, r) => (
            <Text key={`b${r}`}>{" ".repeat(width)}</Text>
          ))}
          <Box marginTop={1} justifyContent="center" width={width}>
            <Text dimColor>{TAGLINE}</Text>
          </Box>
          <Box justifyContent="center" width={width}>
            <Text color={accent} dimColor={!pulseOn}>
              {PROMPT}
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // ── IGNITING render (default; also the static previewFrame path) ────────────
  const lead = Math.max(0, Math.floor((width - WORD_W) / 2));

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
        {/* Reserve the prompt line so the wordmark doesn't jump on READY. */}
        <Box justifyContent="center" width={width}>
          <Text> </Text>
        </Box>
      </Box>
    </Box>
  );
}

export default WordmarkIgnition;
