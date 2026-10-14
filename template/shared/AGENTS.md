# Agent guide

This is a Byeslide deck. `pnpm build` turns `slides/*.html` into one Reveal.js deck at `dist/index.html`. Every slide is a fixed canvas (1920 × 1080 px unless `deck.config.js` says otherwise), and Reveal scales it to the screen.

## Files

- `content/NN-name.md`: the words, data and speaker notes for `slides/NN-name.html`.
- `slides/NN-name.html`: one slide per file, in file-name order. Each file is one `<section class="slide">`.
- `patterns/`: starting markup for common slides. Copy the closest one into `slides/`, then change it.
- `README.md`: a table of the starter slides and the technique each one shows. Read it before you search `styles.css`.
- `theme.css`: design tokens (fonts, colors, spacing, type sizes). `styles.css`: the classes that use them.
- `deck.config.js`: title, size and Reveal options.

Detailed workflows are in `.codex/skills/`. Read the one that fits the task:

- `byeslide-author/SKILL.md`: add or change slides.
- `byeslide-content/SKILL.md`: update slides from `content/`.
- `byeslide-theme/SKILL.md`: change the look.
- `byeslide-build/SKILL.md`: preview, check, export and bundle.

## Build and check

1. `pnpm build`
2. `pnpm check` lists elements that overflow a slide.
3. `pnpm screenshot` writes `dist/screenshots/slide-NN.png` and `dist/screenshots/sheet.png`, a grid of all slides. Look at `sheet.png` first. Open a single slide image only to check detail. After a fix, `pnpm screenshot --slides 3,5` shoots only those slides.
4. `pnpm pdf` writes `dist/deck.pdf`.

Each of these commands rebuilds the deck and empties `dist/` first, so run `pnpm pdf` last.

Screenshots and the PDF show each slide at its final step: all fragments visible, and CSS animations at their end state.

## Layout rules

- Slides are flex columns. `deck.config.js` sets Reveal's `display` option to `flex`, and `styles.css` keeps it in print. A `display` rule on a section has no effect, because Reveal sets the display value itself.
- Set slide padding with `padding` on the section, or change the `--slide-padding` token. The PDF uses the same padding as the live deck.
- `.slide` has `overflow: hidden`. Text that does not fit is cut off. `pnpm check` finds it.
- Speaker notes go in `<aside class="notes">` inside the section. Press `S` in `pnpm preview` to see them.
- For step-by-step builds, add `class="fragment"` to elements.
- For motion, write the end state as the normal style, and put the motion in a CSS animation under `.reveal .slides section.present`. Reveal adds `present` to the visible slide, so the animation plays each time the slide opens.
- Slide scripts go inside the slide file. In a classic `<script>`, `window.Byeslide.slideForScript(document.currentScript)` returns the slide element.
