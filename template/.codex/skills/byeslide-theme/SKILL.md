---
name: byeslide-theme
description: Change the look of this Byeslide deck through theme.css and styles.css. Use when changing fonts, colors, sizes or the visual direction.
---

# Byeslide Theme

Use when editing `theme.css` or changing visual direction.

Read:
- `theme.css` for tokens and `@font-face` rules.
- `styles.css` for where tokens are consumed.
- `patterns/` to verify the theme still fits real slide structures.

Token groups:
- Fonts: `--font-sans`, `--font-mono` (font files in `assets/fonts/`)
- Colors: `--color-paper`, `--color-text`, `--color-text-soft`, `--ink-1`, `--ink-2`, `--ink-3`
- Motion: `--register-start`, `--register-rest`
- Layout: `--slide-padding`, `--slide-gap`, `--gutter`, `--radius`, `--rule-width`
- Type: `--text-small`, `--text-body`, `--text-lead`, `--text-h3`, `--text-h2`, `--text-h1`, `--text-display`, `--text-code`

Charts and the Three.js scene read the color and font tokens at runtime, so they follow token changes.

A new deck should get its own look: choose fonts, colors and type scale for the subject and audience, then check every slide and pattern still reads well.

Do not:
- Replace tokens with hard-coded values across slides.
- Add responsive breakpoints.
- Load fonts or styles from a CDN; keep them in `assets/` so the deck works offline.
- Restyle one slide globally unless the pattern vocabulary should change.
