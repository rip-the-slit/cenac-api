const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");

process.chdir(__dirname);

if (!process.env.JWT_SECRET) {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, `JWT_SECRET=${randomBytes(32).toString("hex")}\n`, {
      flag: "wx",
    });
  }
}

import("./src/app.js").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
