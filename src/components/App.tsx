/**
 * App — the root component. Owns ALL application state and the entire keyboard
 * model, wiring a guided, command-line-driven flow across four views.
 *
 *   ┌───────┐ key→enter→done ┌────────┐ enter/1-9   ┌─────────────────────┐
 *   │ intro │ ──────────────▶│ picker │ ───────────▶│ store               │
 *   └───────┘              └────────┘              │  landing ⇄ results  │
 *                              ▲  esc               └─────────┬───────────┘
 *                              └──── esc ─────────────────────┤  enter/#N
 *                                                              ▼  esc
 *                                                         ┌────────┐
 *                                                         │ detail │
 *                                                         └────────┘
 *
 * The STORE view is chat-shaped: a content region (highlight tiles before any
 * search, then results — single / comparison / grid by count, mirroring the
 * web) fills the top, and the search field is pinned at the bottom with the
 * assistant's answer typed just above it. NOTHING runs on store entry — the
 * landing invites a choice instead of auto-searching.
 *
 * Keyboard model
 * ──────────────
 *   INTRO    the cold-open holds on a "press any key to enter" welcome; a key
 *            advances it one step (reveal → enter → skip) then hands to picker.
 *   PICKER   arrows move the grid highlight; up/down step one row; 1-9 jump+
 *            select; enter selects; q quits.
 *   STORE    the SearchBar is ALWAYS focused for typing.
 *     landing (no search yet)
 *            ↑↓ (and ←→ when the box is empty) move the focused highlight tile;
 *            Tab cycles tiles; Enter on an empty box opens the focused tile; a
 *            bare "1".."N" + Enter opens that tile; anything else searches.
 *            Esc → picker.
 *     results
 *            ↑↓ move the selection; Tab cycles chips; Enter routes the input
 *            through resolveInput (current/open #N/compare/search); a focused
 *            chip runs its query. Esc → back to the landing.
 *   DETAIL   esc back to results; 'o' opens the PDP in the browser AND records a
 *            click-through; 'q' quits.
 *   GLOBAL   Ctrl+C always quits (Ink via exitOnCtrlC).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdin, useStdout } from "ink";
import type { Key } from "ink";
import Spinner from "ink-spinner";

import type { BrandInfo, Highlight, Product } from "../types.js";
import { BRANDS, getBrand } from "../brands.js";
import { getHighlights, search, trackClickThrough } from "../api.js";
import { resolveInput, resolveLanding } from "../resolve.js";
import { columnsForPicker, readableAccent } from "../layout.js";
import { resultsView } from "../view.js";
import { newSessionId } from "../session.js";

import BrandPicker from "./BrandPicker.js";
import SearchBar from "./SearchBar.js";
import ResultsGrid from "./ResultsGrid.js";
import Comparison from "./Comparison.js";
import ProductDetail from "./ProductDetail.js";
import StoreLanding, { MAX_TILES } from "./StoreLanding.js";
import StatusBar from "./StatusBar.js";
import Wordmark from "./Wordmark.js";
import WordmarkIgnition from "./WordmarkIgnition.js";
import TypewriterText from "./TypewriterText.js";

/** The four top-level views the TUI can be in. */
export type View = "intro" | "picker" | "store" | "detail";

export interface AppProps {
  /** Optional brand key to start on (skips the intro + picker if valid). */
  initialBrand?: string;
  /** Optional query to run on the initial brand. */
  initialQuery?: string;
}

/** Neutral cyan used before a brand is picked (matches brands.ts FALLBACK). */
const NEUTRAL_ACCENT = "#7dd3fc";

/** Fallback terminal dimensions when stdout reports nothing usable. */
const FALLBACK_WIDTH = 80;
const FALLBACK_ROWS = 24;

/** Hard cap on the typed-out answer so a long reply can't push the input off-screen. */
const ANSWER_MAX_CHARS = 240;

/**
 * Open a URL in the OS default browser. Dynamically imports child_process so
 * the dependency is only paid when the user actually opens a product. Best-
 * effort: any failure is swallowed — opening a browser must never crash the TUI.
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

  // Terminal size, made REACTIVE: Ink reflows Yoga on resize but does not
  // re-run our size-dependent JS (column counts, row budgets), so force a
  // re-render on SIGWINCH and re-read width + rows each render.
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
  const rows = stdout?.rows && stdout.rows > 0 ? stdout.rows : FALLBACK_ROWS;

  // ── Session: one id per launch, groups all this run's queries + the click-
  // through into a single portal session. Lazily minted once. ──────────────
  const sessionRef = useRef<string>("");
  if (!sessionRef.current) sessionRef.current = newSessionId();
  const sessionId = sessionRef.current;

  // ── State (all owned here) ────────────────────────────────────────────
  const startBrand = initialBrand ? getBrand(initialBrand) : undefined;
  // Intro plays only on a cold start (no brand arg) unless opted out.
  const introEnabled = !startBrand && !process.env.AIGENCY_NO_INTRO;

  const [brand, setBrand] = useState<BrandInfo | undefined>(startBrand);
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<Product[]>([]);
  const [answer, setAnswer] = useState<string | undefined>(undefined);
  const [activeQuery, setActiveQuery] = useState<string | undefined>(undefined);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [view, setView] = useState<View>(
    startBrand ? "store" : introEnabled ? "intro" : "picker",
  );
  const [error, setError] = useState<string | undefined>(undefined);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [highlightsLoading, setHighlightsLoading] = useState<boolean>(false);
  const [durationMs, setDurationMs] = useState<number | undefined>(undefined);
  // Whether a search has run in the current store (landing vs results).
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Bumped on each intro keypress; WordmarkIgnition interprets it by phase
  // (reveal the welcome → enter → skip the warp). The intro no longer auto-
  // advances, so a key is the ONLY way past it.
  const [introAdvance, setIntroAdvance] = useState<number>(0);

  // Picker highlight; landing tile focus; results chip focus.
  const [pickerIndex, setPickerIndex] = useState<number>(0);
  const [tileIndex, setTileIndex] = useState<number>(0);
  const [focusedChipIndex, setFocusedChipIndex] = useState<number>(-1);

  // Readable accent (brand once chosen, neutral before).
  const accent =
    readableAccent(brand?.accent ?? NEUTRAL_ACCENT) ?? NEUTRAL_ACCENT;

  // Visible chips on the results screen (kept in lockstep with SearchBar's cap).
  const visibleChips = highlights.slice(0, 6);
  // Number of landing tiles (kept in lockstep with StoreLanding).
  const tileCount = Math.min(MAX_TILES, highlights.length);

  const pickerColumns = columnsForPicker(width);

  // ── Actions ──────────────────────────────────────────────────────────

  // Guards the classic last-completion-wins race: abort the prior request and
  // ignore any resolution that isn't the latest (tracked by a monotonic id).
  const reqSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  // Same last-write-wins guard for the (best-effort) highlights fetch, so a slow
  // prior brand's highlights can't clobber a brand the user just switched to.
  const highlightsSeq = useRef(0);

  /** Run a search and load results. Keeps prior results visible on error. */
  const runSearch = useCallback(
    async (b: BrandInfo, q: string) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const myId = ++reqSeq.current;

      setLoading(true);
      setError(undefined);
      setAnswer(undefined); // drop the prior answer while the new one runs
      setActiveQuery(q);
      setHasSearched(true); // leave the landing for the results view
      setFocusedChipIndex(-1);
      setQuery(""); // clear the box so Enter opens the selection (resolveInput)
      const started = Date.now();
      try {
        const res = await search(b.key, q, sessionId, ctrl.signal);
        if (myId !== reqSeq.current) return; // superseded by a newer search
        setResults(Array.isArray(res.products) ? res.products : []);
        setAnswer(res.answer);
        setSelectedIndex(0);
        setDurationMs(res.meta?.duration_ms ?? Date.now() - started);
      } catch (err) {
        if (myId !== reqSeq.current) return; // superseded — swallow (incl. abort)
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (myId === reqSeq.current) setLoading(false);
      }
    },
    [sessionId],
  );

  /** Load a brand's highlights (best-effort; never blocks or fails a flow). */
  const loadHighlights = useCallback(
    (b: BrandInfo) => {
      const myId = ++highlightsSeq.current;
      setHighlightsLoading(true);
      void getHighlights(b.key, sessionId)
        .then((items) => {
          if (myId === highlightsSeq.current) setHighlights(items);
        })
        .finally(() => {
          if (myId === highlightsSeq.current) setHighlightsLoading(false);
        });
    },
    [sessionId],
  );

  /**
   * Select a brand: go to its store LANDING (no search), reset per-store state,
   * and load highlights in the background.
   */
  const selectBrand = useCallback(
    (b: BrandInfo) => {
      setBrand(b);
      setView("store");
      setHasSearched(false);
      setResults([]);
      setAnswer(undefined);
      setActiveQuery(undefined);
      setError(undefined);
      setQuery("");
      setTileIndex(0);
      setFocusedChipIndex(-1);
      setHighlights([]);
      loadHighlights(b);
    },
    [loadHighlights],
  );

  // ── Initial brand (CLI launched straight into a store) — runs ONCE ──────
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    if (!startBrand) return;
    didInit.current = true;
    loadHighlights(startBrand);
    // An explicit initial query searches immediately; otherwise show the landing.
    if (initialQuery) void runSearch(startBrand, initialQuery);
  }, [startBrand, initialQuery, runSearch, loadHighlights]);

  /** Skip/finish the intro → picker. Idempotent (timer + keypress both call it). */
  const finishIntro = useCallback(() => {
    setView((v) => (v === "intro" ? "picker" : v));
  }, []);

  // ── Input handling ──────────────────────────────────────────────────────
  const handleInput = useCallback(
    (input: string, key: Key) => {
      // ── INTRO: any key advances the cold-open one step (reveal → enter →
      // skip). WordmarkIgnition owns the phase logic; we just signal it. ────
      if (view === "intro") {
        setIntroAdvance((n) => n + 1);
        return;
      }

      // ── PICKER ──────────────────────────────────────────────────────────
      if (view === "picker") {
        if (input === "q") {
          exit();
          return;
        }
        const n = Number.parseInt(input, 10);
        if (!Number.isNaN(n) && n >= 1 && n <= Math.min(9, BRANDS.length)) {
          const picked = BRANDS[n - 1];
          if (picked) {
            setPickerIndex(n - 1);
            selectBrand(picked);
          }
          return;
        }
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

      // ── STORE ─────────────────────────────────────────────────────────────
      if (view === "store") {
        if (!hasSearched) {
          // LANDING: tile navigation. Enter is owned by SearchBar.onSubmit.
          if (key.escape) {
            setView("picker");
            return;
          }
          if (tileCount === 0) return; // nothing to navigate; just type
          if (key.tab) {
            setTileIndex((i) => (i >= tileCount - 1 ? 0 : i + 1));
            return;
          }
          if (key.upArrow) {
            setTileIndex((i) => Math.max(0, i - 1));
            return;
          }
          if (key.downArrow) {
            setTileIndex((i) => Math.min(tileCount - 1, i + 1));
            return;
          }
          // ←→ move tiles ONLY when the box is empty (else they edit the text).
          if (query === "" && key.leftArrow) {
            setTileIndex((i) => Math.max(0, i - 1));
            return;
          }
          if (query === "" && key.rightArrow) {
            setTileIndex((i) => Math.min(tileCount - 1, i + 1));
            return;
          }
          return;
        }

        // RESULTS: selection + chips. Enter is owned by SearchBar.onSubmit.
        if (key.upArrow) {
          setSelectedIndex((i) => Math.max(0, i - 1));
          return;
        }
        if (key.downArrow) {
          setSelectedIndex((i) => Math.min(results.length - 1, i + 1));
          return;
        }
        if (key.tab) {
          if (visibleChips.length === 0) return;
          setFocusedChipIndex((i) =>
            i >= visibleChips.length - 1 ? -1 : i + 1,
          );
          return;
        }
        if (key.escape) {
          // Back to the store landing (the "entrance"), not all the way out.
          // Clear the prior search so the landing is clean (the answer line
          // isn't gated on hasSearched, so a stale answer would otherwise linger).
          setHasSearched(false);
          setFocusedChipIndex(-1);
          setQuery("");
          setResults([]);
          setAnswer(undefined);
          setActiveQuery(undefined);
          setSelectedIndex(0);
          setDurationMs(undefined);
          return;
        }
        return;
      }

      // ── DETAIL ────────────────────────────────────────────────────────────
      if (view === "detail") {
        if (key.escape) {
          setView("store");
          return;
        }
        if (input === "q") {
          exit();
          return;
        }
        if (input === "o") {
          const p = results[selectedIndex];
          if (p && brand) {
            const url = typeof p.url === "string" ? p.url : undefined;
            // Record the click-through (best-effort) THEN open the browser.
            void trackClickThrough(
              { brand: brand.key, product: p.title, url },
              sessionId,
            );
            if (url) void openUrl(url);
          }
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
      hasSearched,
      tileCount,
      query,
      results,
      selectedIndex,
      visibleChips.length,
      brand,
      sessionId,
    ],
  );

  useInput(handleInput, { isActive: isRawModeSupported });

  /**
   * Store-view Enter, routed through the resolver. On the landing it opens a
   * highlight tile; in results it runs a chip / opens a card / compares / searches.
   */
  const handleSubmit = useCallback(
    (raw: string) => {
      if (!brand) return;

      // ── LANDING ─────────────────────────────────────────────────────────
      if (!hasSearched) {
        const tiles = highlights.slice(0, MAX_TILES);
        const resolved = resolveLanding(raw, tiles.length, tileIndex);
        if (resolved.kind === "tile") {
          const h = tiles[resolved.index];
          if (h) void runSearch(brand, h.query); // no-op if the tile is absent
        } else {
          void runSearch(brand, resolved.query);
        }
        return;
      }

      // ── RESULTS ───────────────────────────────────────────────────────────
      // A focused chip wins: run its query, drop focus.
      if (focusedChipIndex >= 0 && focusedChipIndex < visibleChips.length) {
        const chip = visibleChips[focusedChipIndex];
        void runSearch(brand, chip.query);
        return;
      }

      const resolved = resolveInput(raw, results.length);
      switch (resolved.kind) {
        case "current": {
          if (loading) return; // results are stale mid-search
          if (results.length > 0) setView("detail");
          return;
        }
        case "open": {
          if (loading) return;
          setSelectedIndex(resolved.index);
          setView("detail");
          return;
        }
        case "compare": {
          const titles = resolved.indices
            .map((i) => results[i]?.title)
            .filter((t): t is string => Boolean(t));
          const q =
            titles.length >= 2 ? `compare ${titles.join(" vs ")}` : raw.trim();
          void runSearch(brand, q);
          return;
        }
        case "search": {
          void runSearch(brand, resolved.query);
          return;
        }
      }
    },
    [
      brand,
      hasSearched,
      highlights,
      tileIndex,
      focusedChipIndex,
      visibleChips,
      results,
      runSearch,
      loading,
    ],
  );

  // ── Render ────────────────────────────────────────────────────────────
  const selectedProduct: Product | undefined = results[selectedIndex];

  // Row budget for the store content region (a safety net; overflow is also
  // clipped). Reserve header + answer + search + status + margins.
  const reserved =
    2 + (error ? 1 : 0) + 2 + 2 + (answer && !loading ? 3 : 0);
  const contentRows = Math.max(4, rows - reserved);
  const gridMaxRows = Math.max(1, Math.floor((contentRows - 2) / 8));
  const singleDescLines = Math.max(1, Math.min(6, contentRows - 12));

  // Header is pinned (flexShrink=0) so the content region — not the chrome — is
  // what shrinks/clips on a short terminal.
  const header = (
    <Box flexShrink={0} flexDirection="column">
      <Box marginBottom={1}>
        <Wordmark accent={accent} />
      </Box>
      {error ? (
        <Box marginBottom={1}>
          <Text color="red">⚠ {error}</Text>
        </Box>
      ) : null}
    </Box>
  );

  // ── INTRO ────────────────────────────────────────────────────────────────
  if (view === "intro") {
    return (
      <Box width="100%" height={rows} overflow="hidden">
        <WordmarkIgnition
          accent={accent}
          onDone={finishIntro}
          advanceSignal={introAdvance}
          interactive={isRawModeSupported}
        />
      </Box>
    );
  }

  // ── PICKER ─────────────────────────────────────────────────────────────
  if (view === "picker") {
    return (
      <Box flexDirection="column" height={rows} paddingX={1}>
        {header}
        <Box
          flexGrow={1}
          flexShrink={1}
          minHeight={0}
          flexDirection="column"
          overflow="hidden"
        >
          <BrandPicker
            brands={BRANDS}
            onSelect={selectBrand}
            selectedKey={BRANDS[pickerIndex]?.key}
          />
        </Box>
      </Box>
    );
  }

  // ── DETAIL (full-screen PDP) ──────────────────────────────────────────────
  if (view === "detail") {
    return (
      <Box flexDirection="column" height={rows} paddingX={1}>
        {header}
        <Box
          flexGrow={1}
          flexShrink={1}
          minHeight={0}
          flexDirection="column"
          overflow="hidden"
        >
          {selectedProduct ? (
            <ProductDetail product={selectedProduct} accent={accent} showFooter />
          ) : (
            <Box flexDirection="column">
              <Text dimColor>No product selected.</Text>
              <Text dimColor>esc to go back</Text>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  // ── STORE (landing ⇄ results, chat-shaped) ────────────────────────────────
  // Content region: spinner (first search) / landing tiles / results dispatch.
  let content: React.ReactNode;
  if (loading && results.length === 0) {
    content = (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text>
          <Text color={accent}>
            <Spinner type="dots" />
          </Text>{" "}
          <Text dimColor>searching {brand?.name ?? ""}…</Text>
        </Text>
      </Box>
    );
  } else if (!hasSearched) {
    content = (
      <StoreLanding
        brand={brand}
        highlights={highlights}
        tileIndex={tileIndex}
        accent={accent}
        loading={highlightsLoading}
      />
    );
  } else if (results.length === 0) {
    content = (
      <Box marginTop={1}>
        <Text dimColor>No matches — try another search or a highlight.</Text>
      </Box>
    );
  } else {
    const kind = resultsView(results.length);
    content =
      kind === "single" ? (
        <ProductDetail
          product={results[0]}
          accent={accent}
          showFooter={false}
          maxDescLines={singleDescLines}
        />
      ) : kind === "comparison" ? (
        <Comparison
          products={results}
          selectedIndex={selectedIndex}
          accent={accent}
        />
      ) : (
        <ResultsGrid
          products={results}
          selectedIndex={selectedIndex}
          accent={accent}
          maxRows={gridMaxRows}
        />
      );
  }

  // Footer hint depends on the sub-state.
  const hint = !hasSearched
    ? tileCount > 0
      ? "↑↓ pick · enter open · type to search · esc back"
      : "type to search · esc back"
    : loading
      ? "searching…"
      : focusedChipIndex >= 0
        ? "enter run · tab next · esc"
        : visibleChips.length > 0
          ? "↑↓ select · enter open · #N · tab chips · esc"
          : "↑↓ select · enter open · #N · esc";

  const placeholder = !hasSearched
    ? `search ${brand?.name ?? "this store"}… or pick a highlight ↑`
    : undefined;

  const answerShown =
    answer && answer.length > ANSWER_MAX_CHARS
      ? `${answer.slice(0, ANSWER_MAX_CHARS - 1)}…`
      : answer;

  return (
    <Box flexDirection="column" height={rows} paddingX={1}>
      {header}

      <Box
        flexGrow={1}
        flexShrink={1}
        minHeight={0}
        flexDirection="column"
        overflow="hidden"
      >
        {content}
      </Box>

      {/* Pinned bottom chrome (flexShrink=0): assistant line + search + status.
          The content region above shrinks/clips instead of pushing these off. */}
      <Box flexShrink={0} flexDirection="column">
        {/* Assistant line, just above the input. While re-searching (prior
            results still on screen) a small spinner sits here; the empty first
            search shows the big centered spinner in the content region instead.
            Default foreground so the answer stays readable on any brand accent. */}
        <Box minHeight={1}>
          {loading && results.length > 0 ? (
            <Text>
              <Text color={accent}>
                <Spinner type="dots" />
              </Text>{" "}
              <Text dimColor>searching {brand?.name ?? ""}…</Text>
            </Text>
          ) : !loading && answerShown ? (
            <TypewriterText text={answerShown} />
          ) : null}
        </Box>

        <SearchBar
          value={query}
          onChange={setQuery}
          onSubmit={handleSubmit}
          chips={hasSearched ? highlights : []}
          brandAccent={accent}
          focusedChipIndex={focusedChipIndex}
          placeholder={placeholder}
        />

        <StatusBar
          brand={brand}
          query={hasSearched ? activeQuery : undefined}
          count={hasSearched && !loading ? results.length : undefined}
          durationMs={hasSearched && !loading ? durationMs : undefined}
          hint={hint}
          accent={accent}
        />
      </Box>
    </Box>
  );
}

export default App;
