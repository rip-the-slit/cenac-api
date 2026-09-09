import { Router } from "express";
import UserController from "../controllers/UserController.js";
import AuthMiddleware from "../middleware/AuthMiddleware.js";

const router = Router();

router.get("/", (req, res) => UserController.getUsers(req, res));
router.post("/login", (req, res) => UserController.login(req, res));
router.use((req, res, next) => AuthMiddleware.verifyToken(req, res, next));
router.post("/logout", (req, res) => UserController.logout(req, res));
router.use((req, res, next) => AuthMiddleware.checkRole("Administrador")(req, res, next));
router.post("/register", (req, res) => UserController.register(req, res));
router.post("/:id/edit", (req, res) => UserController.update(req, res));
router.post("/:id/delete", (req, res) => UserController.delete(req, res));

export default router;