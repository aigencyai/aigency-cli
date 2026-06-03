import { describe, it, expect } from "vitest";
import { resultsView } from "../view.js";

describe("resultsView", () => {
  it("1 product → single detail", () => {
    expect(resultsView(1)).toBe("single");
  });

  it("2–3 products → comparison", () => {
    expect(resultsView(2)).toBe("comparison");
    expect(resultsView(3)).toBe("comparison");
  });

  it("0 and 4+ products → grid", () => {
    expect(resultsView(0)).toBe("grid"); // empty state lives in the grid
    expect(resultsView(4)).toBe("grid");
    expect(resultsView(25)).toBe("grid");
  });
});
