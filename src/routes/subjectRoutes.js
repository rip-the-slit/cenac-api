import { Router } from "express";
import SubjectController from "../controllers/SubjectController.js";

const router = Router();

router.get("/", (req, res) => SubjectController.getSubjects(req, res));
router.get("/suggestions", (req, res) =>
  SubjectController.getSubjectSuggestions(req, res)
);

export default router;
