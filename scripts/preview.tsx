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
 * is covered by src/__tests__/layout.test.ts.
 */

import React from "react";
import { render } from "ink-testing-library";

import BrandPicker from "../src/components/BrandPicker.js";
import ResultsGrid from "../src/components/ResultsGrid.js";
import ProductDetail from "../src/components/ProductDetail.js";
import SearchBar from "../src/components/SearchBar.js";
import StatusBar from "../src/components/StatusBar.js";
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
  { title: "New Arrivals", query: "new arrivals" },
  { title: "Polarized", query: "polarized" },
  { title: "Best Sellers", query: "best sellers" },
];

function frame(label: string, el: React.ReactElement): void {
  const { lastFrame } = render(el);
  process.stdout.write(`\n===== ${label} =====\n${lastFrame()}\n`);
}

frame(
  "BRAND PICKER",
  <BrandPicker brands={BRANDS} onSelect={() => {}} selectedKey="ray-ban" />,
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
  "PRODUCT DETAIL",
  <ProductDetail product={products[0]} accent={accent} />,
);
frame(
  "STATUS BAR",
  <StatusBar
    brand={{ key: "ray-ban", name: "Ray-Ban", accent }}
    count={3}
    durationMs={214}
    hint="↑↓ select · enter open · tab chips · esc"
    accent={accent}
  />,
);
