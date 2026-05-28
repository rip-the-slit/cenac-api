import { Router } from "express";
import userRoutes from "./userRoutes.js";
import periodRoutes from "./periodRoutes.js";
import gradeRoutes from "./gradeRoutes.js";
import yearRoutes from "./yearRoutes.js";
import subjectRoutes from "./subjectRoutes.js";
import getRelativeFilePath from "../config/getRelativeFilePath.js";

const router = Router();

router.use("/users", userRoutes);
router.use("/periods", periodRoutes);
router.use("/grades", gradeRoutes);
router.use("/years", yearRoutes);
router.use("/subjects", subjectRoutes);

export default router;