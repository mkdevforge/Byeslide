const KNOWN_PLUGINS = {
  notes: {
    script: "plugin/notes.js",
    global: "RevealNotes"
  },
  highlight: {
    script: "plugin/highlight.js",
    global: "RevealHighlight",
    stylesheet: "plugin/highlight/monokai.css"
  },
  markdown: {
    script: "plugin/markdown.js",
    global: "RevealMarkdown"
  },
  math: {
    script: "plugin/math.js",
    global: "RevealMath"
  },
  search: {
    script: "plugin/search.js",
    global: "RevealSearch"
  },
  zoom: {
    script: "plugin/zoom.js",
    global: "RevealZoom"
  }
};

function resolvePlugins(plugins) {
  return plugins.map((plugin) => {
    if (typeof plugin === "string") {
      return KNOWN_PLUGINS[plugin] || {
        script: plugin,
        global: null
      };
    }

    return {
      script: plugin.script || plugin.path,
      global: plugin.global || null,
      stylesheet: plugin.stylesheet || null
    };
  }).filter((plugin) => plugin.script);
}

module.exports = {
  KNOWN_PLUGINS,
  resolvePlugins
};
