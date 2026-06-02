# aigency

**Shop real brand catalogs from your terminal.** A conversational AI shopping
assistant — search, compare, drill into products — rendered as a Claude-Code-style
TUI, complete with braille product thumbnails.

Online shopping was fine. We fixed it anyway.

```
╭─────────────────────╮  ╭─────────────────────╮  ╭─────────────────────╮
│ ⠀⡀⣤⣶⣿⣿⣿⣿⣶⣤⡀⠀⠀⠀      │  │ ⠀⣀⣤⣤⣤⣤⣤⣤⣄⡀⠀⠀⠀⠀      │  │ ⠀⢀⣴⣾⣿⣿⣷⣦⡀⠀⠀⠀     │
│ ⠰⣿⣿⣿⠟⠋⠉⠛⢿⣿⣿⢦⠀⠀      │  │ ⠠⢾⣿⣿⣿⣿⣿⣿⣿⢷⡀⠀⠀⠀      │  │ ⢠⣿⣿⠟⠉⠛⢿⣿⣧⠀⠀⠀     │
│ ⠈⠛⢿⠟⠁⠀⠀⠈⢻⢿⠛⠁⠀⠀      │  │ ⠘⣿⣿⣿⣿⣿⣿⣿⣿⠟⠁⠀⠀⠀      │  │ ⠈⠻⣿⣶⣶⣿⠟⠋⠀⠀⠀⠀     │
│ ▌ Aviator Classic   │  │   Wayfarer          │  │   Clubmaster        │
│   $215.00  ★★★★★    │  │   $161.00  ★★★★★    │  │   $199.00  ★★★★☆    │
╰─────────────────────╯  ╰─────────────────────╯  ╰─────────────────────╯
```

## Try it

> Requires Node ≥ 18.

```bash
# zero install — just run it
npx aigency ray-ban aviators

# …or install it for real
brew install aigencyai/tap/aigency   # macOS / Linux (Homebrew)
npm i -g aigency                     # any platform

aigency                              # then launch the picker anytime
```

## Use it

```
aigency                          # launch the brand picker
aigency <brand>                  # open a brand
aigency <brand> <query…>         # open a brand and search
```

The search box is a command line — arrows are sugar:

| key | does |
| --- | --- |
| type + `enter` | search |
| `↑` / `↓` | move the selection |
| `enter` (empty) / `#2` | open the selected / Nth product |
| `compare 1 and 2` | compare two products |
| `tab` | cycle the suggested-query chips |
| `o` (in detail) | open the product in your browser |
| `esc` | back · `q` quit · `Ctrl-C` always quits |

## Brands

Brooklinen · Away · Warby Parker · IKEA · Ray-Ban · Allbirds · Alo Yoga ·
Nike · SKIMS · TUMI · lululemon · American Eagle · Abercrombie · Ashley
Furniture · Living Spaces · Sunglass Hut · Boll & Branch · Madison Reed ·
Rothy's · Tommy John · Drunk Elephant · Vuori

## How it works

`aigency` is a thin [Ink](https://github.com/vadimdemedes/ink) (React-for-the-terminal)
client over the Aigency shopping API: vector search + LLM-generated answers over
per-brand catalogs. Product images are pre-rendered to braille **server-side** (so the
CLI never has to bundle an image decoder) and streamed back as text.

Point it at a different backend with `AIGENCY_URL`:

```bash
AIGENCY_URL=http://localhost:3001 aigency ray-ban
```

## Develop

```bash
npm install
npm run dev -- ray-ban aviators   # run from source (tsx)
npm test                          # vitest
npm run preview                   # render component frames (no TTY needed)
npm run typecheck && npm run build
```

## License

MIT © Aigency
