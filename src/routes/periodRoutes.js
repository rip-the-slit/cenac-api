import { Router } from "express";
import PeriodController from "../controllers/PeriodController.js";

const router = Router();

router.get("/", (req, res) => PeriodController.getPeriodList(req, res));
router.get("/suggestions",     (req, res) => PeriodController.getClassSuggestions(req, res));
router.get("/:id", (req, res) => PeriodController.getPeriodStats(req, res));
router.get("/:id/classes", (req, res) => PeriodController.getClassesByYear(req, res));
router.get("/:id/students", (req, res) => PeriodController.getStudentsByPeriod(req, res));
router.get("/:id/students/:studentId",(req, res) => PeriodController.getStudentById(req, res));
router.post("/:id/load", (req, res) => PeriodController.loadPeriodData(req, res));

export default router;