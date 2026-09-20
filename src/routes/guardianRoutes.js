import { Router } from "express";
import GuardianController from "../controllers/GuardianController.js";
import AuthMiddleware from "../middleware/AuthMiddleware.js";

const router = Router();

router.get("/", (req, res) => GuardianController.getGuardians(req, res));
router.get("/:id", (req, res) => GuardianController.getGuardianById(req, res));

router.use((req, res, next) =>
  AuthMiddleware.checkRole("Administrador", "Coordinador")(req, res, next)
);
router.post("/", (req, res) => GuardianController.createGuardian(req, res));
router.post("/:id/edit", (req, res) =>
  GuardianController.updateGuardian(req, res)
);

export default router;
