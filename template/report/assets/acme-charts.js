/*
  One chart style for the whole deck.

  A chart slide loads Chart.js, then this file:

    <script src="./assets/vendor/chart.umd.js"></script>
    <script src="./assets/acme-charts.js"></script>

  The build keeps one copy of each, so every chart slide can list both.

  AcmeCharts.create(canvas, config) makes a Chart.js chart with the deck's fonts,
  colors and spacing, read from the tokens in theme.css. It adds four things:

  - dataset.valueLabels: a function (value, index) that returns the text to
    write at the end of a bar or above a point. Return "" for no label, or
    { text, below: true } to write it under a point.
  - dataset.endLabel: text written after the last point of a line, so the
    line needs no legend. Leave room with layout.padding.right.
  - options.plugins.acmeSideLabels.items: [{ text, value }] writes series names
    in the left margin, at a value on the y axis. Leave room with layout.padding.left.
  - A .chart-note inside the chart box with data-at="5" is pinned to point 5 of
    the first dataset (data-dataset="1" for the second). See styles.css.

  AcmeCharts.theme() returns the colors and font, for dataset colors.
*/
(() => {
  if (window.AcmeCharts) {
    return;
  }

  function theme() {
    const style = getComputedStyle(document.documentElement);
    const read = (name) => style.getPropertyValue(name).trim();
    return {
      ink: read("--color-ink"),
      soft: read("--color-ink-soft"),
      compare: read("--color-compare"),
      rule: read("--color-rule"),
      panel: read("--color-panel"),
      accent: read("--color-accent"),
      surface: read("--color-surface"),
      family: read("--font-sans") || "sans-serif"
    };
  }

  // Pins each .chart-note in the chart box to its data point.
  const notesPlugin = {
    id: "acmeNotes",
    afterDraw(chart) {
      const box = chart.canvas.parentElement;
      box.querySelectorAll(".chart-note[data-at]").forEach((note) => {
        const meta = chart.getDatasetMeta(Number(note.dataset.dataset || 0));
        const point = meta.data[Number(note.dataset.at)];
        if (!point || meta.hidden) {
          return;
        }
        const { x, y } = point.tooltipPosition();
        note.style.setProperty("--x", `${x}px`);
        note.style.setProperty("--y", `${y}px`);
      });
    }
  };

  // Writes dataset.endLabel to the right of a line's last point.
  function drawEndLabel(chart, dataset, meta, colors) {
    const last = meta.data.findLast((_element, index) => dataset.data[index] !== null && dataset.data[index] !== undefined);
    if (!last) {
      return;
    }
    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = colors.ink;
    ctx.font = `600 28px ${colors.family}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(dataset.endLabel, last.x + 28, last.y);
    ctx.restore();
  }

  // Writes dataset.valueLabels at the end of each bar, or above each point.
  const valueLabelsPlugin = {
    id: "acmeValueLabels",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const colors = theme();
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        if (!chart.isDatasetVisible(datasetIndex)) {
          return;
        }
        const meta = chart.getDatasetMeta(datasetIndex);
        if (dataset.endLabel) {
          drawEndLabel(chart, dataset, meta, colors);
        }
        if (typeof dataset.valueLabels !== "function") {
          return;
        }
        meta.data.forEach((element, index) => {
          const raw = dataset.data[index];
          if (raw === null || raw === undefined) {
            return;
          }
          // A label is text, or { text, below } to choose its side of a point.
          const label = dataset.valueLabels(raw, index);
          const { text, below } = label && typeof label === "object" ? label : { text: label };
          if (!text) {
            return;
          }
          const [start, end] = Array.isArray(raw) ? raw : [0, raw];
          const down = below ?? end < start;
          const isBar = meta.type === "bar";
          const top = isBar ? Math.min(element.y, element.base) : element.y;
          const bottom = isBar ? Math.max(element.y, element.base) : element.y;
          const gap = isBar ? 12 : 22;
          ctx.save();
          ctx.fillStyle = colors.ink;
          ctx.font = `600 28px ${colors.family}`;
          ctx.textAlign = "center";
          ctx.textBaseline = down ? "top" : "bottom";
          ctx.fillText(text, element.x, down ? bottom + gap : top - gap);
          ctx.restore();
        });
      });
    }
  };

  // Writes series names in the left margin.
  const sideLabelsPlugin = {
    id: "acmeSideLabels",
    afterDraw(chart, _args, options) {
      const items = options?.items || [];
      if (!items.length) {
        return;
      }
      const { ctx, chartArea, scales } = chart;
      const colors = theme();
      ctx.save();
      ctx.fillStyle = colors.ink;
      ctx.font = `600 28px ${colors.family}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const item of items) {
        ctx.fillText(item.text, chartArea.left - 24, scales.y.getPixelForValue(item.value));
      }
      ctx.restore();
    }
  };

  let defaultsSet = false;

  function setDefaults() {
    if (defaultsSet) {
      return;
    }
    defaultsSet = true;
    const colors = theme();
    const defaults = window.Chart.defaults;
    defaults.font = { family: colors.family, size: 26, weight: 500, lineHeight: 1.2 };
    defaults.color = colors.soft;
    defaults.borderColor = colors.rule;
    defaults.maintainAspectRatio = false;
    defaults.responsive = true;
    // Sharp on projectors and in the PDF.
    defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2);
    defaults.layout.padding = { top: 12, right: 12, bottom: 0, left: 0 };
    defaults.plugins.legend.display = false;
    Object.assign(defaults.plugins.tooltip, {
      backgroundColor: colors.ink,
      bodyColor: colors.surface,
      bodyFont: { family: colors.family, size: 22, weight: 500 },
      caretSize: 8,
      cornerRadius: 4,
      displayColors: false,
      padding: 14,
      titleColor: colors.surface,
      titleFont: { family: colors.family, size: 22, weight: 700 }
    });
    defaults.elements.line.borderWidth = 6;
    defaults.elements.line.borderCapStyle = "round";
    defaults.elements.line.borderJoinStyle = "round";
    defaults.elements.line.tension = 0;
    defaults.elements.point.radius = 0;
    defaults.elements.point.hoverRadius = 10;
    defaults.elements.point.hitRadius = 24;
    defaults.elements.bar.borderRadius = 4;
    defaults.elements.bar.borderSkipped = "start";
    defaults.scale.border.display = false;
    defaults.scale.grid.color = colors.rule;
    defaults.scale.grid.lineWidth = 2;
    defaults.scale.grid.drawTicks = false;
    defaults.scale.ticks.color = colors.soft;
    defaults.scale.ticks.padding = 16;
    defaults.scale.ticks.font = { size: 26, weight: 500 };
  }

  function create(canvas, config) {
    setDefaults();
    canvas.dataset.chartReady = "true";
    const chart = new window.Chart(canvas, {
      ...config,
      // Charts draw once, complete, so the PDF and the live deck match. A slide script can
      // turn animation on later with chart.options.animation = { duration: 400 }.
      options: { animation: false, ...config.options },
      plugins: [...(config.plugins || []), valueLabelsPlugin, sideLabelsPlugin, notesPlugin]
    });
    // Redraw once the deck font has loaded, so canvas text uses it too.
    const family = theme().family.split(",")[0];
    document.fonts?.load(`600 28px ${family}`).then(
      () => chart.update("none"),
      (error) => console.warn(`Chart text uses a fallback font: ${family} did not load.`, error)
    );
    return chart;
  }

  window.AcmeCharts = { create, theme };
})();
