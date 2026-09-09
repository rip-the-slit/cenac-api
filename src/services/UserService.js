import bcrypt from "bcryptjs/dist/bcrypt.js";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import UserRepository from "../repositories/UserRepository.js";

class UserService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  getUsers() {
    const users = this.userRepository
      .findAll()
      .map((u) => new User(u.id, u.name, u.userLevel));

    return users;
  }

  async login(id, password) {
    const user = this.userRepository.findById(id);
    const isMatch = user && await bcrypt.compare(password, user.password);

    if (!user || !isMatch) throw new Error("Credenciales inválidas.");

    return {
      token: jwt.sign(
        { ...new User(user.id, user.name, user.userLevel) },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      ),
    };
  }

  async register(userData) {
    const password = await bcrypt.hash(userData.password, 12);
    const result = this.userRepository.create({ ...userData, password });

    return new User(result.lastInsertRowid, userData.name, userData.userLevel);
  }

  async update(id, userData) {
    const currentUser = this.userRepository.findById(id);
    const userLevels = this.userRepository.findAllUserLevels()
    if (!currentUser) throw new Error("Usuario no encontrado.");

    const userLevel = userLevels.includes(userData.userLevel)
      ? userData.userLevel
      : currentUser.userLevel;
    const password = userData.password
      ? await bcrypt.hash(userData.password, 12)
      : currentUser.password;
    this.userRepository.update(id, { ...userData, userLevel, password });

    return new User(Number(id), userData.name, userLevel);
  }

  delete(id, activeUserId) {
    if (Number(id) === Number(activeUserId)) {
      const error = new Error("No puede eliminar su propio usuario.");
      error.status = 403;
      throw error;
    }

    const user = this.userRepository.findById(id);
    if (!user) throw new Error("Usuario no encontrado.");

    this.userRepository.delete(id);
    return true;
  }
}

export default new UserService(UserRepository);
