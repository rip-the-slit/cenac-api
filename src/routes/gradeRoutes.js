import { Router } from "express";
import GradeController from "../controllers/GradeController.js";

const router = Router();

router.get("/", (req, res) => GradeController.getGrades(req, res));
router.post("/load", (req, res) => GradeController.loadGrades(req, res));

export default router;