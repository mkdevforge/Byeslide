# Why does the Moon have phases?

A science lesson for pupils aged 10 to 12. It takes about 45 minutes. The slides are HTML files in `slides/`, and Byeslide builds them into a Reveal.js deck at `dist/index.html`.

Pupils vote on why the Moon changes shape. Then they test their idea with a live model and name the eight phases. They make a prediction, find out why Earth's shadow is not the cause, and make the phases themselves with a lamp and a ball. The lesson ends with an exit ticket and a Moon diary for homework.

By the end of the lesson pupils can:

- say where the Moon's light comes from
- name the eight phases of the Moon in order
- use a model to explain why the phases happen
- explain why Earth's shadow does not cause the phases

For the activity on slide 10 you need a lamp without a shade, and a pale ball on a pencil for each pupil or pair. Each slide's speaker notes give the timing, what to ask, and the wrong ideas pupils often have.

The model and the phase drawings show the Moon as seen from the Northern Hemisphere: a waxing Moon is lit on the right. In the Southern Hemisphere the Moon looks flipped from left to right.

```sh
pnpm install
pnpm install:browsers
pnpm build
pnpm preview
pnpm check
pnpm pdf
pnpm bundle
```

`pnpm pdf` writes `dist/deck.pdf`, one page per slide with every answer shown. Print slide 12 as the homework sheet. `pnpm bundle` writes the whole lesson into one HTML file, `dist/why-does-the-moon-have-phases.html`. Put it on a USB stick or the school's shared drive: it opens in Edge or Chrome without a network, and the model, the votes and the timer work.

## Content

`content/` has one Markdown file per slide, with the words pupils see, the questions and answers, and your speaker notes: `content/07-predict.md` goes with `slides/07-predict.html`. To teach a different lesson, write your words in these files, then ask your AI assistant to update the slides from the content. The files say what the class sees and hears, not how it looks. The look lives in `theme.css`, `styles.css` and the slide files.

Preview serves the deck from `127.0.0.1:4173` by default. If that port is already in use, Byeslide prints the fallback URL it selected.

## The slides

Each slide shows a technique you can copy:

| Slide | Technique |
| --- | --- |
| `01-title` | A Moon drawn from `data-moon`, which waxes once when the slide opens (`data-moon-from`) |
| `02-vote` | Buttons that count votes with tally marks; Space and clicks on them do not move the deck |
| `03-goals` | Moons as list markers, a little fuller on each line |
| `04-facts` | Inline SVG drawings colored by theme tokens, one fragment per fact |
| `05-model` | The interactive model: drag, slider, phase buttons and play, in a slide script on a night background |
| `06-phases` | Eight phases from one drawing function, one fragment each |
| `07-predict` | One click lights up the right choice (`is-correct`) and sweeps in the answer (`sunrise`) |
| `08-shadow` | Two things compared side by side; the answer to the vote from slide 2 |
| `09-think-pair-share` | A countdown timer with Start, Pause, Reset and a soft chime |
| `10-activity` | Numbered steps; the step just shown is lit |
| `11-exit-ticket` | Questions whose answers appear one click at a time |
| `12-summary` | A Moon diary grid that prints as a homework sheet |

The look (daylight pages, a night sky for the model, sunlight yellow only for what the Sun lights and for answers) is an example, not a house style. Change `theme.css` and `styles.css` to give another lesson its own look.

## Authoring

Use `patterns/` as the vocabulary for new slides. It has twelve example slides that work for any subject: title, goals, key fact, vocabulary, question with a hidden answer, multiple choice, vote, activity steps, timer, exit ticket, summary and a picture with a caption. Copy the closest pattern into `slides/NN-name.html`, replace the content, and keep layout changes local to that slide unless the theme itself needs to change.

Add presenter notes with `<aside class="notes">` inside a slide, then press `S` in preview to open Reveal's speaker view. Press `P` in preview to write `dist/deck.pdf`, the same output as `pnpm pdf`; outside preview, `P` opens the browser print-to-PDF flow. In print view, press `Esc` or `P` again to return to the live deck.

`assets/lesson-kit.js` draws the Moons and runs the votes and the timers. A slide loads it with `<script src="./assets/lesson-kit.js"></script>` and then calls `window.LessonKit.setup(slide)` from its own script, with the slide from `window.Byeslide.slideForScript(document.currentScript)`. The build loads the kit once, however many slides include it. `setup` then:

- draws every `<span class="moon" data-moon="first-quarter"></span>` in the slide. `data-moon` takes a phase name (`new`, `waxing-crescent`, `first-quarter`, `waxing-gibbous`, `full`, `waning-gibbous`, `third-quarter`, `waning-crescent`) or an angle in degrees, where 0 is new moon and 180 is full moon.
- wires up votes (`data-vote`) and timers (`data-timer`, with the length in `data-seconds`), as in the patterns.
- keeps the slide's buttons and sliders from moving the deck.

The drawings use classes from `styles.css`, so they follow the colors in `theme.css`.

## Credits

Fonts: Podkova (Cyreal) and Atkinson Hyperlegible Next (Braille Institute), under the SIL Open Font License (`assets/fonts/*-OFL.txt`). The drawings were made for this deck as SVG. The deck uses no photos and no outside libraries.
