/*
  The parts of each page that depend on the order of the slides: page numbers,
  the section tracker, exhibit numbers, page references and dates on a Gantt chart.
  Reorder, add or remove slides and they stay right.

  Every slide except the title loads it:

    <script src="./assets/acme-deck.js"></script>

  The build keeps one copy. Slides only mark where things go:

  - data-section="Name" on the first slide of a section starts that section.
  - data-tracker on an element draws the sections there, with this page marked.
  - data-page-number shows this slide's page number.
  - data-exhibit-number shows the next exhibit number, counted through the deck.
  - data-page-of="id" shows the page number of the slide with that id.
  - On an element with data-from and data-to (dates), children with data-start and
    data-end get --start and --end, and children with data-date get --at: their place
    from 0 to 1, a day counted whole. data-edge places --at where that day begins.
*/
(() => {
  if (window.AcmeDeck) {
    return;
  }

  const DAY = 24 * 60 * 60 * 1000;

  function slides() {
    return Array.from(document.querySelectorAll(".reveal .slides section[data-byeslide-source]"));
  }

  function sectionsOf(list) {
    const sections = [];
    list.forEach((slide, index) => {
      if (slide.dataset.section) {
        sections.push({ name: slide.dataset.section, start: index });
      }
    });
    return sections.map((section, i) => ({ ...section, end: i + 1 < sections.length ? sections[i + 1].start : list.length }));
  }

  // One segment per section, as wide as its pages, with a tick per page. This page's tick is the needle.
  function drawTracker(element, sections, index) {
    const list = document.createElement("ol");
    for (const section of sections) {
      const item = document.createElement("li");
      item.className = "tracker__section";
      item.style.setProperty("--pages", section.end - section.start);
      const current = index >= section.start && index < section.end;
      if (current) {
        item.classList.add("is-current");
        item.setAttribute("aria-current", "true");
      }
      const name = document.createElement("span");
      name.className = "tracker__name";
      name.textContent = section.name;
      const ticks = document.createElement("span");
      ticks.className = "tracker__ticks";
      ticks.setAttribute("aria-hidden", "true");
      for (let page = section.start; page < section.end; page += 1) {
        const tick = document.createElement("i");
        if (page === index) {
          tick.className = "is-here";
        }
        ticks.append(tick);
      }
      item.append(name, ticks);
      list.append(item);
    }
    element.replaceChildren(list);
  }

  function placeDates(chart) {
    const from = Date.parse(chart.dataset.from);
    const days = (Date.parse(chart.dataset.to) - from) / DAY + 1;
    const at = (date) => (Date.parse(date) - from) / DAY / days;
    chart.querySelectorAll("[data-start][data-end]").forEach((element) => {
      element.style.setProperty("--start", at(element.dataset.start));
      element.style.setProperty("--end", at(element.dataset.end) + 1 / days);
    });
    chart.querySelectorAll("[data-date]").forEach((element) => {
      element.style.setProperty("--at", at(element.dataset.date) + 0.5 / days);
    });
    chart.querySelectorAll("[data-edge]").forEach((element) => {
      element.style.setProperty("--at", at(element.dataset.edge));
    });
  }

  function render() {
    const list = slides();
    const sections = sectionsOf(list);
    let exhibit = 0;
    list.forEach((slide, index) => {
      slide.querySelectorAll("[data-page-number]").forEach((element) => {
        element.textContent = String(index + 1);
      });
      slide.querySelectorAll("[data-exhibit-number]").forEach((element) => {
        exhibit += 1;
        element.textContent = String(exhibit);
      });
      slide.querySelectorAll("[data-tracker]").forEach((element) => drawTracker(element, sections, index));
    });
    document.querySelectorAll("[data-page-of]").forEach((element) => {
      const index = list.indexOf(document.getElementById(element.dataset.pageOf));
      if (index < 0) {
        // Say so on the page: a wrong page reference in a board document is worse than a visible gap.
        console.warn(`Page reference: no slide has the id "${element.dataset.pageOf}".`);
        element.textContent = "?";
        return;
      }
      element.textContent = String(index + 1);
    });
    document.querySelectorAll("[data-from][data-to]").forEach(placeDates);
  }

  render();
  window.AcmeDeck = { render };
})();
