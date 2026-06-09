import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";

import WordmarkIgnition, {
  advanceIntro,
} from "../components/WordmarkIgnition.js";
import StoreLanding from "../components/StoreLanding.js";
import Comparison from "../components/Comparison.js";
import ProductDetail from "../components/ProductDetail.js";
import type { Highlight, Product } from "../types.js";

const accent = "#e80c00";

const thumb = ["⠀⡀⣤⣶⣿⣶⣤⡀", "⠰⣿⠟⠉⠛⢿⢦", "⠈⠛⢿⠟⠈⢻⛛"];

const products: Product[] = [
  {
    title: "Aviator Classic",
    price: 215,
    rating_value: 4.6,
    why_it_matches: "Iconic teardrop shape.",
    colors: ["Gold", "Black"],
    available_sizes: ["55", "58"],
    thumbnail: thumb,
  },
  { title: "Wayfarer", price: 161, rating_value: 4.8, colors: ["Black"] },
];

describe("WordmarkIgnition", () => {
  it("renders the assembled wordmark at a late frame", () => {
    const onDone = vi.fn();
    const { lastFrame } = render(
      <WordmarkIgnition accent={accent} onDone={onDone} previewFrame={34} />,
    );
    expect(lastFrame()).toContain("a i g e n c y");
    // A static preview frame must NOT start the timer or fire onDone.
    expect(onDone).not.toHaveBeenCalled();
  });

  it("does not show the full wordmark at the opening frame", () => {
    const { lastFrame } = render(
      <WordmarkIgnition accent={accent} onDone={() => {}} previewFrame={0} />,
    );
    expect(lastFrame()).not.toContain("a i g e n c y");
  });

  it("holds on READY with the tagline + a press-any-key prompt", () => {
    const onDone = vi.fn();
    const { lastFrame } = render(
      <WordmarkIgnition accent={accent} onDone={onDone} previewPhase="ready" />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("a i g e n c y");
    expect(frame).toContain("online shopping was fine. we fixed it anyway.");
    expect(frame).toContain("press any key to enter");
    // READY waits for a key — it must NOT auto-hand-off.
    expect(onDone).not.toHaveBeenCalled();
  });

  it("spreads the wordmark and drops the prompt while ENTERING", () => {
    const onDone = vi.fn();
    const { lastFrame } = render(
      <WordmarkIgnition
        accent={accent}
        onDone={onDone}
        previewPhase="entering"
        previewEnterFrame={6}
      />,
    );
    const frame = lastFrame() ?? "";
    // Letters are spread wider than the single-space resting state…
    expect(frame).toMatch(/a {2,}i {2,}g/);
    expect(frame).not.toContain("a i g e n c y");
    // …and the prompt is gone during the warp.
    expect(frame).not.toContain("press any key to enter");
    expect(onDone).not.toHaveBeenCalled();
  });

});

describe("advanceIntro (cold-open phase machine)", () => {
  it("steps igniting → ready → entering on successive keypresses", () => {
    expect(advanceIntro("igniting")).toEqual({ phase: "ready", done: false });
    expect(advanceIntro("ready")).toEqual({ phase: "entering", done: false });
  });

  it("reaching READY never hands off on its own — only a key leaves it", () => {
    // igniting and ready both stay (done:false); the welcome holds until a key.
    expect(advanceIntro("igniting").done).toBe(false);
    expect(advanceIntro("ready").done).toBe(false);
  });

  it("a key mid-warp skips straight to the picker", () => {
    expect(advanceIntro("entering")).toEqual({ phase: "entering", done: true });
  });
});

describe("StoreLanding", () => {
  const highlights: Highlight[] = [
    { title: "Sunglasses", query: "sunglasses", thumbnail: thumb },
    { title: "Cases", query: "cases" }, // no thumbnail → placeholder
  ];

  it("shows the brand marquee + tiles with numbers", () => {
    const { lastFrame } = render(
      <StoreLanding
        brand={{ key: "ray-ban", name: "Ray-Ban", accent }}
        highlights={highlights}
        tileIndex={0}
        accent={accent}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Ray-Ban");
    expect(frame).toContain("Sunglasses");
    expect(frame).toContain("Cases");
    expect(frame).toContain("[1]");
    expect(frame).toContain("[2]");
  });

  it("degrades to a prompt when a store has no highlights", () => {
    const { lastFrame } = render(
      <StoreLanding
        brand={{ key: "tumi", name: "TUMI", accent }}
        highlights={[]}
        tileIndex={0}
        accent={accent}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("TUMI");
    expect(frame).toContain("search anything below to start");
  });
});

describe("Comparison", () => {
  it("renders a column per product with title + price", () => {
    const { lastFrame } = render(
      <Comparison products={products} selectedIndex={0} accent={accent} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Aviator Classic");
    expect(frame).toContain("Wayfarer");
    expect(frame).toContain("$215.00");
    expect(frame).toContain("$161.00");
  });
});

describe("ProductDetail", () => {
  it("shows the keybinding footer by default (full-screen detail)", () => {
    const { lastFrame } = render(
      <ProductDetail product={products[0]} accent={accent} />,
    );
    expect(lastFrame()).toContain("esc back · o open · q quit");
  });

  it("hides the footer when embedded as the single-result view", () => {
    const { lastFrame } = render(
      <ProductDetail product={products[0]} accent={accent} showFooter={false} />,
    );
    expect(lastFrame()).not.toContain("esc back");
  });
});
