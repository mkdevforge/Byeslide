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
byeslide --version
byeslide version
byeslide init [dir] [--force]
byeslide build [dir] [--out dist] [--no-clean]
byeslide preview [dir] [--host 127.0.0.1] [--port 4173] [--out dist]
byeslide check [dir] [--json] [--out dist] [--no-clean]
byeslide pdf [dir] [--output dist/deck.pdf] [--out dist] [--no-clean]
byeslide patterns [dir]
byeslide install-browsers [chromium]
```

`build` writes a standalone Reveal deck to `dist/index.html` and copies Reveal runtime assets locally. `preview` rebuilds on file changes and injects a live reload hook. `check` opens the deck in Chromium and reports slide overflow against the fixed logical viewport. `pdf` uses the same HTML deck with `?view=print`.

Built decks include a generator meta tag and expose `window.Byeslide.version`, so hosted decks can be traced back to the Byeslide package version that produced them.

`preview` listens on `127.0.0.1:4173` by default. If that port is occupied, it tries the next available ports and prints the actual URL. IPv6 hosts are supported, for example `--host ::1` prints a bracketed URL such as `http://[::1]:4173/`.

The normal preview URL is the audience presentation view. Speaker notes live in `<aside class="notes">` inside each slide and are opened from preview with the Reveal speaker view shortcut, `S`. Pressing `P` in preview writes `dist/deck.pdf`, matching the generated deck's `pnpm pdf` script; in a static build it falls back to the browser's print-to-PDF flow. In print view, press `Esc` or `P` again to return to the live deck.

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

Slide files may also include browser-side dependencies and setup scripts. External `src` scripts are moved after Reveal initialization and repeated dependency tags are deduped; add `data-byeslide-repeat` to an external setup script when it must run once per slide. Inline scripts are preserved per slide. Use `window.Byeslide.slideForScript(document.currentScript)` in classic inline setup scripts, or `window.Byeslide.slideForScript(import.meta)` / `import.meta.byeslideSlide` in inline module scripts, when setup code needs to query the slide it came from. The starter deck includes Three.js and two Chart.js slides that demonstrate this model.
