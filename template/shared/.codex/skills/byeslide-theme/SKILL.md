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

`theme.css` lists every token in groups: fonts (files in `assets/fonts/`), colors, layout and type sizes. Each starter template has its own tokens, so read them there.

Charts and other slide scripts read the color and font tokens at runtime, so they follow token changes.

A new deck should get its own look: choose fonts, colors and type scale for the subject and audience, then check every slide and pattern still reads well.

Do not:
- Replace tokens with hard-coded values across slides.
- Add responsive breakpoints.
- Load fonts or styles from a CDN; keep them in `assets/` so the deck works offline.
- Restyle one slide globally unless the pattern vocabulary should change.
