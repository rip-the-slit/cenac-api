import db from "../config/db.js";
import { Class, Guardian, Student } from "../models/index.js";

class StudentRepository {
  constructor(db) {
    this.db = db;
  }

  findById(id) {
    const query = this.db.prepare(`
        SELECT id, first_name as "firstName", last_name as "lastName", birth_date as "birthDate", birth_place as "birthPlace", status
        FROM student
        WHERE id = ?
        `);
    const result = query.get(id);

    if (!result) return null;
    return new Student(
      result.id,
      result.firstName,
      result.lastName,
      result.birthDate,
      result.birthPlace,
      result.status
    );
  }

  findAll() {
    const query = this.db.prepare(`
        SELECT id, first_name as "firstName", last_name as "lastName", birth_date as "birthDate", birth_place as "birthPlace", status
        FROM student
        `);
    const results = query.all();

    return results.map(
      (row) =>
        new Student(
          row.id,
          row.firstName,
          row.lastName,
          row.birthDate,
          row.birthPlace,
          row.status
        )
    );
  }
  
  findAllByClass(classId) {
    const query = this.db.prepare(`
        SELECT student.id, student.first_name as "firstName", student.last_name as "lastName", student.birth_date as "birthDate", student.birth_place as "birthPlace", student.status
        FROM student JOIN student_class ON student.id = student_class.student_id
        WHERE student_class.class_id = ?
        `);
    const results = query.all(classId);
    return results.map(row => new Student(row.id, row.firstName, row.lastName, row.birthDate, row.birthPlace, row.status, classId))
  }

  create(student) {
    const query = this.db.prepare(`
        INSERT INTO student (id, first_name, last_name, birth_date, birth_place, status)
        VALUES (?, ?, ?, ?, ?, ?)
        `);
    return query.run(
      student.id,
      student.firstName,
      student.lastName,
      student.birthDate,
      student.birthPlace,
      student.status
    );
  }

  update(id, studentData) {
    const query = this.db.prepare(`
        UPDATE student
        SET first_name = ?, last_name = ?, birth_date = ?, birth_place = ?, status = ?
        WHERE id = ?
        `);
    return query.run(
      studentData.firstName,
      studentData.lastName,
      studentData.birthDate,
      studentData.birthPlace,
      studentData.status,
      id
    );
  }

  delete(id) {
    const query = this.db.prepare(`DELETE FROM student WHERE id = ?`);
    return query.run(id);
  }

  assignGuardian(studentId, guardianId) {
    const query = this.db.prepare(`
        INSERT INTO student_guardian (student_id, guardian_id)
        VALUES (?, ?)
        `);
    return query.run(studentId, guardianId);
  }

  findAllAssignedGuardians(studentId) {
    const query = this.db.prepare(`SELECT guardian.id, guardian.first_name as "firstName", guardian.last_name as "lastName", guardian.birth_date as "birthDate", guardian.legal_role as "legalRole"
                                  FROM guardian JOIN student_guardian ON guardian.id = student_guardian.guardian_id
                                  WHERE student_guardian.student_id = ?`);
    const results = query.all(studentId);
    return results.map(row => new Guardian(row.id, row.firstName, row.lastName, row.birthDate, row.legalRole));
  }

  assignToClass(studentId, classId, status) {
    const query = this.db.prepare(`
        INSERT INTO student_class (student_id, class_id, status)
        VALUES (?, ?, ?)
        `);
    return query.run(studentId, classId, status);
  }

  findAllAssignedClasses(studentId) {
    const query = this.db.prepare(`SELECT class.id, class.name, class.shift, class.location, class.capacity, class.year_period_id as "yearPeriodId"
                                  FROM class JOIN student_class ON class.id = student_class.class_id
                                  WHERE student_class.student_id = ?`);
    const results = query.all(studentId);
    return results.map(row => new Class(row.id, row.name, row.shift, row.location, row.capacity, row.yearPeriodId));
  }
}

export default new StudentRepository(db);
