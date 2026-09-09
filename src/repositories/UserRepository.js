import db from '../config/db.js';
import { User } from '../models/index.js';

class UserRepository {
  constructor(db) {
    this.db = db;
  }

  findById(id) {
    const query = this.db.prepare(`SELECT id, name, password, user_level as "userLevel"
                                  FROM user WHERE id = ?`);
    const result = query.get(id);
    
    if (!result) return null;
    return new User(result.id, result.name, result.userLevel, result.password);
  }

  findAll() {
    const query = this.db.prepare(
      `SELECT id, name, user_level as "userLevel" FROM user`
    );
    const results = query.all();
    
    return results.map(row => new User(row.id, row.name, row.userLevel));
  }

  findAllUserLevels() {
    return ["Administrador", "Coordinador", "Profesor"];
  }

  create(user) {
    const query = this.db.prepare(
      `INSERT INTO user (name, user_level, password) VALUES (?, ?, ?)`
    );
    return query.run(
      user.name,
      user.userLevel,
      user.password
    )
  }

  update(id, userData) {
    const query = this.db.prepare(`UPDATE user 
                                  SET name = ?, 
                                  user_level = ?, 
                                  password = ? 
                                  WHERE id = ?`);
    return query.run(userData.name, userData.userLevel, userData.password, id);
  }

  delete(id) {
    const query = this.db.prepare(`DELETE FROM user WHERE id = ?`);
    return query.run(id);
  }
}

export default new UserRepository(db);