import { Router } from "express";
import SubjectController from "../controllers/SubjectController.js";

const router = Router();

router.get("/", (req, res) => SubjectController.getSubjects(req, res));

export default router;