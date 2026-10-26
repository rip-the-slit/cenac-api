import express from "express";
import { configDotenv } from "dotenv";
import open from "open";
import router from "./routes/index.js";
import getRelativeFilePath from "./config/getRelativeFilePath.js";
import db from "./config/db.js";

configDotenv({quiet: true})
const isTesting = process.env.NODE_ENV === "test";
const PORT = 3000;
const app = express();
const notFoundHandler = (req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
};

app.use(express.json());
app.use("/api", router, notFoundHandler);
app.use("/", express.static(getRelativeFilePath(import.meta.url, "../public")));

app.get("/*", (req, res) => {
  res.sendFile(getRelativeFilePath(import.meta.url, "../public/index.html"));
});

app.use(notFoundHandler);
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

if (!isTesting) {
  const server = app.listen(PORT, () => {
    console.log(`Cenac JGR se inició en http://localhost:${PORT}/`);
    open(`http://localhost:${PORT}/`).catch((error) => {
      console.warn(`No se logró abrir el navegador, intente acceder a la url manualmente: ${error.message}`);
    });
  });
  server.on("error", (error) => {
    console.error(`No se logró iniciar Cenac JGR: ${error.message}`);
    db.close();
    process.exitCode = 1;
  });
  server.once("close", () => db.close());
  process.once("SIGINT", () => server.close());
  process.once("SIGTERM", () => server.close());
}

export default app;
