# Change three values, recolor every slide

Pick a set. The change is live, so the title, the diagrams and the 3D sheets change too.

The three values, as they appear in `theme.css`:

```css
:root {
  --ink-1: #0078bf;
  --ink-2: #ff48b0;
  --ink-3: #ffe800;
}
```

Ink sets to choose from:

- Blue, pink, yellow: #0078bf, #ff48b0, #ffe800
- Teal, orange, sunflower: #00838a, #ff6c2f, #ffb511
- Purple, red, mint: #765ba7, #f15060, #82d8d5
- Navy, coral, aqua: #3d5588, #ff7477, #5ec8e5

## Speaker notes

Click a set. It sets the same three custom properties that theme.css declares, so every slide recolors at once: go back to the title to show it. The 3D sheets listen for a byeslide:inks event and repaint. Reloading the page restores the theme from theme.css. Technique: a slide-local script that finds its slide with Byeslide.slideForScript.
