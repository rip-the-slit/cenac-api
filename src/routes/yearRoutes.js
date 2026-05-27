import { Router } from "express";
import YearController from "../controllers/YearController.js";

const router = Router();

router.get("/", (req, res) => YearController.getYears(req, res));

export default router;