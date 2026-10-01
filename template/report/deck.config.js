module.exports = {
  title: "Acme Corp Q3 2026 business review",
  description: "A quarterly business review in the style of a board report, for a fictional company: results, risks, roadmap and decisions.",
  width: 1920,
  height: 1080,
  margin: 0.04,
  minScale: 0.2,
  maxScale: 2,
  center: false,
  controls: true,
  progress: true,
  hash: true,
  // Page numbers are part of each page's footer (assets/acme-deck.js fills them in).
  slideNumber: false,
  transition: "fade",
  backgroundTransition: "fade",
  plugins: ["notes", "search", "zoom"],
  reveal: {
    // Slides are flex columns (see styles.css). Reveal sets this display value on visible slides.
    display: "flex",
    // One PDF page per slide, with every fragment shown.
    pdfSeparateFragments: false,
    transitionSpeed: "fast"
  }
};
