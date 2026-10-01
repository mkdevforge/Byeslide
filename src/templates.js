const path = require("node:path");
const { ByeslideError } = require("./errors");

const TEMPLATE_ROOT = path.resolve(__dirname, "..", "template");
const SHARED_DIR = path.join(TEMPLATE_ROOT, "shared");
const DEFAULT_TEMPLATE = "tour";

// The decks that `byeslide init` can start from, in the order the picker shows them.
const TEMPLATES = [
  {
    name: "tour",
    title: "Byeslide tour",
    description: "Presents Byeslide itself. Each slide shows one technique: 3D, charts, fragments, video."
  },
  {
    name: "report",
    title: "Quarterly report",
    description: "A board-style quarterly review for a made-up company: executive summary, exhibits, risks and decisions."
  },
  {
    name: "lesson",
    title: "Science lesson",
    description: "Why the Moon has phases, for ages 10 to 12: a live model, predictions and an exit ticket."
  }
];

function listTemplates() {
  return TEMPLATES.map((template) => ({
    ...template,
    dir: path.join(TEMPLATE_ROOT, template.name)
  }));
}

function resolveTemplate(name = DEFAULT_TEMPLATE) {
  const template = listTemplates().find((item) => item.name === name);
  if (!template) {
    const names = TEMPLATES.map((item) => item.name).join(", ");
    throw new ByeslideError(`Unknown template "${name}". Choose one of: ${names}.`);
  }
  return template;
}

module.exports = {
  DEFAULT_TEMPLATE,
  SHARED_DIR,
  TEMPLATE_ROOT,
  listTemplates,
  resolveTemplate
};
