import fs from "node:fs";
import path from "node:path";
import createDatabase from "./sqliteDatabase.js";
import getRelativeFilePath from "./getRelativeFilePath.js";
import seedPeriodData from "./seedPeriodData.js";

const isTesting = process.env.NODE_ENV === "test";
const db = createDatabase(isTesting ? ":memory:" : path.resolve("students.db"));

try {
  db.transaction(() => {
    for (const filename of ["tableCreation.sql", "initData.sql"]) {
      db.exec(fs.readFileSync(getRelativeFilePath(import.meta.url, `./${filename}`), "utf8"));
    }
    if (!isTesting) seedPeriodData(db);
  });
} catch (error) {
  db.close();
  throw error;
}

export default db;
