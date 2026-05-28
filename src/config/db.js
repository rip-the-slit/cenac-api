import Database from "better-sqlite3";
import fs from "fs";
import getRelativeFilePath from "./getRelativeFilePath.js";

const db = new Database("students.db", {verbose: console.log});

const tableCreationFilePath = getRelativeFilePath(import.meta.url, "./tableCreation.sql");
const initDataFilePath = getRelativeFilePath(import.meta.url, "./initData.sql");
const tableCreation = fs.readFileSync(tableCreationFilePath, "utf-8");
const initData = fs.readFileSync(initDataFilePath, "utf-8");

db.exec(tableCreation);

db.exec(initData);

export default db;