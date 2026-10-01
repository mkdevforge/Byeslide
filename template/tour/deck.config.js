module.exports = {
  title: "Byeslide",
  description: "The Byeslide starter deck: presentations written as HTML, one file per slide.",
  width: 1920,
  height: 1080,
  margin: 0.04,
  minScale: 0.2,
  maxScale: 2,
  center: false,
  controls: true,
  progress: true,
  hash: true,
  slideNumber: false,
  transition: "slide",
  backgroundTransition: "fade",
  plugins: ["notes", "highlight", "search", "zoom"],
  reveal: {
    // Slides are flex columns (see styles.css). Reveal sets this display value on visible slides.
    display: "flex",
    // One PDF page per slide, with every fragment shown.
    pdfSeparateFragments: false
  }
};
