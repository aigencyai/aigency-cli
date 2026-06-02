/**
 * Tests for resolveInput — the results-view command-line interpreter.
 *
 * Covers every grammar branch from resolve.ts: empty (current), bare/#-prefixed
 * open references (in- and out-of-range), compare phrases (with #, with "and",
 * de-duped, too-few-numbers), and plain search text.
 */

import { describe, it, expect } from "vitest";
import { resolveInput, type Resolved } from "../resolve.js";

describe("resolveInput", () => {
  const COUNT = 8; // pretend the results view shows 8 products (indices 0..7)

  it("treats empty / whitespace input as the current selection", () => {
    expect(resolveInput("", COUNT)).toEqual<Resolved>({ kind: "current" });
    expect(resolveInput("   ", COUNT)).toEqual<Resolved>({ kind: "current" });
  });

  it("opens a #-prefixed in-range reference (0-based)", () => {
    expect(resolveInput("#3", COUNT)).toEqual<Resolved>({
      kind: "open",
      index: 2,
    });
  });

  it("opens a bare in-range number (0-based)", () => {
    expect(resolveInput("2", COUNT)).toEqual<Resolved>({
      kind: "open",
      index: 1,
    });
  });

  it("trims surrounding whitespace before matching an open reference", () => {
    expect(resolveInput("  #1  ", COUNT)).toEqual<Resolved>({
      kind: "open",
      index: 0,
    });
  });

  it("falls through to search for an out-of-range reference", () => {
    expect(resolveInput("#99", COUNT)).toEqual<Resolved>({
      kind: "search",
      query: "#99",
    });
  });

  it("treats a zero reference as a search, not an open", () => {
    expect(resolveInput("0", COUNT)).toEqual<Resolved>({
      kind: "search",
      query: "0",
    });
  });

  it("compares the numbers in 'compare 1 and 2' (0-based)", () => {
    expect(resolveInput("compare 1 and 2", COUNT)).toEqual<Resolved>({
      kind: "compare",
      indices: [0, 1],
    });
  });

  it("compares #-prefixed references 'compare #1 #3' (0-based)", () => {
    expect(resolveInput("compare #1 #3", COUNT)).toEqual<Resolved>({
      kind: "compare",
      indices: [0, 2],
    });
  });

  it("is case-insensitive on the 'compare' keyword", () => {
    expect(resolveInput("COMPARE 1 2", COUNT)).toEqual<Resolved>({
      kind: "compare",
      indices: [0, 1],
    });
  });

  it("de-duplicates repeated references in a compare phrase", () => {
    expect(resolveInput("compare 1 1 2", COUNT)).toEqual<Resolved>({
      kind: "compare",
      indices: [0, 1],
    });
  });

  it("drops out-of-range numbers in a compare phrase", () => {
    // 99 is out of range; only 1 and 2 survive → still 2 valid → compare.
    expect(resolveInput("compare 1 2 99", COUNT)).toEqual<Resolved>({
      kind: "compare",
      indices: [0, 1],
    });
  });

  it("falls through to search when 'compare' has fewer than 2 valid numbers", () => {
    expect(resolveInput("compare 1", COUNT)).toEqual<Resolved>({
      kind: "search",
      query: "compare 1",
    });
  });

  it("falls through to search when a compare phrase has only out-of-range numbers", () => {
    expect(resolveInput("compare 50 99", COUNT)).toEqual<Resolved>({
      kind: "search",
      query: "compare 50 99",
    });
  });

  it("treats arbitrary text as a search", () => {
    expect(resolveInput("red dress", COUNT)).toEqual<Resolved>({
      kind: "search",
      query: "red dress",
    });
  });

  it("trims a search query", () => {
    expect(resolveInput("  blue running shoes  ", COUNT)).toEqual<Resolved>({
      kind: "search",
      query: "blue running shoes",
    });
  });

  it("does not treat 'comparison' as a compare command", () => {
    // \b after 'compare' means 'comparison shirts' is a plain search.
    expect(resolveInput("comparison shirts", COUNT)).toEqual<Resolved>({
      kind: "search",
      query: "comparison shirts",
    });
  });
});
