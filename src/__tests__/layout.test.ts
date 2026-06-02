import { describe, it, expect } from "vitest";
import { columnsForPicker, readableAccent } from "../layout.js";

/** HSL lightness of a #rrggbb string, for asserting we actually brightened. */
function lightness(hex: string): number {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

describe("columnsForPicker", () => {
  it("scales 1 → 4 with terminal width, at stable breakpoints", () => {
    expect(columnsForPicker(40)).toBe(1);
    expect(columnsForPicker(43)).toBe(1);
    expect(columnsForPicker(44)).toBe(2);
    expect(columnsForPicker(71)).toBe(2);
    expect(columnsForPicker(72)).toBe(3);
    expect(columnsForPicker(99)).toBe(3);
    expect(columnsForPicker(100)).toBe(4);
    expect(columnsForPicker(240)).toBe(4);
  });
});

describe("readableAccent", () => {
  it("passes through undefined / malformed input untouched", () => {
    expect(readableAccent(undefined)).toBeUndefined();
    expect(readableAccent("nope")).toBe("nope");
  });

  it("leaves vivid / already-light accents unchanged", () => {
    expect(readableAccent("#7dd3fc")).toBe("#7dd3fc"); // neutral cyan
    expect(readableAccent("#e80c00")).toBe("#e80c00"); // Ray-Ban red (vivid)
    expect(readableAccent("#D31334")).toBe("#D31334"); // lululemon red
    expect(readableAccent("#ff6a00")).toBe("#ff6a00"); // Nike orange
  });

  it("lightens genuinely-dark accents while preserving a valid hex", () => {
    for (const dark of ["#283455", "#1F3044", "#003B5C", "#7B0000", "#3c4a6b"]) {
      const out = readableAccent(dark) as string;
      expect(out).toMatch(/^#[0-9a-f]{6}$/i);
      expect(out.toLowerCase()).not.toBe(dark.toLowerCase());
      expect(lightness(out)).toBeGreaterThan(lightness(dark));
      expect(lightness(out)).toBeGreaterThanOrEqual(0.5);
    }
  });
});
