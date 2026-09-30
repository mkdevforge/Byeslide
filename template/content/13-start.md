# Start a deck

You get this deck. Replace it one slide at a time, or ask an agent to.

The commands, one per click, with what each prints:

```sh
pnpm dlx byeslide init my-deck
# Initialized Byeslide deck in ~/my-deck
cd my-deck
pnpm install
pnpm preview
# Preview: http://127.0.0.1:4173/index.html
```

Closing mark: **Byeslide**

## Speaker notes

Four commands, one per click. init copies exactly this deck, with its patterns, theme and agent skills, so the first edit is to replace slides you do not need. Technique: a typed fragment style in styles.css that reveals each command one character at a time, and a slide background set with data-background-color.
