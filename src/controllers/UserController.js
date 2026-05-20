import UserService from "../services/UserService.js";

class UserController {
  constructor(userService) {
    this.userService = userService;
  }

  getUsers(req, res) {
    try {
      const data = this.userService.getUsers();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  login(req, res) {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId es requerido" });
      const data = this.userService.login(userId);
      res.json(true);
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  }

  logout(req, res) {
    try {
      const data = this.userService.logout();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
}

export default new UserController(UserService);