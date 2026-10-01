# Quarterly business review

A starter deck in the style of a board report: the Q3 2026 business review of Acme Corp, a company that makes industrial sensors and Pulse, the software that reads them. Every content page states its conclusion in an action title, proves it with a numbered exhibit, and names its source, so the deck reads as well as a PDF on Teams or SharePoint as it does in the meeting.

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

`pnpm pdf` writes `dist/deck.pdf` with every fragment shown. `pnpm bundle` writes the whole deck into one HTML file (`dist/<title>.html`) that anyone can open offline.

## Content

`content/` has one Markdown file per slide with its words, figures and speaker notes: `content/09-scorecard.md` goes with `slides/09-scorecard.html`. Put this quarter's numbers there, then ask your AI assistant to update the slides from the content. The files say what the audience sees and hears, not how it looks; the look lives in `theme.css`, `styles.css` and the slide files.

## The starter deck

| Slide | Technique |
| --- | --- |
| `01-title` | Navy cover; the quarter as a scale with a tick per day, and a needle that sweeps to the last day (CSS only) |
| `02-summary` | Executive summary as a pyramid: the title is the answer, five messages support it, each with page references that follow the slide order; messages 2 to 5 build one per click |
| `03-contents` | Contents with page numbers taken from the section dividers |
| `04-performance`, `10-outlook`, `13-decisions` | Section dividers: `data-section` starts a section; the deck scale at the foot marks this section |
| `05-revenue` | Chart.js line against plan, labeled at the line ends, the point that matters in copper, and a takeaway box |
| `06-segments` | Bars against plan in HTML and CSS, the shortfall hatched, with numbered markers and matching notes |
| `07-customers` | Chart.js bars above and below a zero line, with numbered markers pinned to bars |
| `08-margin` | Waterfall from floating bars; each click grows the next step |
| `09-scorecard` | Table with status dots and words, and the row that matters marked |
| `11-risks` | 2x2 matrix with numbered risks placed by position, beside the risk table |
| `12-roadmap` | Gantt roadmap: workstreams as rows, months as columns, milestones as diamonds, all placed by date |
| `14-options` | Comparison table with Harvey balls and a recommendation box |
| `15-next-steps` | Decisions with owner and date, then next steps |
| `16-appendix` | Definitions and data sources |

## Page furniture

Each content page has a tracker at the top (the deck's sections, with a needle at this page), an exhibit number, and a footer with the source, a confidentiality line and the page number. `assets/acme-deck.js` fills these in from the order of the slides, so they stay right when you add, remove or reorder slides. A slide only marks where they go:

- `data-section="Name"` on the first slide of a section;
- `<nav class="tracker" data-tracker>` for the tracker;
- `data-page-number` for the page number, `data-exhibit-number` for the exhibit number;
- `data-page-of="revenue"` for the page of the slide whose `id` is `revenue`. Give each slide a unique `id`.

The confidentiality line is `--confidential` in `theme.css`.

## The look

White pages, navy for text and the main data, graded blues and grays for everything else, and copper as the one accent. Copper marks the point of each slide, once: the bar, row, step or date the action title is about. Green and red appear only on small status dots, always next to a word.

Action titles, the cover and section dividers use Newsreader, a serif with optical sizes, so it stays sharp at title sizes. Everything else uses Instrument Sans, with tabular figures in tables. The signature is a measuring scale, because Acme makes measuring instruments: the cover reads the quarter on a scale, and the tracker shows the deck as a scale with a needle at the current page.

To give the deck your company's look, change the tokens in `theme.css` first: colors, fonts, sizes and spacing. The charts read the same tokens.

## Authoring

Use `patterns/` as the vocabulary for new slides: title, executive summary, contents, section divider, chart with takeaway box, chart with numbered callouts, table with status, waterfall, 2x2 matrix, Gantt roadmap, text page, decisions and next steps, and appendix. Copy the closest pattern into `slides/NN-name.html`, give it a unique `id`, and replace the content.

Charts load `assets/vendor/chart.umd.js` and `assets/acme-charts.js`. The second file gives every chart the deck's fonts and colors, labels on bars and line ends instead of legends, and numbered markers or notes pinned to data points. The build keeps one copy of each script, however many slides list them. Each chart slide finds its own slide with `window.Byeslide.slideForScript(document.currentScript)` and draws once.

Add presenter notes with `<aside class="notes">` inside a slide, then press `S` in preview to open Reveal's speaker view.

## Credits

Fonts: Newsreader (The Newsreader Project Authors) and Instrument Sans (The Instrument Sans Project Authors), both under the SIL Open Font License (`assets/fonts/*-OFL.txt`). Library: Chart.js, MIT license in `assets/vendor/chart-LICENSE.md`.
