import db from '../config/db.js';
import { User } from '../models/index.js';

class UserRepository {
  constructor(db) {
    this.db = db;
  }

  findById(id) {
    const query = this.db.prepare(`SELECT user.id, user.name, user.password, user_level.name as "userLevel" 
                                  FROM user JOIN user_level ON user.user_level_id = user_level.id 
                                  WHERE user.id = ?`);
    const result = query.get(id);
    
    if (!result) return null;
    return new User(result.id, result.name, result.userLevel, result.password);
  }

  findAll() {
    const query = this.db.prepare(`SELECT user.id, user.name, user_level.name as "userLevel" FROM user 
                                  JOIN user_level ON user.user_level_id = user_level.id`);
    const results = query.all();
    
    return results.map(row => new User(row.id, row.name, row.userLevel));
  }

  findAllUserLevels() {
    const query = this.db.prepare(`SELECT name FROM user_level`);
    const results = query.all();

    return results.map(row => row.name);
  }

  create(user) {
    const query = this.db.prepare(`INSERT INTO user (id, name, user_level_id, password) 
                                  VALUES (?, ?, (SELECT user_level.id FROM user_level WHERE user_level.name = ?), ?)`);
    return query.run(user.id, user.name, user.userLevel, user.password);
  }

  update(id, userData) {
    const query = this.db.prepare(`UPDATE user 
                                  SET name = ?, 
                                  user_level_id = (SELECT user_level.id FROM user_level WHERE user_level.name = ?), 
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