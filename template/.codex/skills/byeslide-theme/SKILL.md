# Byeslide Theme

Use when editing `theme.css` or changing visual direction.

Read:
- `theme.css` for tokens.
- `styles.css` for where tokens are consumed.
- `patterns/` to verify the theme still fits real slide structures.

Token groups:
- Fonts: `--font-sans`, `--font-serif`, `--font-mono`
- Colors: `--color-ink`, `--color-muted`, `--color-page`, `--color-surface`, `--color-accent`, `--color-warm`, `--color-green`, `--color-dark`
- Layout: `--slide-padding`, `--slide-gap`, `--radius`, `--rule-width`
- Type: `--text-kicker`, `--text-body`, `--text-small`, `--text-h1`, `--text-h2`, `--text-h3`

Do not:
- Replace tokens with hard-coded values across slides.
- Add responsive breakpoints.
- Restyle one slide globally unless the pattern vocabulary should change.
