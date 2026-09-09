import { Router } from "express";
import userRoutes from "./userRoutes.js";
import periodRoutes from "./periodRoutes.js";
import gradeRoutes from "./gradeRoutes.js";
import yearRoutes from "./yearRoutes.js";
import subjectRoutes from "./subjectRoutes.js";
import reportRoutes from "./reportRoutes.js";
import AuthMiddleware from "../middleware/AuthMiddleware.js";

const router = Router();

router.use((req, res, next) => AuthMiddleware.parseCookies(req, res, next));
router.use("/users", userRoutes);
router.use((req, res, next) => AuthMiddleware.verifyToken(req, res, next));
router.use("/periods", periodRoutes);
router.use("/grades", gradeRoutes);
router.use("/years", yearRoutes);
router.use("/subjects", subjectRoutes);
router.use("/reports", reportRoutes);

export default router;
