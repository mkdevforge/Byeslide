---
name: byeslide-author
description: Create or edit slides in this Byeslide deck from its patterns. Use when adding a slide, changing a slide, or turning content into slides.
---

# Byeslide Author

Use when creating or editing slides in this deck.

Workflow:
- Read the slide's content file in `content/` first; it has the words and speaker notes (see the byeslide-content skill).
- Read `patterns/` before editing; choose the closest example.
- Copy the chosen pattern into `slides/NN-name.html` and replace content.
- Keep each slide as a fragment or a single `<section>`. Put comments inside the section.
- Put presenter notes in an `<aside class="notes">` inside the slide when the speaker needs prompts.
- Use semantic classes from `styles.css`; use inline CSS variables only for one-off fit changes.
- Run `pnpm build` after content edits.
- Run `pnpm check` when text length, media, or layout changed.

The starter slides and patterns show structure and techniques. Their look is an example, not a house style: for a new deck, design a look that fits its subject in `theme.css` and `styles.css` (see the byeslide-theme skill) before filling slides.

Do not:
- Introduce viewport-responsive rules; the logical slide size is fixed.
- Create a component layer or import system.
- Edit unrelated slides to make a single-slide change.
- Put unescaped `<` or `>` inside code examples; write `&lt;` and `&gt;`.
