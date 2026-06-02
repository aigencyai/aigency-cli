#!/usr/bin/env node
/**
 * Aigency CLI entrypoint.
 *
 * Usage:
 *   aigency                        → launch the brand picker
 *   aigency <brand-key>            → launch straight into a brand
 *   aigency <brand-key> <query…>   → launch a brand with an initial query
 *
 * Examples:
 *   aigency
 *   aigency brooklinen
 *   aigency warby-parker round tortoise glasses
 */

import React from "react";
import { render } from "ink";
import App from "./components/App.js";

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
  // crash mid-render (useInput's setRawMode throws) or hang forever waiting for
  // input that can't arrive, exit cleanly with a hint. Tests render via
  // ink-testing-library, which bypasses this entry point entirely.
  if (!process.stdin.isTTY) {
    console.error(
      "aigency is an interactive terminal app — run it directly in your terminal.",
    );
    process.exit(1);
  }

  const { waitUntilExit } = render(
    <App initialBrand={initialBrand} initialQuery={initialQuery} />,
    { exitOnCtrlC: true },
  );

  // Surface clean exit on Ctrl+C and avoid an unhandled-rejection crash.
  waitUntilExit()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

main();
