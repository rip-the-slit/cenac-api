import { Router } from "express";
import UserController from "../controllers/UserController.js";

const router = Router();

router.get("/", (req, res) => UserController.getUsers(req, res));
router.post("/login", (req, res) => UserController.login(req, res));
router.post("/logout", (req, res) => UserController.logout(req, res));

export default router;