"use strict";

const { workerData } = require("node:worker_threads");
const { filename, port, signal } = workerData;
let connection;

function reply(id, result, error) {
  port.postMessage(error ? {
    id, ok: false,
    error: { name: error.name, message: error.message, code: error.code },
  } : { id, ok: true, result });
  Atomics.add(signal, 0, 1);
  Atomics.notify(signal, 0);
}
function exec(sql) {
  return new Promise((resolve, reject) => connection.exec(sql,
    (error) => error ? reject(error) : resolve([])));
}
function close() {
  return new Promise((resolve, reject) => connection.close(
    (error) => error ? reject(error) : resolve()));
}
async function open() {
  // Report addon-loading errors through the port while the caller is blocked.
  const sqlite3 = require("sqlite3");
  await new Promise((resolve, reject) => {
    connection = new sqlite3.Database(filename,
      (error) => error ? reject(error) : resolve());
  });
  connection.configure("busyTimeout", 5000);
  await exec(`
    PRAGMA cache_size=-1024;
    PRAGMA mmap_size=0;
    PRAGMA journal_mode=DELETE;
    PRAGMA synchronous=FULL;
    PRAGMA foreign_keys=OFF;
  `);
}
function normalizeParam(value) {
  if (typeof value === "boolean") return Number(value);
  if (value instanceof Uint8Array || Array.isArray(value)) return Buffer.from(value);
  if (value === null || typeof value === "string" || typeof value === "number") return value;
  throw new TypeError("Unsupported SQLite parameter type");
}
async function execute({ operation, sql, params }) {
  if (operation === "exec") return exec(sql);
  if (operation === "close") return close();
  if (operation === "reset") {
    if (filename !== ":memory:") throw new Error("Only in-memory test databases can be reset");
    await close();
    return open();
  }
  if (!["get", "all", "run"].includes(operation)) throw new Error("Unknown SQLite operation");
  const values = params.map(normalizeParam);
  const statement = await new Promise((resolve, reject) => {
    const prepared = connection.prepare(sql,
      (error) => error ? reject(error) : resolve(prepared));
  });
  let rows;
  try {
    // Consume RETURNING rows for run(), as the old adapter's step loop did.
    rows = await new Promise((resolve, reject) => statement[
      operation === "get" ? "get" : "all"
    ](values, (error, result) => error ? reject(error) : resolve(result)));
  } finally {
    await new Promise((resolve, reject) => statement.finalize(
      (error) => error ? reject(error) : resolve()));
  }
  if (operation !== "run") return rows;
  return new Promise((resolve, reject) => connection.get(
    "SELECT changes() AS changes, last_insert_rowid() AS lastInsertRowid",
    (error, result) => error ? reject(error) : resolve(result)));
}

open().then(() => {
  let pending = Promise.resolve();
  port.on("message", (message) => {
    pending = pending.then(async () => {
      try {
        reply(message.id, await execute(message));
        if (message.operation === "close") port.close();
      } catch (error) {
        reply(message.id, undefined, error);
      }
    });
  });
  reply(0);
}).catch((error) => {
  reply(0, undefined, error);
  port.close();
});
