# PRD (rough): Agent-first HTML presentations on Reveal.js

## Problem

PowerPoint is the wrong abstraction for the LLM era. PPTX bakes content, layout, and theme into a single binary blob with absolute coordinate positioning, which is exactly the wrong shape for an agent: agents reason about semantic content well and 2D pixel layout poorly. Existing "code-based" alternatives (Marp, Slidev) constrain the medium too much — they replace HTML/CSS expressiveness with a fixed Markdown vocabulary and lose what's good about the web.

The bet: as content authoring shifts to agents, the artifact people share will shift too. HTML for authoring and presenting, PDF for sharing static copies. PPTX becomes legacy.

## Vision

A tool that lets an agent (and a human) compose presentations by writing HTML/CSS slide files, with CSS custom properties for theme tokens and a folder of example slide patterns the agent reads as reference. The styling approach (Tailwind utilities vs semantic CSS classes) is an open question to resolve via prototyping — see open questions. Output is a Reveal.js-compatible deck — we do not rebuild the presentation runtime.

The thing we are actually building is the **agent-authoring layer** on top of Reveal. Reveal already solved the runtime (sectioned HTML, transform scaling to viewport, transitions, speaker view, PDF export). The gap is everything upstream of that: a sensible default design system, a vocabulary of example slides, per-slide file structure, and the build/preview tooling that makes agent edits cheap.

## Core principles

- **HTML/CSS is the source of truth.** No YAML DSL, no Markdown frontmatter as the primary authoring format. The full expressiveness of the web is the point.
- **Reveal.js is the runtime, not a dependency to abstract over.** Output is plain Reveal HTML. Users get the entire Reveal ecosystem (plugins, themes, PDF export, speaker view) for free.
- **One slide per file.** Agents edit slide N without loading slides 1–(N-1). Small context, localized diffs, reviewable changes.
- **Design tokens as CSS custom properties.** Theme lives in `:root` variables. Theme swap = changing variable values. This holds regardless of which styling approach (Tailwind or semantic CSS) wins the prototype.
- **Examples, not abstractions.** Slide patterns are plain HTML files the agent reads and copies from. No component layer, no variant system, no import path. The agent edits markup directly.
- **Fixed-viewport authoring.** Slides are a known logical size (e.g. 1920×1080). Overflow is visible and the agent's problem to solve, not silently paginated.

## Architecture sketch

```
my-deck/
├── deck.config.js          # title, dimensions, theme choice, plugins
├── theme.css               # CSS custom properties (the design tokens)
├── tailwind.config.js      # IF Tailwind wins prototype: slide-tuned config
│                           # IF semantic CSS wins: replaced by styles.css
├── patterns/               # example slides the agent reads and copies from
│   ├── title.html
│   ├── two-column.html
│   ├── quote.html
│   ├── comparison.html
│   └── ...
├── slides/                 # the actual deck content
│   ├── 01-title.html
│   ├── 02-agenda.html
│   └── ...
└── dist/                   # build output: a Reveal-compatible index.html
```

Build step: concatenate `slides/*.html` into Reveal's expected `<section>` structure, inject theme + styling layer, output a single `dist/index.html` that runs anywhere. PDF export is `dist/index.html?view=print` through Reveal's existing path.

## Output formats

The same `dist/index.html` serves three roles, each via Reveal's built-in modes:

- **Live presentation.** What you actually present from. Full Reveal runtime — speaker view (`S` key) with current slide, next slide, notes, clock, and timer; transitions; fragments; embedded video; keyboard shortcuts. This is the primary mode and the reason HTML beats PDF for the act of presenting.
- **PDF export.** What you share with people who weren't there, or who want a static copy. `?view=print` produces a print-ready version; headless Chromium turns it into a PDF. Universally openable, no JS required.
- **Standalone web deck.** Same `index.html`, just hosted somewhere. Reveal's scroll view (`?view=scroll`) turns the deck into a scrollable page for async reading — a nice middle ground between "click-through deck" and "blog post" for things meant to be read rather than presented.

This is why HTML isn't just an authoring intermediate — it's the live presentation surface. PDF is downstream of it.

## AI integration

Agent integration is via a small set of focused skills, not a single monolithic one. Each skill is a router — it points the agent at the files that carry the real knowledge (`patterns/`, `theme.css`) rather than reproducing that knowledge inline. Target length is under ~50 lines per SKILL.md.

- **`byeslide-author`** — triggered when creating or editing slides. Tells the agent to read `patterns/` first, copy the closest example into `slides/NN-name.html`, fill content, verify viewport fit.
- **`byeslide-theme`** — triggered when editing `theme.css` or restyling. Lists available tokens and where they're consumed.
- **`byeslide-build`** — triggered for preview or export. Commands and output paths only.

Each skill carries a short list of explicit "don't"s where a concrete failure mode justifies the line (e.g. "don't introduce viewport-responsive rules — viewport is fixed"). No general advice, no CSS or HTML tutorials, no framework explanation.

## Agent authoring model

The agent's loop, roughly:

1. Read `patterns/` to learn the available vocabulary.
2. For each slide the user wants, pick the closest example.
3. Copy the markup into `slides/NN-name.html` and fill in content.
4. Tweak classes / structure as needed to fit the content.
5. If a slide overflows the viewport, regenerate or restructure.

The agent is doing **example selection and content filling**, not free-form layout composition. That's the operation current models are actually good at. When the examples aren't enough, the agent (or user) writes raw HTML/CSS — there's no framework to escape from.

## Non-goals

- A WYSIWYG editor. The interface is the agent + a text editor.
- A new presentation runtime. Reveal exists.
- A new templating language. HTML is the templating language.
- PPTX export. Pick HTML as the presentation surface and PDF as the static export; let PPTX die.
- Online-first / SaaS. Files on disk, build locally, share the output.

## Open questions

These are deliberately unresolved.

- **Slide files: full HTML documents or fragments?** Full documents preview individually in a browser without tooling; fragments are cleaner with less per-file boilerplate. A dev server that wraps a fragment in the Reveal shell on demand could split the difference, but adds a moving part.
- **Overflow handling.** Three candidates: CSS paged media (most "correct," least flexible), fixed viewport with explicit overflow rules (Reveal-native), or "agent regenerates if it overflows" (most pragmatic). Probably the second + third combined, but the UX of detecting and signaling overflow to the agent is unspecified.
- **Styling approach: Tailwind utilities vs semantic CSS classes.** Both have real cases for this use case. Tailwind: well-trodden (existing Reveal+Tailwind templates work), gives the agent flexibility to deviate inline without touching shared CSS. Semantic CSS (`.slide-quote`, `.slide-two-column`): much shorter HTML, which matters disproportionately for agent edit quality — long utility class strings are where edits go wrong. CSS custom properties as a deviation surface (`style="--quote-max-width: 60ch"`) gives semantic CSS a constrained way to handle one-off tweaks. Plan: prototype both, pick based on which produces cleaner agent edits in practice. If Tailwind wins, two follow-up details: disable responsive prefixes (they query the actual browser viewport, not the logical slide dimensions, and would fire inconsistently), and decide whether to re-anchor the type scale for presentation distance.
- **Relationship to Reveal.** Three options: (a) emit Reveal-compatible HTML and depend on Reveal as a runtime, (b) build on top of Reveal as a library/plugin, (c) fork. (a) is cleanest but locks us to whatever Reveal does; (c) is a maintenance commitment we probably don't want.
- **How patterns get into a new project.** A starter template that ships them all, an `init` command that scaffolds the directory, or both?
- **Theming distribution.** Themes as `theme.css` files copied into the project, or something more dynamic? If dynamic, what's the boundary?
- **Static-vs-interactive boundary.** Patterns are static HTML. Are there ever interactive elements (live charts, embeds) that need a real framework — Web Components, islands, nothing?
- **Speaker notes, transitions, fragment animations.** Reveal supports all of these natively. Open whether the patterns expose them by default, document them as advanced, or hide them.

## Risks

- **Reveal.js bus factor.** The project is steadily maintained — 6.0 shipped in March 2026 with a React wrapper, Vite migration, and TypeScript types — but most substantive work comes from a single maintainer (Hakim El Hattab). If he steps back, momentum likely stalls. The mitigating factor is that decks are just HTML and CSS; if Reveal disappeared tomorrow, every existing deck still renders, and the runtime layer could be swapped or forked without touching slide content. The dependency is real but recoverable.
- **The "agent edits content directly" thesis might be wrong** for non-technical users who want a GUI. Tool stays useful for the technical audience either way, but TAM depends on the bet.
- **Styling approach is unresolved.** Tailwind vs semantic CSS is a real call, not a settled detail. If Tailwind wins, the gotchas (responsive prefixes, type scale anchoring) are well-understood and have known fixes. If semantic CSS wins, the open work is defining the class vocabulary and the CSS-custom-property deviation surface. Either path is workable; the risk is committing to one without checking which produces cleaner agent edits.
- **Pattern library scope creep.** Every additional pattern is a place the agent will pick wrong. Discipline on the starter set matters.
