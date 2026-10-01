# Quarterly business review

A starter deck for a quarterly review: the Q3 2026 business review of Acme Corp, a company that makes industrial sensors and Pulse, the software that reads them. It is written for a leadership team and for people who read it later as a PDF or a one-file bundle, so every data slide states its finding in the headline and names its source.

Acme Corp, its people and all figures in this deck are fictional.

The slides are HTML files in `slides/`, built into a Reveal.js deck at `dist/index.html`.

```sh
pnpm install
pnpm install:browsers
pnpm build
pnpm preview
pnpm check
pnpm pdf
pnpm bundle
```

`pnpm pdf` writes `dist/deck.pdf`, with page numbers and every fragment shown. `pnpm bundle` writes the whole deck into one HTML file (`dist/<title>.html`) that anyone can open offline, for example from Teams or SharePoint.

## Content

`content/` has one Markdown file per slide with its words, figures and speaker notes: `content/05-kpis.md` goes with `slides/05-kpis.html`. Put this quarter's numbers there, then ask your AI assistant to update the slides from the content. The files say what the audience sees and hears, not how it looks; the look lives in `theme.css`, `styles.css` and the slide files.

## The starter deck

| Slide | Technique |
| --- | --- |
| `01-title` | The quarter as a scale with a tick per day; the needle sweeps to the last day with CSS only |
| `02-summary` | Readouts: big figures on a scale, the one that matters marked with the needle |
| `03-revenue` | Auto-animate carries the revenue readout from slide 2; Chart.js line against plan, labeled at the line ends, with a note pinned to a data point |
| `04-segments` | Bars against plan in HTML and CSS, no script; one fragment shows the shortfall and its cause |
| `05-kpis` | Table rows as fragments; ahead and behind shown with a triangle and a word |
| `06-customers` | Chart.js bars above and below a zero line, every bar labeled, the bar that matters in the needle color |
| `07-margin` | Waterfall from floating bars; empty fragments add one step per click through a slide script |
| `08-review` | Two parallel lists, with the item that matters marked |
| `09-risks` | Likelihood by impact matrix in CSS grid, shaded by one custom property per cell |
| `10-roadmap` | Milestones placed by date on a quarter scale, labels above and below |
| `11-decisions` | Asks with an owner and a date |
| `12-appendix` | Definitions and sources, so the PDF answers its own questions |

## The look

The deck reads like a measuring instrument: a white dial, anthracite type and marks, gray scales, and one orange needle. On every slide the needle (`--color-accent`) marks the one figure, bar, row or date the slide is about, and nothing else is orange. Keep that rule when you add slides: use `is-key` or `is-key-row` once per slide.

All type is Archivo. Its width axis gives each role its own shape: wide for the title, normal for text, condensed for big figures. Columns of figures use tabular numbers.

To give the deck your company's look, change the tokens in `theme.css` first: colors, the font, sizes and spacing. The charts read the same tokens.

## Authoring

Use `patterns/` as the vocabulary for new slides. Copy the closest pattern into `slides/NN-name.html`, replace the content, and keep layout changes local to that slide unless the theme itself needs to change.

Charts load `assets/vendor/chart.umd.js` and `assets/acme-charts.js`. The second file gives every chart the deck's fonts and colors, labels on bars and line ends instead of legends, and notes pinned to data points (`.chart-note`). The build keeps one copy of each script, however many slides list them. Each chart slide finds its own slide with `window.Byeslide.slideForScript(document.currentScript)` and draws once.

Add presenter notes with `<aside class="notes">` inside a slide, then press `S` in preview to open Reveal's speaker view. Press `P` in preview to write `dist/deck.pdf`, the same output as `pnpm pdf`; outside preview, `P` opens the browser print-to-PDF flow.

## Credits

Font: Archivo by Omnibus-Type, under the SIL Open Font License (`assets/fonts/archivo-OFL.txt`). Library: Chart.js, MIT license in `assets/vendor/chart-LICENSE.md`.
