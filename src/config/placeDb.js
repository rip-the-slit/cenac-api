import fs from "node:fs";
import createDatabase from "./sqliteDatabase.js";
import getRelativeFilePath from "./getRelativeFilePath.js";

let db;

export default function getPlaceDatabase() {
  if (!db) {
    const filename = getRelativeFilePath(import.meta.url, "../../geonames-full.db");
    fs.accessSync(filename, fs.constants.R_OK);
    db = createDatabase(filename);
  }
  return db;
}
