// Byeslide website: copy buttons, the ink picker, the plates section,
// the file grid in the bundle figure, and the docs table of contents.

(() => {
  // Copy buttons ------------------------------------------------------------
  document.querySelectorAll("[data-copy]").forEach((button) => {
    const root = button.closest("[data-copy-root]");
    const source = root?.querySelector("[data-copy-text]");
    if (!source) {
      return;
    }
    const label = button.textContent;
    let timer = 0;
    button.addEventListener("click", async () => {
      const text = source.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = "Copied";
      } catch {
        // No clipboard access (for example on file://): select the text instead.
        const range = document.createRange();
        range.selectNodeContents(source);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        button.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "Press Cmd+C" : "Press Ctrl+C";
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        button.textContent = label;
      }, 2200);
    });
  });

  // Ink picker: sets the same three custom properties the page uses. ----------
  const inkButtons = Array.from(document.querySelectorAll("[data-inks]"));
  inkButtons.forEach((button) => {
    button.addEventListener("click", () => {
      button.dataset.inks.split(" ").forEach((ink, index) => {
        document.documentElement.style.setProperty(`--ink-${index + 1}`, ink);
      });
      inkButtons.forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
    });
  });

  // Plates: scroll position drives how far the slide is pulled apart. ---------
  // Same query as the scroll-driven block in styles.css.
  const plates = document.querySelector("[data-plates]");
  const scrollMode = window.matchMedia("(min-width: 901px) and (min-height: 800px) and (prefers-reduced-motion: no-preference)");
  const clamp = (value) => Math.min(1, Math.max(0, value));
  const ease = (value) => value * value * (3 - 2 * value);
  let frame = 0;

  function updatePlates() {
    frame = 0;
    if (!plates) {
      return;
    }
    if (!scrollMode.matches) {
      plates.style.removeProperty("--split");
      plates.dataset.step = "0";
      return;
    }
    const rect = plates.getBoundingClientRect();
    const progress = clamp(-rect.top / (rect.height - window.innerHeight));
    const open = ease(clamp((progress - 0.08) / 0.22));
    const close = ease(clamp((progress - 0.78) / 0.14));
    const split = open * (1 - close);
    plates.style.setProperty("--split", split.toFixed(4));

    let step = 0;
    if (progress >= 0.78) {
      step = 4;
    } else if (progress >= 0.62) {
      step = 3;
    } else if (progress >= 0.46) {
      step = 2;
    } else if (progress >= 0.2) {
      step = 1;
    }
    plates.dataset.step = String(step);
  }

  function requestPlates() {
    if (!frame) {
      frame = requestAnimationFrame(updatePlates);
    }
  }

  window.addEventListener("scroll", requestPlates, { passive: true });
  window.addEventListener("resize", requestPlates);
  scrollMode.addEventListener("change", requestPlates);
  updatePlates();

  // Bundle figure: one small sheet for each of the 59 files in dist/. ---------
  const grid = document.querySelector("[data-file-grid]");
  if (grid) {
    grid.append(...Array.from({ length: 59 }, () => document.createElement("i")));
  }

  // Docs table of contents: mark the section on screen. -----------------------
  const links = new Map(Array.from(document.querySelectorAll(".toc a")).map((link) => [link.hash.slice(1), link]));
  const sections = Array.from(links.keys()).map((id) => document.getElementById(id)).filter(Boolean);
  if (sections.length > 0 && "IntersectionObserver" in window) {
    const visible = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visible.add(entry.target.id);
        } else {
          visible.delete(entry.target.id);
        }
      });
      markCurrent();
    }, { rootMargin: "-30% 0px -60% 0px" });

    // At the bottom of the page the last sections never reach the band above.
    function markCurrent() {
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const current = atBottom ? sections[sections.length - 1] : sections.find((section) => visible.has(section.id));
      links.forEach((link, id) => {
        if (current && id === current.id) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    window.addEventListener("scroll", markCurrent, { passive: true });
    sections.forEach((section) => observer.observe(section));
  }
})();
