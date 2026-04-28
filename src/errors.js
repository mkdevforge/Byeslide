class ByeslideError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ByeslideError";
    this.exitCode = options.exitCode || 1;
  }
}

module.exports = {
  ByeslideError
};
