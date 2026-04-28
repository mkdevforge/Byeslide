# Byeslide Deck

This deck is authored as HTML fragments in `slides/` and built into a Reveal.js deck at `dist/index.html`.

```sh
npm install
npm run install:browsers
npm run build
npm run preview
npm run check
npm run pdf
```

Preview serves the deck from `127.0.0.1:4173` by default. If that port is already in use, Byeslide prints the fallback URL it selected.

Use `patterns/` as the vocabulary for new slides. Copy the closest pattern into `slides/NN-name.html`, replace the content, and keep layout changes local to that slide unless the theme itself needs to change.
