/*
  Lesson kit: the drawings and classroom tools that this deck's slides share.

  A slide loads it, then sets itself up from its own script:

    <script src="./assets/lesson-kit.js"></script>
    <script>
      (() => {
        const slide = window.Byeslide?.slideForScript(document.currentScript);
        window.LessonKit?.setup(slide);
      })();
    </script>

  setup() runs once per slide. It draws every [data-moon] in the slide, wires up
  votes ([data-vote]) and timers ([data-timer]), and keeps the slide's buttons
  and sliders from moving the deck. Colors come from theme.css through the
  classes in styles.css, so every drawing follows the theme.
*/
(() => {
  if (window.LessonKit) {
    return;
  }

  const SVG_NS = "http://www.w3.org/2000/svg";

  // Days from one new moon to the next (the synodic month).
  const SYNODIC_DAYS = 29.53;

  // The eight phases. angle: how far the Moon has gone around Earth since new moon, in degrees.
  const PHASES = [
    { key: "new", name: "New moon", angle: 0 },
    { key: "waxing-crescent", name: "Waxing crescent", angle: 45 },
    { key: "first-quarter", name: "First quarter", angle: 90 },
    { key: "waxing-gibbous", name: "Waxing gibbous", angle: 135 },
    { key: "full", name: "Full moon", angle: 180 },
    { key: "waning-gibbous", name: "Waning gibbous", angle: 225 },
    { key: "third-quarter", name: "Third quarter", angle: 270 },
    { key: "waning-crescent", name: "Waning crescent", angle: 315 }
  ];

  // Within this many degrees (about three quarters of a day) of new, first quarter,
  // full or third quarter, the Moon gets that phase's name.
  const MAIN_PHASE_WINDOW = 9;

  // The dark plains (maria) of the near side, as seen from the Northern Hemisphere,
  // placed from their latitude and longitude on a Moon of radius 50: cx, cy, rx, ry,
  // rotation. The same side always faces Earth, so they never move between phases.
  const MARIA = [
    [-32, -3, 13, 24, -8], // Oceanus Procellarum
    [-21, -5, 9, 8, 0], // Mare Insularum
    [-11, -24, 15, 11, 8], // Mare Imbrium
    [12, -21, 10, 9, 0], // Mare Serenitatis
    [1, -12, 8, 6, 0], // Mare Vaporum
    [23, -6, 11, 10, -15], // Mare Tranquillitatis
    [40, -14, 5, 7, 0], // Mare Crisium
    [35, 8, 6, 10, 10], // Mare Fecunditatis
    [26, 15, 5, 5, 0], // Mare Nectaris
    [-13, 18, 10, 7, 0], // Mare Nubium
    [-20, 8, 7, 6, 0], // Mare Cognitum
    [-29, 20, 6, 6, 0] // Mare Humorum
  ];

  let nextId = 0;

  function normalize(angle) {
    return ((angle % 360) + 360) % 360;
  }

  // Share of the side facing Earth that is sunlit, from 0 (new) to 1 (full).
  function litFraction(angle) {
    return (1 - Math.cos(toRadians(normalize(angle)))) / 2;
  }

  function dayOf(angle) {
    return (normalize(angle) / 360) * SYNODIC_DAYS;
  }

  function phaseOf(angle) {
    const a = normalize(angle);
    const near = (target) => Math.abs(((a - target + 540) % 360) - 180) <= MAIN_PHASE_WINDOW;
    if (near(0)) return PHASES[0];
    if (near(90)) return PHASES[2];
    if (near(180)) return PHASES[4];
    if (near(270)) return PHASES[6];
    if (a < 90) return PHASES[1];
    if (a < 180) return PHASES[3];
    if (a < 270) return PHASES[5];
    return PHASES[7];
  }

  // Outline of the sunlit part of a Moon of radius r centered on 0,0, as seen
  // from the Northern Hemisphere: waxing Moons are lit on the right. The edge
  // between day and night on the Moon (the terminator) is half an ellipse,
  // r * |cos(angle)| wide, so the lit part is (1 - cos(angle)) / 2 of the disc.
  function litPath(angle, r = 50) {
    const a = normalize(angle);
    const lit = litFraction(a);
    if (lit < 0.001) {
      return "";
    }
    if (lit > 0.999) {
      return `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`;
    }
    const cos = Math.cos(toRadians(a));
    const rx = Number((Math.abs(cos) * r).toFixed(3));
    const crescent = cos > 0;
    if (a < 180) {
      // Right edge from top to bottom, then the terminator back up.
      return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${rx} ${r} 0 0 ${crescent ? 0 : 1} 0 ${-r} Z`;
    }
    // Left edge from top to bottom, then the terminator back up.
    return `M 0 ${-r} A ${r} ${r} 0 0 0 0 ${r} A ${rx} ${r} 0 0 ${crescent ? 1 : 0} 0 ${-r} Z`;
  }

  // An uneven closed curve around an ellipse, so the maria look like plains, not spots.
  function blobPath([cx, cy, rx, ry, turn], seed) {
    const count = 14;
    const cosTurn = Math.cos(toRadians(turn));
    const sinTurn = Math.sin(toRadians(turn));
    const points = Array.from({ length: count }, (_, index) => {
      const t = (index / count) * Math.PI * 2;
      // Two slow waves around the edge: gentle bulges, no corners.
      const wobble = 1 + 0.1 * Math.sin(2 * t + seed * 1.7) + 0.06 * Math.sin(3 * t + seed * 2.9);
      const x = rx * wobble * Math.cos(t);
      const y = ry * wobble * Math.sin(t);
      return [cx + x * cosTurn - y * sinTurn, cy + x * sinTurn + y * cosTurn];
    });
    const at = (index) => points[(index + count) % count];
    const f = (n) => n.toFixed(2);
    let d = `M ${f(points[0][0])} ${f(points[0][1])}`;
    for (let index = 0; index < count; index += 1) {
      const [p0, p1, p2, p3] = [at(index - 1), at(index), at(index + 1), at(index + 2)];
      d += ` C ${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)}`
        + ` ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)}`
        + ` ${f(p2[0])} ${f(p2[1])}`;
    }
    return `${d} Z`;
  }

  const MARIA_PATHS = MARIA.map((mare, index) => blobPath(mare, index + 1));

  // data-moon takes a phase key ("first-quarter") or an angle in degrees ("90").
  function angleFrom(value) {
    const phase = PHASES.find((item) => item.key === value);
    if (phase) {
      return phase.angle;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  // Draws a Moon into an element, or updates the one already there.
  function drawMoon(element, angle) {
    let svg = element.querySelector(":scope > svg.moon__svg");
    if (!svg) {
      const clipId = `lesson-moon-clip-${(nextId += 1)}`;
      svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("class", "moon__svg");
      svg.setAttribute("viewBox", "-53 -53 106 106");
      svg.setAttribute("aria-hidden", "true");
      const maria = MARIA_PATHS.map((d) => `<path d="${d}"/>`).join("");
      svg.innerHTML = `<defs><clipPath id="${clipId}"><path class="moon__clip"/></clipPath></defs>`
        + `<circle class="moon__dark" r="50"/>`
        + `<path class="moon__lit"/>`
        + `<g class="moon__maria" clip-path="url(#${clipId})">${maria}</g>`
        + `<circle class="moon__edge" r="50"/>`;
      element.append(svg);
    }
    const d = litPath(angle);
    svg.querySelector(".moon__lit").setAttribute("d", d);
    svg.querySelector(".moon__clip").setAttribute("d", d);
    element.dataset.moonAngle = String(normalize(angle));
  }

  function drawMoons(root) {
    root.querySelectorAll("[data-moon]").forEach((element) => {
      const angle = angleFrom(element.dataset.moon);
      if (angle === null) {
        console.warn(`LessonKit: data-moon="${element.dataset.moon}" is not a phase name or an angle.`);
        return;
      }
      if (!element.hasAttribute("aria-hidden")) {
        if (!element.hasAttribute("role")) {
          element.setAttribute("role", "img");
        }
        if (!element.hasAttribute("aria-label")) {
          element.setAttribute("aria-label", phaseOf(angle).name);
        }
      }
      drawMoon(element, angle);
    });
  }

  // A Moon with data-moon-from="30" grows from that angle to its data-moon angle
  // each time its slide opens.
  function setupWaxing(slide) {
    const moons = Array.from(slide.querySelectorAll("[data-moon][data-moon-from]"));
    if (moons.length === 0 || !window.Reveal?.on) {
      return;
    }
    const play = () => {
      if (prefersReducedMotion() || window.Reveal.isPrintView?.()) {
        return;
      }
      moons.forEach((element) => {
        const from = Number(element.dataset.moonFrom);
        const to = angleFrom(element.dataset.moon);
        if (!Number.isFinite(from) || to === null) {
          return;
        }
        animate(1800, (t) => drawMoon(element, from + (to - from) * easeOut(t)));
      });
    };
    window.Reveal.on("slidechanged", (event) => {
      if (event.currentSlide === slide) {
        play();
      }
    });
    window.Reveal.on("ready", (event) => {
      if (event.currentSlide === slide) {
        play();
      }
    });
  }

  // Votes ----------------------------------------------------------------------

  // Each [data-vote-option] button adds a vote to its row. Shift-click or
  // right-click takes one away. [data-vote-reset] clears every row.
  function setupVotes(root) {
    root.querySelectorAll("[data-vote]").forEach((vote) => {
      const rows = Array.from(vote.querySelectorAll("[data-vote-option]")).map((button) => {
        const row = button.closest("[data-vote-row]") || button.parentElement;
        return {
          button,
          count: row.querySelector("[data-vote-count]"),
          tally: row.querySelector("[data-vote-tally]"),
          votes: 0
        };
      });

      const render = (row, added = false) => {
        if (row.count) {
          row.count.textContent = String(row.votes);
        }
        if (row.tally) {
          drawTally(row.tally, row.votes, added);
        }
      };
      const change = (row, by) => {
        row.votes = Math.max(0, row.votes + by);
        render(row, by > 0);
      };

      rows.forEach((row) => {
        row.button.addEventListener("click", (event) => change(row, event.shiftKey ? -1 : 1));
        row.button.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          change(row, -1);
        });
        render(row);
      });

      vote.querySelector("[data-vote-reset]")?.addEventListener("click", () => {
        rows.forEach((row) => {
          row.votes = 0;
          render(row);
        });
      });
    });
  }

  // Tally marks in groups of five: four strokes and one across.
  function drawTally(element, votes, added) {
    const stroke = 16;
    const group = 4 * stroke + 30;
    const groups = Math.ceil(votes / 5);
    const width = Math.max(1, groups * group);
    const marks = [];
    for (let index = 0; index < votes; index += 1) {
      const g = Math.floor(index / 5);
      const n = index % 5;
      const x0 = g * group + 6;
      const tilt = (((index * 37) % 7) - 3) * 0.9;
      const latest = added && index === votes - 1 ? " is-new" : "";
      if (n < 4) {
        const x = x0 + n * stroke;
        marks.push(`<line class="tally__mark${latest}" x1="${x}" y1="6" x2="${x}" y2="70" pathLength="1" transform="rotate(${tilt} ${x} 38)"/>`);
      } else {
        marks.push(`<line class="tally__mark${latest}" x1="${x0 - 8}" y1="58" x2="${x0 + 3 * stroke + 8}" y2="18" pathLength="1"/>`);
      }
    }
    element.innerHTML = `<svg class="tally" viewBox="0 0 ${width} 76" width="${width}" height="76" aria-hidden="true">${marks.join("")}</svg>`;
  }

  // Timers ---------------------------------------------------------------------

  // [data-timer data-seconds="120"] with a [data-timer-display], a
  // [data-timer-bar], a [data-timer-start] button and a [data-timer-reset]
  // button. A soft chime plays at the end; data-timer-sound="off" turns it off.
  function setupTimers(root) {
    root.querySelectorAll("[data-timer]").forEach((timer) => {
      const total = Math.max(1, Number(timer.dataset.seconds) || 120) * 1000;
      const display = timer.querySelector("[data-timer-display]");
      const bar = timer.querySelector("[data-timer-bar]");
      const status = timer.querySelector("[data-timer-status]");
      const start = timer.querySelector("[data-timer-start]");
      const reset = timer.querySelector("[data-timer-reset]");
      const sound = timer.dataset.timerSound !== "off";
      let remaining = total;
      let endsAt = null;
      let ticker = null;

      const left = () => (endsAt === null ? remaining : Math.max(0, endsAt - Date.now()));

      function render() {
        const ms = left();
        const seconds = Math.ceil(ms / 1000);
        const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
        // One fixed-width cell per character, so the time does not jump as digits change.
        display.innerHTML = Array.from(text, (character) => `<span class="${character === ":" ? "timer__colon" : "timer__digit"}">${character}</span>`).join("");
        display.setAttribute("aria-label", text);
        bar?.style.setProperty("--timer-left", String(ms / total));
        if (endsAt !== null && ms === 0) {
          finish();
        }
      }

      function run() {
        if (remaining === 0) {
          remaining = total;
        }
        if (sound) {
          wakeAudio();
        }
        endsAt = Date.now() + remaining;
        ticker = window.setInterval(render, 200);
        timer.classList.add("is-running");
        timer.classList.remove("is-done", "is-paused");
        start.textContent = "Pause";
        if (status) status.textContent = "";
        render();
      }

      function pause() {
        remaining = left();
        endsAt = null;
        window.clearInterval(ticker);
        timer.classList.remove("is-running");
        timer.classList.add("is-paused");
        start.textContent = "Resume";
        render();
      }

      function finish() {
        window.clearInterval(ticker);
        endsAt = null;
        remaining = 0;
        timer.classList.remove("is-running", "is-paused");
        timer.classList.add("is-done");
        start.textContent = "Start again";
        if (status) status.textContent = "Time is up.";
        if (sound) {
          chime();
        }
      }

      start.addEventListener("click", () => (endsAt === null ? run() : pause()));
      reset?.addEventListener("click", () => {
        window.clearInterval(ticker);
        endsAt = null;
        remaining = total;
        timer.classList.remove("is-running", "is-paused", "is-done");
        start.textContent = "Start";
        if (status) status.textContent = "";
        render();
      });
      render();
    });
  }

  let audio = null;

  // Browsers allow sound only after a click, so the Start click creates the audio context.
  function wakeAudio() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) {
      return;
    }
    audio = audio || new Context();
    if (audio.state === "suspended") {
      audio.resume().catch(() => {});
    }
  }

  function chime() {
    if (!audio) {
      return;
    }
    [659.25, 880].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const at = audio.currentTime + index * 0.35;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + 1.5);
    });
  }

  // Controls --------------------------------------------------------------------

  // Buttons and sliders work the slide, not the deck. Space and Enter on a
  // button press the button without going to the next slide. After a mouse or
  // touch click, focus goes back to the deck so the arrow keys and a clicker
  // keep working.
  function guardControls(slide) {
    slide.addEventListener("keydown", (event) => {
      if (event.target.closest?.("button") && (event.key === " " || event.key === "Enter")) {
        event.stopPropagation();
      }
    });
    slide.addEventListener("click", (event) => {
      const button = event.target.closest?.("button");
      if (button && event.detail > 0) {
        button.blur();
      }
    });
    slide.addEventListener("pointerup", (event) => {
      if (event.target.matches?.("input[type='range']")) {
        event.target.blur();
      }
    });
  }

  // Helpers -----------------------------------------------------------------------

  function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  function easeOut(t) {
    return 1 - (1 - t) ** 3;
  }

  function prefersReducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }

  function animate(duration, step) {
    const started = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - started) / duration);
      step(t);
      if (t < 1) {
        requestAnimationFrame(frame);
      }
    };
    requestAnimationFrame(frame);
  }

  function setup(slide) {
    if (!slide || slide.dataset.lessonKit === "ready") {
      return;
    }
    slide.dataset.lessonKit = "ready";
    drawMoons(slide);
    setupWaxing(slide);
    setupVotes(slide);
    setupTimers(slide);
    guardControls(slide);
  }

  window.LessonKit = {
    MAIN_PHASE_WINDOW,
    PHASES,
    SYNODIC_DAYS,
    dayOf,
    drawMoon,
    drawMoons,
    litFraction,
    litPath,
    phaseOf,
    prefersReducedMotion,
    setup
  };
})();
