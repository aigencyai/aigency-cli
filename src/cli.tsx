#!/usr/bin/env node
/**
 * Aigency CLI entrypoint.
 *
 * Usage:
 *   aigency                        → cold-open intro, then the store picker
 *   aigency <brand-key>            → straight into a store's landing
 *   aigency <brand-key> <query…>   → a store with an initial search
 *
 * Examples:
 *   aigency
 *   aigency ray-ban
 *   aigency warby-parker round tortoise glasses
 *
 * The app runs in the terminal's ALTERNATE SCREEN BUFFER (like vim / less):
 * it gets a clean full screen, renders in place (no scroll-back spam), and
 * restores the original screen untouched on exit. Set AIGENCY_NO_INTRO=1 to
 * skip the cold-open.
 */

import React from "react";
import { render } from "ink";
import App from "./components/App.js";

/** Alternate-screen-buffer enter/leave (DECSET 1049). */
const ENTER_ALT_SCREEN = "\x1b[?1049h";
const LEAVE_ALT_SCREEN = "\x1b[?1049l";

/** Parse argv into { initialBrand, initialQuery }. */
function parseArgs(argv: string[]): {
  initialBrand?: string;
  initialQuery?: string;
} {
  // Drop `node` and the script path.
  const args = argv.slice(2);
  if (args.length === 0) return {};
  const [brand, ...rest] = args;
  const query = rest.join(" ").trim();
  return {
    initialBrand: brand,
    initialQuery: query.length > 0 ? query : undefined,
  };
}

function main(): void {
  const { initialBrand, initialQuery } = parseArgs(process.argv);

  // aigency is an interactive, raw-mode TUI — it needs a real TTY. In a non-TTY
  // context (piped, redirected, CI) Ink's raw mode can't engage, so rather than
  // crash mid-render or hang forever waiting for input that can't arrive, exit
  // cleanly with a hint. Tests render via ink-testing-library, bypassing this.
  if (!process.stdin.isTTY) {
    console.error(
      "aigency is an interactive terminal app — run it directly in your terminal.",
    );
    process.exit(1);
  }

  // Enter the alternate screen buffer and guarantee we leave it on EVERY exit
  // path (normal, Ctrl+C, signals, uncaught error). Writing it once before
  // render — never mid-frame — keeps Ink's frame tracking intact.
  const useAltScreen = Boolean(process.stdout.isTTY);
  let restored = false;
  const leaveAltScreen = (): void => {
    if (restored || !useAltScreen) return;
    restored = true;
    try {
      process.stdout.write(LEAVE_ALT_SCREEN);
    } catch {
      /* stream already torn down — nothing to restore */
    }
  };
  if (useAltScreen) {
    process.stdout.write(ENTER_ALT_SCREEN);
    process.once("exit", leaveAltScreen);
    // Signals don't run 'exit' handlers on their own — restore then re-exit.
    for (const sig of ["SIGTERM", "SIGHUP"] as const) {
      process.once(sig, () => {
        leaveAltScreen();
        process.exit(0);
      });
    }
  }

  const { waitUntilExit } = render(
    <App initialBrand={initialBrand} initialQuery={initialQuery} />,
    { exitOnCtrlC: true },
  );

  // Surface clean exit on Ctrl+C and avoid an unhandled-rejection crash.
  waitUntilExit()
    .then(() => {
      leaveAltScreen();
      process.exit(0);
    })
    .catch(() => {
      leaveAltScreen();
      process.exit(1);
    });
}

main();
