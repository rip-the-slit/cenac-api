// Simulate failures without executing a long-running native SQLite query.
const { port, signal } = require("node:worker_threads").workerData;
port.on("message", ({ sql }) => {
  if (sql === "exit") process.exit(1);
  // All other requests deliberately receive no response.
});
port.postMessage({ id: 0, ok: true });
Atomics.add(signal, 0, 1);
Atomics.notify(signal, 0);
