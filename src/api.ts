/**
 * HTTP client for the Aigency shopping API.
 *
 * Uses the global `fetch` (Node >= 18). Every request is wrapped in an
 * AbortController with a ~15s timeout so a hung backend never freezes the TUI.
 * Callers may also pass their own AbortSignal (e.g. to cancel an in-flight
 * search when the user types a new query); both signals are honored.
 */

import type { Highlight, SearchResponse } from "./types.js";

/** Request timeout in milliseconds. */
const TIMEOUT_MS = 15_000;

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
function withTimeout(external?: AbortSignal): {
  signal: AbortSignal;
  cancel: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

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
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const url =
    `${BASE_URL}/api/${encodeURIComponent(brand)}` +
    `?q=${encodeURIComponent(query)}&format=json&thumbnails=braille`;

  const { signal: timed, cancel } = withTimeout(signal);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
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
 * Fetch suggested-query highlights for `brand`.
 *
 * GET {BASE_URL}/api/highlights/{brand} → reads `.items` (or `[]`).
 *
 * Highlights are decorative; a failure here should never break the flow, so
 * any error (network, timeout, bad shape) resolves to an empty array.
 */
export async function getHighlights(
  brand: string,
  signal?: AbortSignal,
): Promise<Highlight[]> {
  const url = `${BASE_URL}/api/highlights/${encodeURIComponent(brand)}`;

  const { signal: timed, cancel } = withTimeout(signal);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
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
