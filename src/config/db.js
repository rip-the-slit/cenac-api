import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import getRelativeFilePath from "./getRelativeFilePath.js";

const dbPath = path.resolve("students.db");
const SQL = await initSqlJs();

const sqliteDb = fs.existsSync(dbPath)
  ? new SQL.Database(fs.readFileSync(dbPath))
  : new SQL.Database();

let transactionDepth = 0;
let pendingPersist = false;

function writeDatabaseFile() {
  fs.writeFileSync(dbPath, sqliteDb.export());
}

function persist() {
  if (transactionDepth > 0) {
    pendingPersist = true;
    return;
  }

  writeDatabaseFile();
}

function flushPersist() {
  if (!pendingPersist) return;

  writeDatabaseFile();
  pendingPersist = false;
}

function normalizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }

  return params;
}

class StatementAdapter {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
  }

  all(...params) {
    const statement = this.database.prepare(this.sql);

    try {
      const rows = [];
      statement.bind(normalizeParams(params));

      while (statement.step()) {
        rows.push(statement.getAsObject());
      }

      return rows;
    } finally {
      statement.free();
    }
  }

  get(...params) {
    const statement = this.database.prepare(this.sql);

    try {
      statement.bind(normalizeParams(params));
      return statement.step() ? statement.getAsObject() : undefined;
    } finally {
      statement.free();
    }
  }

  run(...params) {
    const statement = this.database.prepare(this.sql);

    try {
      statement.bind(normalizeParams(params));

      while (statement.step()) {
        // Exhaust the statement so SQLite applies the mutation fully.
      }

      const changes = this.database.getRowsModified();
      const row = this.database.exec('SELECT last_insert_rowid() AS id')[0]?.values?.[0];
      persist();

      return {
        changes,
        lastInsertRowid: row?.[0],
      };
    } finally {
      statement.free();
    }
  }
}

const db = {
  exec(sql) {
    const result = sqliteDb.exec(sql);
    persist();
    return result;
  },

  prepare(sql) {
    return new StatementAdapter(sqliteDb, sql);
  },

  transaction(callback) {
    const isOuterTransaction = transactionDepth === 0;
    transactionDepth++;

    if (isOuterTransaction) {
      sqliteDb.run("BEGIN TRANSACTION");
    }

    try {
      const result = callback();

      if (isOuterTransaction) {
        sqliteDb.run("COMMIT");
      }

      transactionDepth--;

      if (isOuterTransaction) {
        flushPersist();
      }

      return result;
    } catch (error) {
      if (isOuterTransaction) {
        sqliteDb.run("ROLLBACK");
        pendingPersist = false;
      }

      transactionDepth--;
      throw error;
    }
  },
};

const tableCreationFilePath = getRelativeFilePath(import.meta.url, "./tableCreation.sql");
const initDataFilePath = getRelativeFilePath(import.meta.url, "./initData.sql");
const tableCreation = fs.readFileSync(tableCreationFilePath, "utf-8");
const initData = fs.readFileSync(initDataFilePath, "utf-8");

db.exec(tableCreation);
db.exec(initData);

export default db;
