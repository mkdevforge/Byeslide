# Byeslide Author

Use when creating or editing slides in this deck.

Workflow:
- Read `patterns/` before editing; choose the closest example.
- Copy the chosen pattern into `slides/NN-name.html` and replace content.
- Keep each slide as a fragment or a single `<section>`.
- Put presenter notes in an `<aside class="notes">` inside the slide when the speaker needs prompts.
- Use semantic classes from `styles.css`; use inline CSS variables only for one-off fit changes.
- Run `byeslide build` after content edits.
- Run `byeslide check` when text length, media, or layout changed.

Do not:
- Introduce viewport-responsive rules; the logical slide size is fixed.
- Create a component layer or import system.
- Edit unrelated slides to make a single-slide change.
