# To edit one slide, read one slide

At 14 slides, an agent reads 61 lines instead of 616.

A chart of lines read to edit one slide, as the deck grows from 1 to 60 slides:

- **One-file deck**: every slide. Lines read = slides × lines per slide.
- **Byeslide**: one slide file and the pattern it came from (17 lines). Lines read = lines per slide + 17.

Controls:

- **Slides in the deck**: 2 to 60, starts at 14.
- **Lines per slide**: 10 to 150, starts at 44.

The starting values are this deck's own averages: 44 lines per file in `slides/`, 17 per file in `patterns/`. The sentence at the top updates with the controls.

## Speaker notes

This is a model, and the formulas are on the slide: a one-file deck means reading every slide, Byeslide means reading one slide file and its pattern. The starting values are this deck's own averages. Drag the deck size to your team's typical deck. Technique: range inputs driving a Chart.js chart, with halftone fills made from a canvas pattern.
