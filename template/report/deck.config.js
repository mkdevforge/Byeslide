module.exports = {
  title: "Acme Corp Q3 2026 business review",
  description: "A quarterly business review starter deck for a fictional company: results, charts, risks and decisions.",
  width: 1920,
  height: 1080,
  margin: 0.04,
  minScale: 0.2,
  maxScale: 2,
  center: false,
  controls: true,
  progress: true,
  hash: true,
  // Page numbers appear in the PDF and print view only (see showSlideNumber below).
  slideNumber: "c",
  transition: "fade",
  backgroundTransition: "fade",
  plugins: ["notes", "search", "zoom"],
  reveal: {
    // Slides are flex columns (see styles.css). Reveal sets this display value on visible slides.
    display: "flex",
    // One PDF page per slide, with every fragment shown.
    pdfSeparateFragments: false,
    // Number the pages of the PDF, so people can say "page 5" in the meeting.
    showSlideNumber: "print"
  }
};
