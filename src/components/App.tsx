/**
 * App — the root component. Owns ALL application state and the entire keyboard
 * model, wiring a guided, command-line-driven flow across three views.
 *
 *   ┌─────────┐  enter / 1-9   ┌─────────┐   enter (open #N / empty)  ┌────────┐
 *   │ picker  │ ──────────────▶│ results │ ──────────────────────────▶│ detail │
 *   └─────────┘                └─────────┘ ◀──────────────────────────└────────┘
 *        ▲   q quit                 │  esc                     esc
 *        └──────────────────────────┘
 *
 * Keyboard model (the input line is a COMMAND line; arrows are sugar)
 * ───────────────────────────────────────────────────────────────────
 *   PICKER   arrows move the grid highlight (pickerIndex); up/down step one real
 *            row (column count shared with BrandPicker); 1-9 jump+select; enter
 *            selects the highlighted brand; q quits. Selecting → load highlights
 *            (best-effort) + go to results + run the initial search.
 *
 *   RESULTS  the SearchBar input is ALWAYS focused for typing.
 *            ↑/↓        move selectedIndex (ink-text-input ignores up/down).
 *            Tab        cycle focusedChipIndex through chips (-1 = none).
 *            Enter      · a chip is focused → run that chip's query, reset focus
 *                       · no chip focused → route the raw input through
 *                         resolveInput():
 *                           current/empty → open detail for selectedIndex
 *                           open #N / N   → open detail for that result
 *                           compare       → run a compare search built from the
 *                                           RESOLVED product titles
 *                           search        → normal search
 *            Esc        back to picker.
 *            (no bare 'q' quit here — 'q' is a valid search character.)
 *
 *   DETAIL   Esc back to results; 'o' opens product.url in the OS browser;
 *            'q' quits.
 *
 *   GLOBAL   Ctrl+C always quits (handled by Ink via exitOnCtrlC).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdin, useStdout } from "ink";
import type { Key } from "ink";
import Spinner from "ink-spinner";

import type { BrandInfo, Highlight, Product } from "../types.js";
import { BRANDS, getBrand } from "../brands.js";
import { getHighlights, search } from "../api.js";
import { resolveInput } from "../resolve.js";
import { columnsForPicker, readableAccent } from "../layout.js";

import BrandPicker from "./BrandPicker.js";
import SearchBar from "./SearchBar.js";
import ResultsGrid from "./ResultsGrid.js";
import ProductDetail from "./ProductDetail.js";
import StatusBar from "./StatusBar.js";
import Wordmark from "./Wordmark.js";
import TypewriterText from "./TypewriterText.js";

/** The three top-level views the TUI can be in. */
export type View = "picker" | "results" | "detail";

export interface AppProps {
  /** Optional brand key to start on (skips the picker if valid). */
  initialBrand?: string;
  /** Optional query to run on the initial brand. */
  initialQuery?: string;
}

/** Default query used when no initialQuery is supplied. */
const DEFAULT_QUERY = "best sellers";

/** Neutral cyan used before a brand is picked (matches brands.ts FALLBACK). */
const NEUTRAL_ACCENT = "#7dd3fc";

/** Fallback terminal width when stdout reports nothing usable. */
const FALLBACK_WIDTH = 80;

/**
 * Open a URL in the OS default browser. Dynamically imports child_process so
 * the dependency is only paid when the user actually opens a product, and so
 * the module graph stays light for the common (non-opening) path. Best-effort:
 * any failure is swallowed — opening a browser must never crash the TUI.
 */
async function openUrl(url: string): Promise<void> {
  try {
    const { spawn } = await import("node:child_process");
    const platform = process.platform;
    const [cmd, args] =
      platform === "darwin"
        ? ["open", [url]]
        : platform === "win32"
          ? ["cmd", ["/c", "start", "", url]]
          : ["xdg-open", [url]];
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => {
      /* opener missing — ignore, nothing we can surface usefully */
    });
    child.unref();
  } catch {
    /* import or spawn failed — best effort only */
  }
}

export function App({
  initialBrand,
  initialQuery,
}: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const { stdout } = useStdout();

  // Terminal width, made REACTIVE: Ink reflows Yoga on resize but does not
  // re-run our width-dependent JS (column counts, arrow stride), so we force a
  // re-render on SIGWINCH and re-read the width each render.
  const [, bumpOnResize] = useState(0);
  useEffect(() => {
    const onResize = (): void => bumpOnResize((n) => n + 1);
    process.stdout.on("resize", onResize);
    return () => {
      process.stdout.off("resize", onResize);
    };
  }, []);
  const width =
    stdout?.columns && stdout.columns > 0 ? stdout.columns : FALLBACK_WIDTH;

  // ── State (all owned here) ────────────────────────────────────────────
  const startBrand = initialBrand ? getBrand(initialBrand) : undefined;

  const [brand, setBrand] = useState<BrandInfo | undefined>(startBrand);
  const [query, setQuery] = useState<string>(initialQuery ?? "");
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<Product[]>([]);
  const [answer, setAnswer] = useState<string | undefined>(undefined);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [view, setView] = useState<View>(startBrand ? "results" : "picker");
  const [error, setError] = useState<string | undefined>(undefined);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [durationMs, setDurationMs] = useState<number | undefined>(undefined);

  // Picker highlight: arrows move this; 1-9 jump to it; Enter selects it.
  const [pickerIndex, setPickerIndex] = useState<number>(0);
  // Chip focus on the results view: -1 = none (Enter routes the input line).
  const [focusedChipIndex, setFocusedChipIndex] = useState<number>(-1);

  // The accent in play right now (brand once chosen, neutral before), adjusted
  // for legibility so dark brand colors (navy/maroon) stay readable on a dark
  // terminal. This is the accent we pass to every accent-tinted child.
  const accent =
    readableAccent(brand?.accent ?? NEUTRAL_ACCENT) ?? NEUTRAL_ACCENT;

  // Visible chips must match what SearchBar renders so Tab focus + Enter agree
  // on the same list (SearchBar caps at 6; keep this in lockstep).
  const visibleChips = highlights.slice(0, 6);

  // Picker column count, shared with BrandPicker so up/down step one real row.
  const pickerColumns = columnsForPicker(width);

  // ── Actions ──────────────────────────────────────────────────────────

  // Guards against the classic last-completion-wins race: searches are LLM-
  // backed with variable latency, so a slow earlier search could otherwise
  // clobber a newer one. We abort the prior request and ignore any resolution
  // that isn't the latest (tracked by a monotonic id).
  const reqSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  /** Run a search and load the results into state. Keeps prior results on error. */
  const runSearch = useCallback(async (b: BrandInfo, q: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const myId = ++reqSeq.current;

    setLoading(true);
    setError(undefined);
    setAnswer(undefined); // drop the prior query's answer while the new one runs
    setFocusedChipIndex(-1);
    const started = Date.now();
    try {
      const res = await search(b.key, q, ctrl.signal);
      if (myId !== reqSeq.current) return; // superseded by a newer search
      setResults(Array.isArray(res.products) ? res.products : []);
      setAnswer(res.answer);
      setSelectedIndex(0);
      setDurationMs(res.meta?.duration_ms ?? Date.now() - started);
    } catch (err) {
      if (myId !== reqSeq.current) return; // superseded — swallow (incl. abort)
      if (err instanceof Error && err.name === "AbortError") return;
      // Keep the prior results visible; just surface the error line.
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (myId === reqSeq.current) setLoading(false);
    }
  }, []);

  /**
   * Select a brand: load highlights, switch to results, run the initial search.
   * Seeds with DEFAULT_QUERY (not leftover input text) and clears the box so the
   * user starts fresh — which also keeps this callback stable across keystrokes.
   */
  const selectBrand = useCallback(
    (b: BrandInfo) => {
      setBrand(b);
      setView("results");
      setFocusedChipIndex(-1);
      setQuery(""); // empty box, ready to type; results show DEFAULT_QUERY
      // Highlights are best-effort and never block (or fail) the search.
      void getHighlights(b.key).then(setHighlights);
      void runSearch(b, DEFAULT_QUERY);
    },
    [runSearch],
  );

  // ── Initial search (CLI launched straight into a brand) — runs ONCE ─────
  const didInitialSearch = useRef(false);
  useEffect(() => {
    if (didInitialSearch.current) return;
    if (!startBrand) return;
    didInitialSearch.current = true;
    const q = initialQuery || DEFAULT_QUERY;
    setQuery(q);
    void getHighlights(startBrand.key).then(setHighlights);
    void runSearch(startBrand, q);
    // Intentionally one-shot: depends only on startBrand/initialQuery which are
    // fixed for the lifetime of the process (derived from CLI args).
  }, [startBrand, initialQuery, runSearch]);

  // ── Input handling ──────────────────────────────────────────────────────
  // Gated on isRawModeSupported: under a non-TTY there is no raw mode and Ink's
  // useInput would otherwise throw trying to enable it.
  const handleInput = useCallback(
    (input: string, key: Key) => {
      // ── PICKER ──────────────────────────────────────────────────────────
      if (view === "picker") {
        if (input === "q") {
          exit();
          return;
        }
        // 1-9 jump to that brand AND select it.
        const n = Number.parseInt(input, 10);
        if (!Number.isNaN(n) && n >= 1 && n <= Math.min(9, BRANDS.length)) {
          const picked = BRANDS[n - 1];
          if (picked) {
            setPickerIndex(n - 1);
            selectBrand(picked);
          }
          return;
        }
        // Arrows move the highlight across the row-major grid: left/right step by
        // one, up/down by the real column count (shared with BrandPicker) so a
        // vertical move lands exactly one visual row away.
        if (key.leftArrow) {
          setPickerIndex((i) => Math.max(0, i - 1));
        } else if (key.rightArrow) {
          setPickerIndex((i) => Math.min(BRANDS.length - 1, i + 1));
        } else if (key.upArrow) {
          setPickerIndex((i) => Math.max(0, i - pickerColumns));
        } else if (key.downArrow) {
          setPickerIndex((i) => Math.min(BRANDS.length - 1, i + pickerColumns));
        } else if (key.return) {
          const picked = BRANDS[pickerIndex];
          if (picked) selectBrand(picked);
        }
        return;
      }

      // ── RESULTS ───────────────────────────────────────────────────────────
      if (view === "results") {
        // Up/Down move the selection (ink-text-input ignores these, no conflict).
        if (key.upArrow) {
          setSelectedIndex((i) => Math.max(0, i - 1));
          return;
        }
        if (key.downArrow) {
          setSelectedIndex((i) => Math.min(results.length - 1, i + 1));
          return;
        }
        // Tab cycles chip focus: none → 0 → 1 → … → last → none.
        if (key.tab) {
          if (visibleChips.length === 0) return;
          setFocusedChipIndex((i) =>
            i >= visibleChips.length - 1 ? -1 : i + 1,
          );
          return;
        }
        if (key.escape) {
          setView("picker");
          setFocusedChipIndex(-1);
          return;
        }
        // Enter is handled by SearchBar.onSubmit (TextInput owns Enter) so the
        // input value is current; see handleSubmit below. We intentionally do
        // NOT handle key.return here to avoid double-firing.
        return;
      }

      // ── DETAIL ────────────────────────────────────────────────────────────
      if (view === "detail") {
        if (key.escape) {
          setView("results");
          return;
        }
        if (input === "q") {
          exit();
          return;
        }
        if (input === "o") {
          const p = results[selectedIndex];
          const url = typeof p?.url === "string" ? p.url : undefined;
          if (url) void openUrl(url);
          return;
        }
      }
    },
    [
      view,
      exit,
      selectBrand,
      pickerColumns,
      pickerIndex,
      results,
      selectedIndex,
      visibleChips.length,
    ],
  );

  useInput(handleInput, { isActive: isRawModeSupported });

  /**
   * Results-view Enter, routed through the resolver. A focused chip short-
   * circuits to running that chip's query; otherwise the raw input decides.
   */
  const handleSubmit = useCallback(
    (raw: string) => {
      if (!brand) return;

      // A focused chip wins: run its query, drop focus, clear the input.
      if (focusedChipIndex >= 0 && focusedChipIndex < visibleChips.length) {
        const chip = visibleChips[focusedChipIndex];
        setFocusedChipIndex(-1);
        setQuery(chip.query);
        void runSearch(brand, chip.query);
        return;
      }

      const resolved = resolveInput(raw, results.length);
      switch (resolved.kind) {
        case "current": {
          // Open the currently-selected card — but not mid-search, when the
          // displayed results still belong to the PREVIOUS query.
          if (loading) return;
          if (results.length > 0) setView("detail");
          return;
        }
        case "open": {
          if (loading) return; // results are stale until the new search lands
          setSelectedIndex(resolved.index);
          setView("detail");
          return;
        }
        case "compare": {
          // Build a compare query from the RESOLVED product titles so the
          // backend compares the actual items the user referenced.
          const titles = resolved.indices
            .map((i) => results[i]?.title)
            .filter((t): t is string => Boolean(t));
          const q =
            titles.length >= 2 ? `compare ${titles.join(" vs ")}` : raw.trim();
          setQuery(q);
          void runSearch(brand, q);
          return;
        }
        case "search": {
          setQuery(resolved.query);
          void runSearch(brand, resolved.query);
          return;
        }
      }
    },
    [brand, focusedChipIndex, visibleChips, results, runSearch, loading],
  );

  // ── Render ────────────────────────────────────────────────────────────
  const selectedProduct: Product | undefined = results[selectedIndex];

  // Contextual footer hint for the results view (the only view with a StatusBar).
  const hint = loading
    ? "searching…"
    : focusedChipIndex >= 0
      ? "enter run · tab next · esc"
      : visibleChips.length > 0
        ? "↑↓ select · enter open · tab chips · esc"
        : "↑↓ select · enter open · #N · esc";

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Wordmark accent={accent} />
      </Box>

      {error ? (
        <Box marginBottom={1}>
          <Text color="red">⚠ {error}</Text>
        </Box>
      ) : null}

      {view === "picker" ? (
        <BrandPicker
          brands={BRANDS}
          onSelect={selectBrand}
          selectedKey={BRANDS[pickerIndex]?.key}
        />
      ) : null}

      {view === "results" ? (
        <Box flexDirection="column">
          <SearchBar
            value={query}
            onChange={setQuery}
            onSubmit={handleSubmit}
            chips={highlights}
            brandAccent={accent}
            focusedChipIndex={focusedChipIndex}
          />

          {/* Conversational answer, typed out above the results. Rendered in the
              default foreground (NOT the accent) so it stays readable regardless
              of how dark a brand's color is. */}
          {answer && !loading ? (
            <Box marginTop={1}>
              <TypewriterText text={answer} />
            </Box>
          ) : null}

          <Box marginTop={1}>
            {loading ? (
              <Text>
                <Text color={accent}>
                  <Spinner type="dots" />
                </Text>{" "}
                <Text dimColor>searching {brand?.name ?? ""}…</Text>
              </Text>
            ) : (
              <ResultsGrid
                products={results}
                selectedIndex={selectedIndex}
                accent={accent}
              />
            )}
          </Box>

          <StatusBar
            brand={brand}
            count={results.length}
            durationMs={durationMs}
            hint={hint}
            accent={accent}
          />
        </Box>
      ) : null}

      {view === "detail" ? (
        selectedProduct ? (
          // ProductDetail renders its own "esc back · o open · q quit" footer,
          // so no StatusBar here — it would duplicate the hint.
          <ProductDetail product={selectedProduct} accent={accent} />
        ) : (
          <Box flexDirection="column">
            <Text dimColor>No product selected.</Text>
            <Text dimColor>esc to go back</Text>
          </Box>
        )
      ) : null}
    </Box>
  );
}

export default App;
