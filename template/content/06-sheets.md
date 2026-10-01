# Every slide is its own file

This deck has 14 files in `slides/`. The build stacks them into one `dist/index.html`.

The number of files is counted from the deck when it runs.

## Speaker notes

Each sheet is one real file from this deck, fanned out in slide order; the names are read from the built page. Then they fly into one stack: that is the build, slides/ goes in and one dist/index.html comes out. Move the mouse over the slide to tilt the camera. Technique: a Three.js module imported from assets/, with the library kept in assets/vendor/ so the slide works offline.
