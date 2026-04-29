# Byeslide Deck

This deck is authored as HTML fragments in `slides/` and built into a Reveal.js deck at `dist/index.html`.

The starter deck demonstrates title, comparison, timeline, dashboard chart, embedded video, Three.js 3D animation, an interactive Chart.js trend, a parameterized Chart.js equation model, presenter-mode, and closing layouts.

```sh
pnpm install
pnpm install:browsers
pnpm build
pnpm preview
pnpm check
pnpm pdf
```

Preview serves the deck from `127.0.0.1:4173` by default. If that port is already in use, Byeslide prints the fallback URL it selected.

The preview URL is the audience presentation view. Add presenter notes with `<aside class="notes">` inside a slide, then press `S` in preview to open Reveal's speaker view. Press `P` in preview to write `dist/deck.pdf`, the same output as `pnpm pdf`; outside preview, `P` opens the browser print-to-PDF flow. In print view, press `Esc` or `P` again to return to the live deck.

Slide-contained browser dependencies can live under `assets/vendor/` and be imported directly from a slide. The Three.js example imports the local vendor build from `assets/three-demo.js`; the Chart.js examples include `assets/vendor/chart.umd.js` from two different slides.

When a slide includes inline setup scripts, use `window.Byeslide.slideForScript(document.currentScript)` in classic scripts, or `window.Byeslide.slideForScript(import.meta)` / `import.meta.byeslideSlide` in inline module scripts, to find the source slide after build. The builder keeps each inline setup script and dedupes repeated external `src` dependencies, so multiple slides can include the same library while still running independent slide-local setup code. Add `data-byeslide-repeat` to an external setup script when it must run once per slide instead of being deduped as a shared dependency.

Use `patterns/` as the vocabulary for new slides. Copy the closest pattern into `slides/NN-name.html`, replace the content, and keep layout changes local to that slide unless the theme itself needs to change.
