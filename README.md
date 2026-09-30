# Byeslide

Byeslide is an agent-first authoring layer for HTML presentations on top of Reveal.js. Slides stay as one HTML file per slide, design tokens live in CSS custom properties, and the build output is a Reveal-compatible `dist/index.html`.

Documentation: https://byeslide.mkdevforge.com/

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
  content/
  patterns/
  slides/
  assets/
  dist/
```

`content/` has one Markdown file per slide, with the slide's words and speaker notes: `content/01-title.md` goes with `slides/01-title.html`. People who don't write HTML can edit these files and ask an agent to update the slides; the files describe what the audience sees and hears, not how it looks.

## Commands

```sh
byeslide --version
byeslide version
byeslide init [dir] [--force]
byeslide build [dir] [--out dist] [--no-clean]
byeslide preview [dir] [--host 127.0.0.1] [--port 4173] [--out dist]
byeslide check [dir] [--json] [--out dist] [--no-clean]
byeslide pdf [dir] [--output dist/deck.pdf] [--out dist] [--no-clean]
byeslide bundle [dir] [--output dist/<title>.html] [--max-asset-mb 20] [--link-large-media] [--out dist] [--no-clean]
byeslide patterns [dir]
byeslide install-browsers [chromium]
```

`build` writes a standalone Reveal deck to `dist/index.html` and copies Reveal runtime assets locally. `preview` rebuilds on file changes and injects a live reload hook. `check` opens the deck in Chromium and reports slide overflow against the fixed logical viewport. `pdf` uses the same HTML deck with `?view=print`.

Built decks include a generator meta tag and expose `window.Byeslide.version`, so hosted decks can be traced back to the Byeslide package version that produced them.

`preview` listens on `127.0.0.1:4173` by default. If that port is occupied, it tries the next available ports and prints the actual URL. IPv6 hosts are supported, for example `--host ::1` prints a bracketed URL such as `http://[::1]:4173/`.

The normal preview URL is the audience presentation view. Speaker notes live in `<aside class="notes">` inside each slide and are opened from preview with the Reveal speaker view shortcut, `S`. Pressing `P` in preview writes `dist/deck.pdf`, matching the generated deck's `pnpm pdf` script; in a static build it falls back to the browser's print-to-PDF flow. In print view, press `Esc` or `P` again to return to the live deck.

## Share as One File

`byeslide bundle` builds the deck and writes it into one HTML file, `dist/<title>.html` by default. Anyone can download it, for example from Teams or SharePoint, and open it in a browser without a server or a network connection. Animations, fragments, videos, 3D scenes, charts and the speaker view (`S`) all work.

Use `bundle` when people should get the live presentation. Use `pdf` when they need a static document to print or annotate: it opens anywhere, but loses animation and interaction.

What goes into the file:

- Stylesheets, fonts and images, including `url()` in CSS and `srcset`.
- Scripts and ES modules with their imports. Modules go into an import map as `data:` URLs, so top-level await keeps working.
- Video and audio up to `--max-asset-mb` (20 MB per file by default). A larger file stops the bundle with a message that names it. Raise the limit, or pass `--link-large-media` to keep a relative link to that file and send it along with the bundle.
- Local iframes, which become `srcdoc`, bundled the same way. An iframe that points at `page.html#part` still opens at `#part`.
- Reveal attributes such as `data-src`, `data-background-image` and `data-background-video`.

Video makes the file big: every megabyte of video adds about 1.33 MB to the HTML.

Limits: files that scripts load while the deck runs, such as `fetch("assets/data.json")` or `new URL("./x.png", import.meta.url)`, are not bundled; `bundle` warns with the file and line. Anything loaded from `http(s)://` still needs a network, and `bundle` warns about each such reference. The command prints the file size and the largest inlined files.

If `check` or `pdf` cannot find a browser, run:

```sh
byeslide install-browsers
```

## Authoring Model

1. Write or update the slide's words and notes in `content/NN-name.md`.
2. Read `patterns/` and choose the closest slide pattern.
3. Copy that markup into `slides/NN-name.html`.
4. Replace the content and make small structural edits only where needed.
5. Run `byeslide build` and `byeslide check`.

Slide files may be fragments or full HTML documents. Fragments are the default and are wrapped in Reveal `<section>` elements during build.

Slide files may also include browser-side dependencies and setup scripts. External `src` scripts are moved after Reveal initialization and repeated dependency tags are deduped; add `data-byeslide-repeat` to an external setup script when it must run once per slide. Inline scripts are preserved per slide. Use `window.Byeslide.slideForScript(document.currentScript)` in classic inline setup scripts, or `window.Byeslide.slideForScript(import.meta)` / `import.meta.byeslideSlide` in inline module scripts, when setup code needs to query the slide it came from. The starter deck includes a Three.js slide and a Chart.js slide that demonstrate this model.
