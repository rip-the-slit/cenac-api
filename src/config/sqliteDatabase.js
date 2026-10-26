import { MessageChannel, receiveMessageOnPort, Worker } from "node:worker_threads";

// MessagePort values can come from Node's host realm (notably under Jest's VM).
// Rebuild them here so callers receive ordinary local arrays/objects/byte arrays.
function localResult(value) {
  if (Array.isArray(value)) return Array.from(value, localResult);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).map((key) => [key, localResult(value[key])]));
  }
  return value;
}

// SQLite callbacks run in the worker while the application's synchronous caller
// sleeps. Only notifications use shared memory; results have no fixed-size cap.
export default function createDatabase(filename, {
  timeoutMs = Number(process.env.CENAC_DB_TIMEOUT_MS || 60_000),
  workerUrl = new URL("./sqliteWorker.cjs", import.meta.url),
} = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new TypeError("CENAC_DB_TIMEOUT_MS must be a positive integer");
  }
  const { port1, port2 } = new MessageChannel();
  const signal = new Int32Array(new SharedArrayBuffer(4));
  const worker = new Worker(workerUrl, {
    workerData: { filename, port: port2, signal }, transferList: [port2],
    // This CJS worker needs no parent flags; Node 16 rejects flags such as
    // --expose-gc here, and --input-type applies only to the parent's input.
    execArgv: [],
  });
  let failure;
  let closed = false;
  let sequence = 0;
  let transactionDepth = 0;

  function invalidate(error) {
    failure ||= error;
    port1.close();
    worker.terminate().catch(() => {});
    return failure;
  }
  worker.on("error", (error) => invalidate(error));
  worker.on("exit", (code) => {
    if (!closed && !failure) invalidate(new Error(`SQLite worker exited unexpectedly (${code})`));
  });
  worker.unref();
  port1.unref();

  function receive(id) {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const version = Atomics.load(signal, 0);
      const packet = receiveMessageOnPort(port1);
      if (packet) {
        const response = packet.message;
        if (response.id !== id) throw invalidate(new Error("Unexpected SQLite worker response"));
        if (!response.ok) {
          const error = new Error(response.error.message);
          error.name = response.error.name || "Error";
          if (response.error.code) error.code = response.error.code;
          throw error;
        }
        return localResult(response.result);
      }
      if (failure) throw failure;
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw invalidate(new Error(
          "SQLite worker timed out; restart the application. The last write may have committed."
        ));
      }
      // A counter change between reading the port and sleeping prevents a lost
      // notification. No main-thread event callback is needed to receive rows.
      Atomics.wait(signal, 0, version, remaining);
    }
  }
  function request(operation, sql, params) {
    if (failure) throw failure;
    if (closed) throw new Error("Database closed");
    const id = ++sequence;
    port1.postMessage({ id, operation, sql, params });
    return receive(id);
  }
  try {
    receive(0);
  } catch (error) {
    throw invalidate(error);
  }

  return {
    prepare(sql) {
      const statement = {};
      for (const operation of ["get", "all", "run"]) {
        statement[operation] = (...params) => request(operation, sql,
          params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
      }
      return statement;
    },
    exec(sql) {
      return request("exec", sql);
    },
    transaction(callback) {
      if (typeof callback !== "function" || callback.constructor?.name === "AsyncFunction") {
        throw new TypeError("Database transaction callbacks must be synchronous functions");
      }
      const outer = transactionDepth === 0;
      if (outer) request("exec", "BEGIN TRANSACTION");
      transactionDepth++;
      let asynchronous = false;
      try {
        const result = callback();
        if (result && typeof result.then === "function") {
          asynchronous = true;
          Promise.resolve(result).catch(() => {});
          throw new TypeError("Database transaction callbacks must be synchronous");
        }
        if (outer) request("exec", "COMMIT");
        return result;
      } catch (error) {
        if (outer && !failure) {
          try {
            request("exec", "ROLLBACK");
          } catch (rollbackError) {
            invalidate(rollbackError);
          }
        }
        // A promise-returning callback may try to write after its rollback.
        // Refuse all further operations rather than let those writes escape.
        if (asynchronous) invalidate(error);
        throw error;
      } finally {
        transactionDepth--;
      }
    },
    reset() {
      if (process.env.NODE_ENV !== "test") return;
      if (transactionDepth) throw new Error("Cannot reset during a transaction");
      request("reset");
    },
    close() {
      if (closed) return;
      if (transactionDepth) throw new Error("Cannot close during a transaction");
      try {
        if (!failure) request("close");
      } finally {
        closed = true;
        port1.close();
        worker.terminate().catch(() => {});
      }
    },
  };
}
