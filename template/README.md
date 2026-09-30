# Byeslide Deck

This deck is authored as HTML files in `slides/` and built into a Reveal.js deck at `dist/index.html`.

```sh
pnpm install
pnpm install:browsers
pnpm build
pnpm preview
pnpm check
pnpm pdf
pnpm bundle
```

`pnpm bundle` writes the whole deck into one HTML file (`dist/<title>.html`) that anyone can download and open offline, with animations, video and the speaker view working.

## Content

`content/` has one Markdown file per slide with its words and speaker notes: `content/04-folder.md` goes with `slides/04-folder.html`. Edit the words there, then ask your AI assistant to update the slides from the content. The files say what the audience sees and hears, not how it looks; the look lives in `theme.css`, `styles.css` and the slide files.

Preview serves the deck from `127.0.0.1:4173` by default. If that port is already in use, Byeslide prints the fallback URL it selected.

## The starter deck

The 13 slides present Byeslide, and each one shows a technique you can copy:

| Slide | Technique |
| --- | --- |
| `01-title` | Overprinted title: the same text in two inks, the second plate sliding into register |
| `02-pptx`, `03-html` | Auto-animate between two slides with matching `data-id` |
| `04-folder` | Fragments with `r-stack`: one callout at a time in the same place |
| `05-separations` | CSS 3D driven by empty fragments and `:has()`, without JavaScript |
| `06-sheets` | Full-bleed Three.js scene from a local module |
| `07-inks` | Slide script that changes theme tokens live |
| `08-slide-file` | Code walkthrough with the highlight plugin's line steps |
| `09-check` | Buttons and editable text inside a slide |
| `10-context` | Chart.js with range inputs and halftone fills |
| `11-live-reload` | Local video |
| `12-present` | Custom fragment style (`ink-in`) |
| `13-start` | Typed terminal lines and a colored slide background |

The folio at the bottom left of each slide prints the file it was built from. Remove the folio block in `styles.css` for a real talk.

The look (riso inks, overprint, Bricolage Grotesque and Martian Mono) is an example, not a house style. Give each deck a look that fits its subject by changing `theme.css` and `styles.css`.

## Authoring

Use `patterns/` as the vocabulary for new slides. Copy the closest pattern into `slides/NN-name.html`, replace the content, and keep layout changes local to that slide unless the theme itself needs to change.

Add presenter notes with `<aside class="notes">` inside a slide, then press `S` in preview to open Reveal's speaker view. Press `P` in preview to write `dist/deck.pdf`, the same output as `pnpm pdf`; outside preview, `P` opens the browser print-to-PDF flow. In print view, press `Esc` or `P` again to return to the live deck.

Slide-contained browser dependencies live under `assets/vendor/` and can be loaded directly from a slide. The Three.js slide imports `assets/sheets-scene.js`, which imports the local vendor build; the Chart.js slide loads `assets/vendor/chart.umd.js`.

When a slide includes inline setup scripts, use `window.Byeslide.slideForScript(document.currentScript)` in classic scripts, or `window.Byeslide.slideForScript(import.meta)` / `import.meta.byeslideSlide` in inline module scripts, to find the source slide after build. The builder keeps each inline setup script and dedupes repeated external `src` dependencies, so multiple slides can include the same library while still running independent slide-local setup code. Add `data-byeslide-repeat` to an external setup script when it must run once per slide instead of being deduped as a shared dependency.

## Credits

Fonts: Bricolage Grotesque and Martian Mono, under the SIL Open Font License (`assets/fonts/*-OFL.txt`). Libraries: Three.js and Chart.js, licenses in `assets/vendor/`.
