import express from "express";
import router from "./routes/index.js";
import open from "open";
import getRelativeFilePath from "./config/getRelativeFilePath.js";

const PORT = 3000;
const app = express();

app.use(express.json());
app.use("/", express.static(getRelativeFilePath(import.meta.url, "../public")))
app.get("/", (req, res) => {
  res.sendFile(getRelativeFilePath(import.meta.url, "../../public/index.html"));
})
app.use("/api", router);

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(PORT, console.log)
open(`http://localhost:${PORT}/`)

export default app;