import { describe, it, expect } from "vitest";
import { formatPrice, stars, truncate, stripAnsi, wrapText } from "../format.js";

describe("stripAnsi", () => {
  it("removes SGR color escapes, keeping the braille", () => {
    expect(stripAnsi("[38;2;128;64;32m⣿⣿⣷[0m")).toBe("⣿⣿⣷");
  });
  it("is a no-op on plain strings", () => {
    expect(stripAnsi("⣿⣿")).toBe("⣿⣿");
    expect(stripAnsi("")).toBe("");
  });
});

describe("formatPrice", () => {
  it("formats numbers as USD", () => {
    expect(formatPrice(49.99)).toBe("$49.99");
    expect(formatPrice(215)).toBe("$215.00");
  });
  it("passes through pre-formatted / handles empty", () => {
    expect(formatPrice(undefined)).toBe("");
    expect(formatPrice("$12")).toBe("$12");
  });
});

describe("stars", () => {
  it("renders rounded 0-5 stars", () => {
    expect(stars(4.2)).toBe("★★★★☆");
    expect(stars(5)).toBe("★★★★★");
    expect(stars(undefined)).toBe("☆☆☆☆☆");
  });
});

describe("truncate", () => {
  it("truncates with an ellipsis, leaves short strings", () => {
    expect(truncate("hello world", 8)).toBe("hello w…");
    expect(truncate("hi", 8)).toBe("hi");
  });
});

describe("wrapText", () => {
  it("greedily wraps to the given width", () => {
    expect(wrapText("the quick brown fox", 9)).toEqual([
      "the quick",
      "brown fox",
    ]);
  });
  it("hard-splits a word longer than the width", () => {
    expect(wrapText("supercalifragilistic", 6)).toEqual([
      "superc",
      "alifra",
      "gilist",
      "ic",
    ]);
  });
  it("returns [] for blank input or non-positive width", () => {
    expect(wrapText("", 10)).toEqual([]);
    expect(wrapText("hi", 0)).toEqual([]);
  });
});
