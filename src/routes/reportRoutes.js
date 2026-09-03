import { Router } from "express";
import ReportController from "../controllers/ReportController.js";

const router = Router();

router.get("/", (req, res) =>
  ReportController.getReportOptionData(req, res)
);
router.get("/grades", (req, res) =>
  ReportController.generateGradesReport(req, res)
);

export default router;
