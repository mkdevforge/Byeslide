/*
  One chart style for the whole deck.

  A chart slide loads Chart.js, then this file:

    <script src="./assets/vendor/chart.umd.js"></script>
    <script src="./assets/acme-charts.js"></script>

  The build keeps one copy of each, so every chart slide can list both.

  AcmeCharts.create(canvas, config) makes a Chart.js chart with the deck's fonts,
  colors and spacing, read from the tokens in theme.css. It adds:

  - dataset.valueLabels: a function (value, index) that returns the text to write
    at the end of a bar or above a point. Return "" for no label, or
    { text, below: true } to write it under a point.
  - dataset.endLabel: text after the last point of a line, so the line needs no
    legend. Leave room with layout.padding.right.
  - options.plugins.acmeSideLabels.items: [{ text, value }] names series in the
    left margin, at a value on the y axis. Leave room with layout.padding.left.
  - Any element in the chart box with data-at="5" is pinned to point 5 of the first
    dataset (data-dataset="1" for the second): it gets --x and --y in pixels.
    .chart-marker in styles.css uses this for numbered markers.

  AcmeCharts.theme() returns the colors and fonts, for dataset colors.
*/
(() => {
  if (window.AcmeCharts) {
    return;
  }

  function theme() {
    const style = getComputedStyle(document.documentElement);
    const read = (name) => style.getPropertyValue(name).trim();
    return {
      navy: read("--color-navy"),
      ink2: read("--color-ink-2"),
      muted: read("--color-muted"),
      blue1: read("--color-blue-1"),
      blue2: read("--color-blue-2"),
      blue3: read("--color-blue-3"),
      blue4: read("--color-blue-4"),
      grid: read("--color-grid"),
      rule: read("--color-rule"),
      accent: read("--color-accent"),
      surface: read("--color-surface"),
      family: read("--font-sans") || "sans-serif"
    };
  }

  const LABEL_FONT = (family, weight = 600) => `${weight} 22px ${family}`;

  // Pins every [data-at] element in the chart box to its data point.
  const pinPlugin = {
    id: "acmePins",
    afterDraw(chart) {
      const box = chart.canvas.parentElement;
      box.querySelectorAll("[data-at]").forEach((pin) => {
        const meta = chart.getDatasetMeta(Number(pin.dataset.dataset || 0));
        const point = meta.data[Number(pin.dataset.at)];
        if (!point || meta.hidden) {
          return;
        }
        const { x, y } = point.tooltipPosition();
        pin.style.setProperty("--x", `${x}px`);
        pin.style.setProperty("--y", `${y}px`);
      });
    }
  };

  function drawEndLabel(chart, dataset, meta, colors) {
    const last = meta.data.findLast((_element, index) => dataset.data[index] !== null && dataset.data[index] !== undefined);
    if (!last) {
      return;
    }
    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = dataset.endLabelColor || colors.navy;
    ctx.font = LABEL_FONT(colors.family);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(dataset.endLabel, last.x + 22, last.y);
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
          const label = dataset.valueLabels(raw, index);
          const { text, below, color } = label && typeof label === "object" ? label : { text: label };
          if (!text) {
            return;
          }
          const [start, end] = Array.isArray(raw) ? raw : [0, raw];
          const down = below ?? end < start;
          const isBar = meta.type === "bar";
          const top = isBar ? Math.min(element.y, element.base) : element.y;
          const bottom = isBar ? Math.max(element.y, element.base) : element.y;
          const gap = isBar ? 10 : 18;
          ctx.save();
          ctx.fillStyle = color || colors.navy;
          ctx.font = LABEL_FONT(colors.family);
          ctx.textAlign = "center";
          ctx.textBaseline = down ? "top" : "bottom";
          ctx.fillText(text, element.x, down ? bottom + gap : top - gap);
          ctx.restore();
        });
      });
    }
  };

  // Names series in the left margin.
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
      ctx.fillStyle = colors.ink2;
      ctx.font = LABEL_FONT(colors.family);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const item of items) {
        ctx.fillText(item.text, chartArea.left - 20, scales.y.getPixelForValue(item.value));
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
    defaults.font = { family: colors.family, size: 22, weight: 500, lineHeight: 1.2 };
    defaults.color = colors.muted;
    defaults.borderColor = colors.grid;
    defaults.maintainAspectRatio = false;
    defaults.responsive = true;
    // Sharp on projectors and in the PDF.
    defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2);
    defaults.layout.padding = { top: 16, right: 8, bottom: 0, left: 0 };
    defaults.plugins.legend.display = false;
    Object.assign(defaults.plugins.tooltip, {
      backgroundColor: colors.navy,
      bodyColor: colors.surface,
      bodyFont: { family: colors.family, size: 20, weight: 500 },
      caretSize: 6,
      cornerRadius: 2,
      displayColors: false,
      padding: 12,
      titleColor: colors.surface,
      titleFont: { family: colors.family, size: 20, weight: 650 }
    });
    defaults.elements.line.borderWidth = 4;
    defaults.elements.line.borderCapStyle = "round";
    defaults.elements.line.borderJoinStyle = "round";
    defaults.elements.line.tension = 0;
    defaults.elements.point.radius = 0;
    defaults.elements.point.hoverRadius = 8;
    defaults.elements.point.hitRadius = 24;
    defaults.elements.bar.borderRadius = 0;
    defaults.scale.border.display = false;
    defaults.scale.grid.color = colors.grid;
    defaults.scale.grid.lineWidth = 1;
    defaults.scale.grid.drawTicks = false;
    defaults.scale.ticks.color = colors.muted;
    defaults.scale.ticks.padding = 14;
    defaults.scale.ticks.font = { size: 22, weight: 500 };
  }

  function create(canvas, config) {
    setDefaults();
    canvas.dataset.chartReady = "true";
    const chart = new window.Chart(canvas, {
      ...config,
      // Charts draw once, complete, so the PDF and the live deck match. A slide script can
      // turn animation on later with chart.options.animation = { duration: 400 }.
      options: { animation: false, ...config.options },
      plugins: [...(config.plugins || []), valueLabelsPlugin, sideLabelsPlugin, pinPlugin]
    });
    // Redraw once the deck font has loaded, so canvas text uses it too.
    const family = theme().family.split(",")[0];
    document.fonts?.load(`600 22px ${family}`).then(
      () => chart.update("none"),
      (error) => console.warn(`Chart text uses a fallback font: ${family} did not load.`, error)
    );
    return chart;
  }

  window.AcmeCharts = { create, theme };
})();
