const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function loadPlaywrightTest() {
  try {
    return require("playwright/test");
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") {
      throw error;
    }
  }

  const playwrightBin = execFileSync("bash", ["-lc", "command -v playwright"], {
    encoding: "utf8",
  }).trim();
  const realBin = fs.realpathSync(playwrightBin);
  const modulePath = path.resolve(
    path.dirname(realBin),
    "../lib/node_modules/playwright/test",
  );

  return require(modulePath);
}

module.exports = loadPlaywrightTest();
