import UserRepository from "../repositories/UserRepository.js";

class UserService {
  constructor(userRepository) {
    this.userRepository = userRepository;
    this.activeUser = null
  }

  // GET /users → getUsers()
  // Returns { users: [{ id, name, type }], activeUser: null }
  getUsers() {
    const users = this.userRepository.findAll().map((u) => ({
      id: u.id,
      name: u.name,
      type: u.userLevel,
    }));

    return { users, activeUser: this.activeUser };
  }

  // POST /auth/login → login(userId)
  login(userId) {
    const user = this.userRepository.findById(userId);
    if (!user) throw new Error("Usuario no registrado");
    this.activeUser = user;
  }

  // POST /auth/logout → logout()
  logout() {
    this.activeUser = null;
  }
}

export default new UserService(UserRepository);