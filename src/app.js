import express from "express";
import { configDotenv } from "dotenv";
import open from "open";
import router from "./routes/index.js";
import getRelativeFilePath from "./config/getRelativeFilePath.js";

configDotenv({quiet: true})
const isTesting = process.env.NODE_ENV === "test";
const PORT = 3000;
const app = express();

app.use(express.json());
app.use("/", express.static(getRelativeFilePath(import.meta.url, "../public")));
app.get("/", (req, res) => {
  res.sendFile(getRelativeFilePath(import.meta.url, "../../public/index.html"));
});
app.use("/api", router);

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

if (!isTesting) {
  const server = app.listen(PORT, () => {
    console.log(`Cenac JGR se inició en http://localhost:${PORT}/`);
    /* open(`http://localhost:${PORT}/`).catch((error) => {
      console.warn(`No se logró abrir el navegador, intente acceder a la url manualmente: ${error.message}`);
    }); */
  });
  server.on("error", (error) => {
    console.error(`No se logró iniciar Cenac JGR: ${error.message}`);
    process.exitCode = 1;
  });
}

export default app;
