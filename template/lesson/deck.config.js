module.exports = {
  title: "Why does the Moon have phases?",
  description: "A 45-minute science lesson for ages 10 to 12: a live Moon model, predictions, a hands-on activity and an exit ticket.",
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
  transition: "fade",
  backgroundTransition: "fade",
  plugins: ["notes", "search", "zoom"],
  reveal: {
    // Slides are flex columns (see styles.css). Reveal sets this display value on visible slides.
    display: "flex",
    // One PDF page per slide, with every fragment shown.
    pdfSeparateFragments: false
  }
};
