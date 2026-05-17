import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("students.db", { verbose: console.log });

const sqlFilePath = path.join(__dirname, "tableCreation.sql");
const tableCreation = fs.readFileSync(sqlFilePath, "utf-8");

db.exec(tableCreation);

export default db;