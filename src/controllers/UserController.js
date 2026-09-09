import UserService from "../services/UserService.js";
import jwt from "jsonwebtoken";
import { parseCookie } from "./httpUtils.js";

class UserController {
  constructor(userService) {
    this.userService = userService;
  }

  getUsers(req, res) {
    try {
      const data = this.userService.getUsers();
      res.json(data);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  }

  async login(req, res) {
    try {
      const { id, password } = req.body;
      if (!id || !password)
        return res
          .status(400)
          .json({ error: "La ID de usuario y la contraseña son requeridas." });
      const data = await this.userService.login(id, password);
      res.cookie("token", data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== "test",
        sameSite: "strict",
        maxAge: 60 * 60000,
        path: "/",
      });
      res.json(true);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  }

  async register(req, res) {
    try {
      const { name, password, userLevel } = req.body;
      if (!name || !password || !userLevel) {
        return res.status(400).json({ error: "Todos los campos son requeridos." });
      }

      res.json(await this.userService.register({ name, password, userLevel }));
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  }

  async update(req, res) {
    try {
      const { name, password, userLevel } = req.body;

      res.json(await this.userService.update(req.params.id, { name, password, userLevel }));
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  }

  delete(req, res) {
    try {
      const token = parseCookie(req.headers.cookie).token;
      if (!token) return res.status(401).json({ error: "No autenticado." });
      const activeUser = jwt.verify(token, process.env.JWT_SECRET);

      res.json(this.userService.delete(req.params.id, activeUser.id));
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  }

  logout(req, res) {
    try {
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV !== "test",
        sameSite: "strict",
        path: "/",
      });
      res.json(true);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  }
}

export default new UserController(UserService);
