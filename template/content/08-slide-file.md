# A slide file, top to bottom

Before the walkthrough: **Everything the slide needs**. Content, steps, a chart and notes, in one file.

The walkthrough, one part per click:

1. **A section**: classes come from `styles.css`, so the file holds no layout.
2. **Fragments**: each one appears on the next click.
3. **Its own scripts**: load a library and set up the slide. `slideForScript` finds the slide the script came from.
4. **Speaker notes**: press S to read them in the speaker view.

The example file:

```html
<section class="slide">
  <h2 class="heading">Pilot starts in March</h2>
  <ul class="points">
    <li class="fragment">Two teams onboard</li>
    <li class="fragment">Weekly check-ins</li>
  </ul>
  <canvas data-chart></canvas>
  <script src="./assets/vendor/chart.umd.js"></script>
  <script>
    const slide = Byeslide.slideForScript(document.currentScript);
    new Chart(slide.querySelector("[data-chart]"), config);
  </script>
  <aside class="notes">Pause for questions.</aside>
</section>
```

## Speaker notes

Step through the file: each click highlights one part and changes the note on the right. This is also what an agent reads when it edits a slide: one short file. Technique: the highlight plugin's data-line-numbers steps, synced to the notes with data-fragment-index.
