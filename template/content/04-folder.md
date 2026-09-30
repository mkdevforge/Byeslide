# A deck is a folder you can read

Seven entries, one job each. They open one at a time.

- `deck.config.js`, **Settings**: title, slide size, transitions and the Reveal plugins to load.
- `theme.css`, **Design tokens**: fonts, inks and sizes as CSS custom properties. Change a value and every slide follows.
- `styles.css`, **Layout classes**: the classes slides share, like `.split` and `.listing`.
- `patterns/`, **Example slides**: to start a new slide, copy the closest pattern and replace its content.
- `slides/`, **One file per slide**: file names set the order. Each file holds its own notes and scripts.
- `assets/`, **Everything the slides load**: fonts, images, video and libraries stay with the deck, so it runs offline.
- `dist/`, **Build output**: `byeslide build` writes `dist/index.html` and the Reveal runtime. Nobody edits it by hand.

## Speaker notes

Walk the folder one entry per click. The point: nothing is hidden in a binary, and each file has one job, so a change lands in one place. Technique: fragments with matching data-fragment-index values, and Reveal's r-stack to show one callout at a time in the same spot.
