/**
 * API / JSON contract types for the Aigency shopping API.
 *
 * These are typed DEFENSIVELY: the backend is a fast-iterating prototype and
 * may add, rename, or omit fields between deploys. Almost everything is
 * optional, and `Product` carries an index signature so unknown keys never
 * break parsing. Treat any field as potentially `undefined` at the call site.
 */

/**
 * A single product returned by the search API.
 *
 * `thumbnail` is a pre-rendered braille "image" — an array of equal-width
 * strings, one per terminal row — produced server-side so the CLI never has
 * to decode images itself.
 */
export interface Product {
  /** Product display title. The only field we assume is always present. */
  title: string;
  /** Price. May be a number (e.g. 49.99) or a pre-formatted string ("$49.99"). */
  price?: number | string;
  /** Source image URL (not used for rendering; thumbnail is preferred). */
  image_url?: string;
  /** Canonical product / PDP URL. */
  url?: string;
  /** Long-form description. */
  description?: string;
  /** LLM-generated rationale for why this product matched the query. */
  why_it_matches?: string;
  /** Numeric rating, typically 0–5. */
  rating_value?: number;
  /** Available colorways. */
  colors?: string[];
  /** Available sizes. */
  sizes?: string[];
  /** Stock availability flag. */
  in_stock?: boolean;
  /** Variant-resolved buyable sizes (preferred over `sizes` when present). */
  available_sizes?: string[];
  /** Original (pre-sale) price, when the product is discounted. */
  original_price?: number;
  /** Whether the product is currently on sale. */
  on_sale?: boolean;
  /** Pre-rendered braille thumbnail: one string per row. */
  thumbnail?: string[];
  /** Tolerate arbitrary extra keys the backend may add over time. */
  [key: string]: unknown;
}

/** Optional metadata block describing the search execution. */
export interface SearchMeta {
  /** Number of products in the response. */
  product_count?: number;
  /** Server-side search duration in milliseconds. */
  duration_ms?: number;
  /** Terms the backend actually searched for (post query-expansion). */
  search_terms?: string[];
  /** Critic pipeline verdict, e.g. "high" | "medium" | "low". */
  critic_verdict?: string;
  /** Tolerate extra meta keys. */
  [key: string]: unknown;
}

/** Top-level response shape for a product search. */
export interface SearchResponse {
  /** Brand key the search ran against (e.g. "brooklinen"). */
  brand: string;
  /** Human-friendly brand name, when the backend supplies it. */
  brand_name?: string;
  /** The query that was searched. */
  query: string;
  /** Inferred user intent classification, when available. */
  intent?: string;
  /** Matched products (may be empty). */
  products: Product[];
  /** Conversational answer generated alongside the results. */
  answer?: string;
  /** Session identifier for multi-turn continuity. */
  session_id?: string;
  /** Execution metadata. */
  meta?: SearchMeta;
}

/**
 * A suggested-query "chip" surfaced on the search screen — typically derived
 * from a brand's highlighted / trending products.
 */
export interface Highlight {
  /** Display label for the chip / suggestion. */
  title: string;
  /** The query to run when the chip is selected. */
  query: string;
  /** Optional image URL associated with the highlight. */
  image?: string;
}

/** Static, client-side description of a selectable brand. */
export interface BrandInfo {
  /** Stable brand key used in API paths (e.g. "warby-parker"). */
  key: string;
  /** Human-friendly display name. */
  name: string;
  /** Accent hex color used for theming the TUI for this brand. */
  accent: string;
}
