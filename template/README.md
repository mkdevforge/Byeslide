# Byeslide Deck

This deck is authored as HTML fragments in `slides/` and built into a Reveal.js deck at `dist/index.html`.

The starter deck demonstrates title, comparison, timeline, dashboard chart, embedded video, presenter-mode, and closing layouts.

```sh
pnpm install
pnpm install:browsers
pnpm build
pnpm preview
pnpm check
pnpm pdf
```

Preview serves the deck from `127.0.0.1:4173` by default. If that port is already in use, Byeslide prints the fallback URL it selected.

The preview URL is the audience presentation view. Add presenter notes with `<aside class="notes">` inside a slide, then press `S` in preview to open Reveal's speaker view.

Use `patterns/` as the vocabulary for new slides. Copy the closest pattern into `slides/NN-name.html`, replace the content, and keep layout changes local to that slide unless the theme itself needs to change.
