/**
 * Dev preview harness — renders each TUI component with canned data via
 * ink-testing-library and prints the resulting frame. Lets us eyeball layout
 * (alignment, truncation, footer fit, braille columns) without a live API or a
 * real TTY.
 *
 *   cd cli && npx tsx scripts/preview.tsx
 *
 * Note: ink-testing-library renders to a fixed-width virtual stdout and strips
 * ANSI color, so this verifies LAYOUT, not color. Color logic (readableAccent)
 * is covered by src/__tests__/layout.test.ts. The intro animation is shown as a
 * few static frames; run the live CLI to see it move.
 */

import React from "react";
import { render } from "ink-testing-library";

import BrandPicker from "../src/components/BrandPicker.js";
import ResultsGrid from "../src/components/ResultsGrid.js";
import Comparison from "../src/components/Comparison.js";
import ProductDetail from "../src/components/ProductDetail.js";
import SearchBar from "../src/components/SearchBar.js";
import StatusBar from "../src/components/StatusBar.js";
import StoreLanding from "../src/components/StoreLanding.js";
import WordmarkIgnition from "../src/components/WordmarkIgnition.js";
import { BRANDS } from "../src/brands.js";
import { readableAccent } from "../src/layout.js";
import type { Highlight, Product } from "../src/types.js";

const accent = readableAccent("#e80c00") ?? "#e80c00";

const products: Product[] = [
  {
    title: "Aviator Classic Polarized",
    price: 215,
    url: "https://www.ray-ban.com/aviator",
    rating_value: 4.6,
    why_it_matches: "Iconic teardrop shape with polarized G-15 lenses.",
    description:
      "The original pilot sunglass, engineered in 1937 and unchanged in spirit. Lightweight metal frame, adjustable nose pads.",
    colors: ["Gold / Green Classic", "Black / Grey"],
    available_sizes: ["55", "58", "62"],
    in_stock: true,
    thumbnail: [
      "⠀⡀⣤⣶⣿⣿⣿⣿⣶⣤⡀⠀⠀⠀",
      "⠰⣿⣿⣿⠟⠋⠉⠛⢿⣿⣿⢦⠀⠀",
      "⠈⠛⢿⠟⠁⠀⠀⠈⢻⢿⠛⠁⠀⠀",
    ],
  },
  {
    title: "Wayfarer",
    price: 161,
    rating_value: 4.8,
    why_it_matches: "The everyday icon — acetate frame, endless colorways.",
    colors: ["Black", "Tortoise"],
    available_sizes: ["50", "52", "54"],
    in_stock: true,
    thumbnail: [
      "⠀⣀⣤⣤⣤⣤⣤⣤⣄⡀⠀⠀⠀⠀",
      "⠠⢾⣿⣿⣿⣿⣿⣿⣿⢷⡀⠀⠀⠀",
      "⠘⣿⣿⣿⣿⣿⣿⣿⣿⠟⠁⠀⠀⠀",
    ],
  },
  {
    title: "Clubmaster Metal Optics With A Very Long Title That Truncates",
    price: 199,
    rating_value: 4.3,
    in_stock: false,
  },
];

const chips: Highlight[] = [
  { title: "Sunglasses", query: "sunglasses", thumbnail: products[0].thumbnail },
  { title: "Eyeglasses", query: "eyeglasses", thumbnail: products[1].thumbnail },
  { title: "Cases", query: "cases" },
  { title: "Polarized", query: "polarized", thumbnail: products[0].thumbnail },
];

function frame(label: string, el: React.ReactElement): void {
  const { lastFrame } = render(el);
  process.stdout.write(`\n===== ${label} =====\n${lastFrame()}\n`);
}

frame(
  "INTRO · frame 0 (embers)",
  <WordmarkIgnition accent={accent} onDone={() => {}} previewFrame={2} />,
);
frame(
  "INTRO · frame 15 (igniting)",
  <WordmarkIgnition accent={accent} onDone={() => {}} previewFrame={15} />,
);
frame(
  "INTRO · frame 34 (tagline)",
  <WordmarkIgnition accent={accent} onDone={() => {}} previewFrame={34} />,
);
frame(
  "BRAND PICKER",
  <BrandPicker brands={BRANDS} onSelect={() => {}} selectedKey="ray-ban" />,
);
frame(
  "STORE LANDING",
  <StoreLanding
    brand={{ key: "ray-ban", name: "Ray-Ban", accent }}
    highlights={chips}
    tileIndex={0}
    accent={accent}
  />,
);
frame(
  "SEARCH BAR",
  <SearchBar
    value="aviators"
    onChange={() => {}}
    onSubmit={() => {}}
    chips={chips}
    brandAccent={accent}
    focusedChipIndex={1}
  />,
);
frame(
  "RESULTS GRID",
  <ResultsGrid products={products} selectedIndex={1} accent={accent} />,
);
frame(
  "COMPARISON (2-up)",
  <Comparison
    products={products.slice(0, 2)}
    selectedIndex={0}
    accent={accent}
  />,
);
frame(
  "SINGLE RESULT (embedded PDP)",
  <ProductDetail product={products[0]} accent={accent} showFooter={false} />,
);
frame(
  "PRODUCT DETAIL (full-screen)",
  <ProductDetail product={products[0]} accent={accent} />,
);
frame(
  "STATUS BAR",
  <StatusBar
    brand={{ key: "ray-ban", name: "Ray-Ban", accent }}
    query="aviators"
    count={3}
    durationMs={214}
    hint="↑↓ select · enter open · #N · tab chips · esc"
    accent={accent}
  />,
);
