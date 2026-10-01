# Start a deck

Start from this tour, a report or a lesson.

The commands, one per click, with what each prints:

```sh
pnpm dlx byeslide init my-deck --template report
# Created ~/my-deck from the report template.
cd my-deck
pnpm install
pnpm preview
# Preview: http://127.0.0.1:4173/index.html
```

Closing mark: **Byeslide**

## Speaker notes

Four commands, one per click. init asks which starter to copy: this tour, a quarterly report or a science lesson, each with its own patterns, theme and agent skills. The first edit is to replace the slides you do not need. Technique: a typed fragment style in styles.css that reveals each command one character at a time, and a slide background set with data-background-color.
