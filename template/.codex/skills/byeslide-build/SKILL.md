# Byeslide Build

Use for preview, validation, and export.

Commands:
- `byeslide build` writes `dist/index.html`.
- `byeslide preview` serves the deck and rebuilds on changes.
- `byeslide check` opens Chromium and reports fixed-viewport overflow.
- `byeslide pdf --output dist/deck.pdf` exports the print view.
- `byeslide patterns` lists available pattern files.

Modes:
- Live deck: `dist/index.html`
- Print view: `dist/index.html?view=print`
- Scroll view: `dist/index.html?view=scroll`

Do not edit files under `dist/`; rebuild instead.
