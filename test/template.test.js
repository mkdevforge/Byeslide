const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const { listHtmlFiles } = require("../src/fs-utils");
const { SHARED_DIR, listTemplates } = require("../src/templates");

for (const template of listTemplates()) {
  const dir = template.dir;

  test(`${template.name}: styles do not apply slide layout to the Reveal root`, async () => {
    const css = await fs.readFile(path.join(dir, "styles.css"), "utf8");

    assert.doesNotMatch(css, /(^|\n)\.slide\s*\{/);
    assert.match(css, /(^|\n)\.reveal \.slides section\.slide\s*\{/);
  });

  test(`${template.name}: slides expose print padding for Reveal print view`, async () => {
    const css = await fs.readFile(path.join(dir, "styles.css"), "utf8");

    assert.match(css, /--byeslide-slide-padding: var\(--slide-padding\);/);
  });

  test(`${template.name}: every slide has speaker notes and a content file`, async () => {
    const slides = await listHtmlFiles(path.join(dir, "slides"));
    assert.ok(slides.length > 0);

    for (const slide of slides) {
      const name = path.basename(slide, ".html");
      const html = await fs.readFile(slide, "utf8");
      assert.match(html, /<aside\s+class=["']notes["']/i, `slides/${name}.html needs speaker notes`);

      const content = await fs.readFile(path.join(dir, "content", `${name}.md`), "utf8");
      assert.match(content, /^# /m, `content/${name}.md needs a heading`);
      assert.match(content, /^## Speaker notes$/m, `content/${name}.md needs a Speaker notes section`);
    }

    const contentFiles = (await fs.readdir(path.join(dir, "content"))).filter((file) => file.endsWith(".md"));
    assert.equal(contentFiles.length, slides.length);
  });

  test(`${template.name}: has patterns and a README`, async () => {
    const patterns = await listHtmlFiles(path.join(dir, "patterns"));
    assert.ok(patterns.length > 0);
    await fs.access(path.join(dir, "README.md"));
    await fs.access(path.join(dir, "deck.config.js"));
  });
}

test("every shared agent skill has a name and description header", async () => {
  const skillsDir = path.join(SHARED_DIR, ".codex", "skills");
  const skills = await fs.readdir(skillsDir);

  assert.ok(skills.length > 0);
  for (const skill of skills) {
    const text = await fs.readFile(path.join(skillsDir, skill, "SKILL.md"), "utf8");
    const header = text.match(/^---\r?\nname: (.+)\r?\ndescription: (.+)\r?\n---\r?\n/);
    assert.ok(header, `${skill}/SKILL.md needs a name and description header`);
    assert.equal(header[1], skill);
  }
});
