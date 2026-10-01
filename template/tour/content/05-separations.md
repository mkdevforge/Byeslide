# Content, theme and runtime stay apart

Like the plates in a print shop: each one carries a single layer, and the build prints them in register.

The three layers of a slide, pulled apart and put back together:

- **Content**: `slides/05-separations.html`
- **Theme**: `theme.css` and `styles.css`
- **Runtime**: Reveal.js: controls, progress, speaker view

The example slide in the diagram is the "Quarterly review" title again.

## Speaker notes

Click once to pull the slide apart into its three plates: blue is the content from this slide's file, pink is the theme, yellow is what Reveal adds at runtime. Click again to print them back in register. Technique: two empty fragments drive the whole animation through CSS :has(), with no JavaScript.
