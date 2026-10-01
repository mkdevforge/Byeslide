const readline = require("node:readline");
const { ByeslideError } = require("./errors");

// Lets a person pick a template with the arrow keys (or 1, 2, 3) and Enter.
// Only call this when input and output are a terminal.
function pickTemplate(templates, { input = process.stdin, output = process.stdout } = {}) {
  return new Promise((resolve, reject) => {
    let selected = 0;
    let drawnLines = 0;
    const nameWidth = Math.max(...templates.map((template) => template.name.length));

    const draw = () => {
      if (drawnLines > 0) {
        output.write(`\x1b[${drawnLines}A\x1b[0J`);
      }
      const lines = [
        "Which deck do you want to start from?",
        ...templates.map((template, index) => {
          const marker = index === selected ? ">" : " ";
          const name = template.name.padEnd(nameWidth);
          const line = `${marker} ${index + 1}. ${name}  ${template.description}`;
          return index === selected ? `\x1b[1m${line}\x1b[22m` : line;
        }),
        "Up and Down to move, Enter to choose, Ctrl+C to stop."
      ];
      output.write(`${lines.join("\n")}\n`);
      drawnLines = lines.length;
    };

    const finish = (error, value) => {
      input.removeListener("keypress", onKeypress);
      if (typeof input.setRawMode === "function") {
        input.setRawMode(false);
      }
      input.pause();
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    };

    const onKeypress = (text, key = {}) => {
      if (key.ctrl && key.name === "c") {
        output.write("\n");
        finish(new ByeslideError("Stopped. No deck was created.", { exitCode: 130 }));
        return;
      }
      if (key.name === "up" || key.name === "k") {
        selected = (selected - 1 + templates.length) % templates.length;
        draw();
        return;
      }
      if (key.name === "down" || key.name === "j") {
        selected = (selected + 1) % templates.length;
        draw();
        return;
      }
      const number = Number(text);
      if (Number.isInteger(number) && number >= 1 && number <= templates.length) {
        selected = number - 1;
        draw();
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        finish(null, templates[selected].name);
      }
    };

    readline.emitKeypressEvents(input);
    if (typeof input.setRawMode === "function") {
      input.setRawMode(true);
    }
    input.on("keypress", onKeypress);
    input.resume();
    draw();
  });
}

module.exports = {
  pickTemplate
};
