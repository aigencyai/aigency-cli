import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "ink-testing-library";

// Mock the HTTP layer so the App never touches the network in tests.
vi.mock("../api.js", () => ({
  getHighlights: vi.fn().mockResolvedValue([]),
  search: vi.fn().mockResolvedValue({ brand: "ray-ban", query: "", products: [] }),
  trackClickThrough: vi.fn().mockResolvedValue(undefined),
}));

import App from "../components/App.js";
import * as api from "../api.js";

const tick = () => new Promise((r) => setTimeout(r, 10));

describe("App — store entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens a store on its LANDING and runs NO search (no auto 'best sellers')", async () => {
    const { lastFrame } = render(<App initialBrand="ray-ban" />);
    await tick();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Ray-Ban"); // marquee shows the store
    expect(frame.toLowerCase()).not.toContain("best sellers"); // the old bug
    expect(api.search).not.toHaveBeenCalled(); // nothing searched on entry
    expect(api.getHighlights).toHaveBeenCalledWith(
      "ray-ban",
      expect.any(String),
    );
  });

  it("runs the initial query when one is supplied as an arg", async () => {
    render(<App initialBrand="ray-ban" initialQuery="aviators" />);
    await tick();
    expect(api.search).toHaveBeenCalledWith(
      "ray-ban",
      "aviators",
      expect.any(String),
      expect.anything(),
    );
  });

  it("surfaces a search error instead of crashing", async () => {
    vi.mocked(api.search).mockRejectedValueOnce(new Error("backend exploded"));
    const { lastFrame } = render(
      <App initialBrand="ray-ban" initialQuery="aviators" />,
    );
    await tick();
    expect(lastFrame()).toContain("backend exploded");
  });

  it("shows a friendly empty state when a search returns nothing", async () => {
    vi.mocked(api.search).mockResolvedValueOnce({
      brand: "ray-ban",
      query: "zzz",
      products: [],
      answer: "I couldn't find anything.",
    });
    const { lastFrame } = render(
      <App initialBrand="ray-ban" initialQuery="zzz" />,
    );
    await tick();
    expect(lastFrame()).toContain("No matches");
  });
});
