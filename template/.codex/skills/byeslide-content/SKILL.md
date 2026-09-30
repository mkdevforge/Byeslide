# Byeslide Content

Use when files in `content/` changed, or when asked to update the slides from the content.

`content/NN-name.md` holds the words, data and speaker notes for `slides/NN-name.html`. People edit these files without touching HTML. They describe what the audience sees and hears, not how it looks.

Workflow:
- Compare each content file with its slide file. Update the slide's text, lists, data and code examples to match.
- Put the `## Speaker notes` section into the slide's `<aside class="notes">`.
- Keep the slide's structure and classes. When the content no longer fits the layout, switch to a closer pattern from `patterns/`.
- A new content file means a new slide: copy the closest pattern into `slides/` with the same `NN-name`.
- A deleted content file: ask before deleting the slide.
- When you edit a slide directly, update its content file too, so both stay in sync.
- Run `byeslide build` and `byeslide check` when done.

Do not:
- Add colors, fonts or layout instructions to content files.
- Change `theme.css` or `styles.css` to make content fit; shorten or restructure the slide instead.
