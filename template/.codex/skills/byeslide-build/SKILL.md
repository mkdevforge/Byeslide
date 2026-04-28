# Byeslide Build

Use for preview, validation, and export.

Commands:
- `byeslide build --out dist` writes `dist/index.html`.
- `byeslide preview --host 127.0.0.1 --port 4173` serves the deck and rebuilds on changes.
- `byeslide check --out dist` opens Chromium and reports fixed-viewport overflow.
- `byeslide pdf --output dist/deck.pdf --out dist` exports the print view.
- `byeslide patterns` lists available pattern files.

Preview retries nearby ports when the requested port is occupied and prints the actual URL. IPv6 hosts such as `::1` are supported.

Modes:
- Live deck: `dist/index.html`
- Speaker view: press `S` from the live deck.
- Print view: `dist/index.html?view=print`
- Scroll view: `dist/index.html?view=scroll`

Do not edit files under `dist/`; rebuild instead.
