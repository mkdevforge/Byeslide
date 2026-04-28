# Byeslide

Byeslide is an agent-first authoring layer for HTML presentations on top of Reveal.js. Slides stay as one HTML file per slide, design tokens live in CSS custom properties, and the build output is a Reveal-compatible `dist/index.html`.

The default starter uses semantic CSS classes instead of Tailwind utilities. That keeps slide files short enough for agents to edit reliably while still allowing one-off CSS variable overrides on individual slides.

## Install

```sh
pnpm install
```

During development, run the local CLI directly:

```sh
node src/cli.js --help
```

## Create a Deck

```sh
pnpm dlx byeslide init my-deck
cd my-deck
pnpm install
pnpm build
pnpm preview
```

The generated deck structure is:

```text
my-deck/
  deck.config.js
  theme.css
  styles.css
  patterns/
  slides/
  assets/
  dist/
```

## Commands

```sh
byeslide init [dir] [--force]
byeslide build [dir] [--out dist] [--no-clean]
byeslide preview [dir] [--host 127.0.0.1] [--port 4173] [--out dist]
byeslide check [dir] [--json] [--out dist] [--no-clean]
byeslide pdf [dir] [--output dist/deck.pdf] [--out dist] [--no-clean]
byeslide patterns [dir]
byeslide install-browsers [chromium]
```

`build` writes a standalone Reveal deck to `dist/index.html` and copies Reveal runtime assets locally. `preview` rebuilds on file changes and injects a live reload hook. `check` opens the deck in Chromium and reports slide overflow against the fixed logical viewport. `pdf` uses the same HTML deck with `?view=print`.

`preview` listens on `127.0.0.1:4173` by default. If that port is occupied, it tries the next available ports and prints the actual URL. IPv6 hosts are supported, for example `--host ::1` prints a bracketed URL such as `http://[::1]:4173/`.

If `check` or `pdf` cannot find a browser, run:

```sh
byeslide install-browsers
```

## Authoring Model

1. Read `patterns/` and choose the closest slide pattern.
2. Copy that markup into `slides/NN-name.html`.
3. Replace the content and make small structural edits only where needed.
4. Run `byeslide build` and `byeslide check`.

Slide files may be fragments or full HTML documents. Fragments are the default and are wrapped in Reveal `<section>` elements during build.
