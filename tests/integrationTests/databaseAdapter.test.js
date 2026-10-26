import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import createDatabase from "../../src/config/sqliteDatabase.js";

let db;
beforeEach(() => {
  db = createDatabase(":memory:");
  db.exec("CREATE TABLE sample(id INTEGER PRIMARY KEY, label TEXT UNIQUE, value, payload BLOB)");
});
afterEach(() => db.close());

test("preserves synchronous results, parameter forms, binary values and missing rows", () => {
  expect(db.prepare("INSERT INTO sample(label,value,payload) VALUES (?,?,?)")
    .run(["José", true, new Uint8Array([0, 127, 255])]))
    .toEqual({ changes: 1, lastInsertRowid: 1 });
  const row = db.prepare("SELECT * FROM sample WHERE id=?").get(1);
  expect(row.label).toBe("José");
  expect(row.value).toBe(1);
  expect(Array.from(row.payload)).toEqual([0, 127, 255]);
  expect(db.prepare("SELECT * FROM sample WHERE id=?").get(100)).toBeUndefined();
  expect(db.prepare("SELECT * FROM sample").all()).toHaveLength(1);
  expect(db.prepare("SELECT ? AS date, ? AS nullable, ? AS decimal")
    .get("2010-04-15", null, 12.5))
    .toEqual({ date: "2010-04-15", nullable: null, decimal: 12.5 });
});

test("supports RETURNING and preserves SQLite errors without poisoning the connection", () => {
  expect(db.prepare("INSERT INTO sample(label) VALUES (?) RETURNING id,label").get("one"))
    .toEqual({ id: 1, label: "one" });
  expect(db.prepare("INSERT INTO sample(label) VALUES (?) RETURNING id").run("two"))
    .toEqual({ changes: 1, lastInsertRowid: 2 });
  expect(() => db.prepare("INSERT INTO sample(label) VALUES (?)").run("one"))
    .toThrow(expect.objectContaining({ code: "SQLITE_CONSTRAINT" }));
  expect(db.prepare("SELECT COUNT(*) AS count FROM sample").get()).toEqual({ count: 2 });
});

test("commits nested callbacks together and rolls back failures", () => {
  expect(db.transaction(() => {
    db.prepare("INSERT INTO sample(label) VALUES (?)").run("outer");
    return db.transaction(() => db.prepare("INSERT INTO sample(label) VALUES (?)").run("inner"));
  })).toEqual({ changes: 1, lastInsertRowid: 2 });
  expect(() => db.transaction(() => {
    db.prepare("INSERT INTO sample(label) VALUES (?)").run("rollback");
    db.transaction(() => { throw new Error("stop"); });
  })).toThrow("stop");
  expect(db.prepare("SELECT label FROM sample ORDER BY id").all())
    .toEqual([{ label: "outer" }, { label: "inner" }]);
  expect(() => db.transaction(async () => {})).toThrow("must be synchronous");
  expect(db.transaction(() => 42)).toBe(42);
});

test("rejects promise-returning transactions and prevents continuation writes", async () => {
  let continuation;
  expect(() => db.transaction(() => {
    db.prepare("INSERT INTO sample(label) VALUES (?)").run("rollback");
    continuation = Promise.resolve().then(() => {
      db.prepare("INSERT INTO sample(label) VALUES (?)").run("too late");
    });
    return continuation;
  })).toThrow("must be synchronous");
  await expect(continuation).rejects.toThrow("must be synchronous");
});

test("resets test databases, closes idempotently, and rejects use after close", () => {
  db.reset();
  expect(() => db.prepare("SELECT * FROM sample").all()).toThrow("no such table");
  db.close();
  db.close();
  expect(() => db.exec("SELECT 1")).toThrow("Database closed");
});

test("transports large results without a fixed shared-memory result limit", () => {
  const text = "x".repeat(2 * 1024 * 1024);
  db.prepare("INSERT INTO sample(label) VALUES (?)").run(text);
  expect(db.prepare("SELECT label FROM sample").get().label).toBe(text);
});

test("reports startup errors and validates timeout configuration", () => {
  expect(() => createDatabase(":memory:", { timeoutMs: 0 })).toThrow("positive integer");
  expect(() => createDatabase(path.join(os.tmpdir(), "missing-cenac-directory", "db.sqlite")))
    .toThrow(expect.objectContaining({ code: "SQLITE_CANTOPEN" }));
});

test.each(["stall", "exit"])("bounds worker %s failures and refuses retries", (sql) => {
  const broken = createDatabase(":memory:", {
    timeoutMs: 1000,
    workerUrl: new URL("../fixtures/sqliteWorkerFailure.cjs", import.meta.url),
  });
  try {
    expect(() => broken.exec(sql)).toThrow("timed out");
    expect(() => broken.exec("write must not be retried")).toThrow("timed out");
  } finally {
    broken.close();
  }
});

test("persists to disk across processes and does not keep a process alive", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cenac-adapter-test-"));
  const filename = path.join(directory, "test.db");
  const child = spawnSync(process.execPath, ["--expose-gc", "-e", `
    import(${JSON.stringify(new URL("../../src/config/sqliteDatabase.js", import.meta.url).href)})
      .then(({default:create}) => {
        const db = create(process.argv[1]);
        db.exec("CREATE TABLE saved(value TEXT)");
        db.prepare("INSERT INTO saved VALUES (?)").run("persisted");
        // Deliberately leave the worker open: it must not prevent process exit.
      });
  `, filename], { encoding: "utf8", timeout: 10000 });
  let reopened;
  try {
    expect(child.error).toBeUndefined();
    expect(child.status).toBe(0);
    reopened = createDatabase(filename);
    expect(reopened.prepare("SELECT value FROM saved").get()).toEqual({ value: "persisted" });
    expect(reopened.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    expect(reopened.prepare("PRAGMA cache_size").get()).toEqual({ cache_size: -1024 });
    expect(reopened.prepare("PRAGMA mmap_size").get()).toEqual({ mmap_size: 0 });
    expect(reopened.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 0 });
  } finally {
    reopened?.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
