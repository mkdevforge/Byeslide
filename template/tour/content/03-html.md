# The same title, as a Byeslide slide

The slide file holds the words. Position, size and type come from `styles.css`, written once for every slide.

Example: the same "Quarterly review" title as a slide file.

```html
<section class="slide">
  <h1 class="title">Quarterly review</h1>
</section>
```

## Speaker notes

Same words, three lines. The layout lives in styles.css and theme.css, so an agent or a person can change the words without touching coordinates. Technique: two slides with data-auto-animate, and matching data-id attributes on the parts that should move.
