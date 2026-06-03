/**
 * HTTP client for the Aigency shopping API.
 *
 * Uses the global `fetch` (Node >= 18). Every request is wrapped in an
 * AbortController with a ~15s timeout so a hung backend never freezes the TUI.
 * Callers may also pass their own AbortSignal (e.g. to cancel an in-flight
 * search when the user types a new query); both signals are honored.
 *
 * Every request also carries the first-party {@link aigencyHeaders} (User-Agent,
 * X-Agent-Name, X-Channel, X-Session-Id) so the backend attributes the traffic
 * to "Aigency CLI" and groups a run's searches + click-through into one session.
 */

import type { Highlight, SearchResponse } from "./types.js";
import { UTM_SOURCE, aigencyHeaders } from "./session.js";

/** Request timeout in milliseconds. */
const TIMEOUT_MS = 15_000;

/** Tracking POSTs are best-effort and never block the UI; keep them snappy. */
const TRACK_TIMEOUT_MS = 5_000;

/**
 * API base URL. Override with the AIGENCY_URL env var (useful for local dev
 * against http://localhost:3001). Any trailing slash is stripped so we can
 * safely concatenate paths.
 */
export const BASE_URL: string = (
  process.env.AIGENCY_URL || "https://aigency-genui.vercel.app"
).replace(/\/+$/, "");

/**
 * Combine an external AbortSignal (if any) with an internal timeout signal.
 * Returns the timeout's controller so the caller can clear the timer.
 */
function withTimeout(
  ms: number,
  external?: AbortSignal,
): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  // If the caller's signal aborts, propagate to our controller.
  if (external) {
    if (external.aborted) {
      controller.abort();
    } else {
      external.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

/**
 * Run a product search for `query` against `brand`.
 *
 * GET {BASE_URL}/api/{brand}?q={query}&format=json&thumbnails=braille
 *
 * @throws Error with a clear message on non-2xx responses or network failure.
 */
export async function search(
  brand: string,
  query: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const url =
    `${BASE_URL}/api/${encodeURIComponent(brand)}` +
    `?q=${encodeURIComponent(query)}&format=json&thumbnails=braille`;

  const { signal: timed, cancel } = withTimeout(TIMEOUT_MS, signal);
  try {
    const res = await fetch(url, {
      headers: aigencyHeaders(sessionId),
      signal: timed,
    });

    if (!res.ok) {
      throw new Error(
        `Search failed (${res.status} ${res.statusText}) for brand "${brand}".`,
      );
    }

    return (await res.json()) as SearchResponse;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `Search timed out after ${TIMEOUT_MS / 1000}s for brand "${brand}".`,
      );
    }
    throw err instanceof Error
      ? err
      : new Error(`Search failed for brand "${brand}": ${String(err)}`);
  } finally {
    cancel();
  }
}

/**
 * Fetch suggested-query highlights for `brand`, with braille thumbnails so the
 * store landing can render each as a picture tile.
 *
 * GET {BASE_URL}/api/highlights/{brand}?thumbnails=braille → reads `.items`.
 *
 * Highlights are decorative; a failure here should never break the flow, so
 * any error (network, timeout, bad shape) resolves to an empty array.
 */
export async function getHighlights(
  brand: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<Highlight[]> {
  const url =
    `${BASE_URL}/api/highlights/${encodeURIComponent(brand)}` +
    `?thumbnails=braille`;

  const { signal: timed, cancel } = withTimeout(TIMEOUT_MS, signal);
  try {
    const res = await fetch(url, {
      headers: aigencyHeaders(sessionId),
      signal: timed,
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { items?: Highlight[] } | unknown;
    if (
      data &&
      typeof data === "object" &&
      Array.isArray((data as { items?: unknown }).items)
    ) {
      return (data as { items: Highlight[] }).items;
    }
    return [];
  } catch {
    // Tolerate any failure — highlights are optional UI sugar.
    return [];
  } finally {
    cancel();
  }
}

/** Shape of a click-through event reported to the API. */
export interface ClickThrough {
  /** Brand key the product belongs to (e.g. "ray-ban"). */
  brand: string;
  /** Product title the user clicked through on. */
  product: string;
  /** Canonical product / PDP URL that was opened. */
  url?: string;
}

/**
 * Report a PDP click-through for `product` so the portal session shows the
 * specific item the user opened (not just the keywords they searched). Fired
 * when the user opens a product in their browser.
 *
 * POST {BASE_URL}/api/track  {event:"click_through", sessionId, brandKey, …}
 *
 * Best-effort and non-blocking: this NEVER throws and resolves regardless of
 * outcome, so opening a product is never gated on analytics succeeding.
 */
export async function trackClickThrough(
  ev: ClickThrough,
  sessionId: string,
): Promise<void> {
  const { signal, cancel } = withTimeout(TRACK_TIMEOUT_MS);
  try {
    await fetch(`${BASE_URL}/api/track`, {
      method: "POST",
      headers: {
        ...aigencyHeaders(sessionId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: "click_through",
        sessionId,
        brandKey: ev.brand,
        product: ev.product,
        url: ev.url,
        utmSource: UTM_SOURCE,
      }),
      signal,
    });
  } catch {
    // Analytics is best-effort; swallow everything (incl. timeout/abort).
  } finally {
    cancel();
  }
}
