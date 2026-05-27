import db from "../config/db.js";
import { Grade, Subject } from "../models/index.js";

class SubjectRepository {
  constructor(db) {
    this.db = db;
  }

  findById(id) {
    const query = this.db.prepare(`
      SELECT *, minimum_grade as "minimumGrade" 
      FROM subject 
      WHERE id = CAST(? AS INTEGER)
    `);
    const result = query.get(id);

    if (!result) return null;
    return new Subject(
      result.id,
      result.name,
      result.abbr,
      result.minimumGrade
    );
  }

  findAll() {
    const query = this.db.prepare(`
      SELECT *, minimum_grade as "minimumGrade" 
      FROM subject
    `);
    const results = query.all();

    return results.map(
      (row) => new Subject(row.id, row.name, row.abbr, row.minimumGrade)
    );
  }

  create(subject) {
    const query = this.db.prepare(`
      INSERT INTO subject (id, name, minimum_grade) 
      VALUES (?, ?, ?)
    `);
    return query.run(subject.id, subject.name, subject.minimumGrade);
  }

  update(id, subjectData) {
    const query = this.db.prepare(`
      UPDATE subject 
      SET name = ?, minimum_grade = ? 
      WHERE id = CAST(? AS INTEGER)
    `);
    return query.run(subjectData.name, subjectData.minimumGrade, id);
  }

  delete(id) {
    const query = this.db.prepare(
      `DELETE FROM subject WHERE id = CAST(? AS INTEGER)`
    );
    return query.run(id);
  }

  assignGrade(grade) {
    const id =
      !grade.id &&
      this.db
        .prepare(
          `SELECT id FROM grade WHERE student_id = ? AND year_subject_id = ? AND term = ? AND strategy = ?`
        )
        .get(grade.studentId, grade.yearSubjectId, grade.term, grade.strategy);

    if (grade.id !== undefined && grade.id !== null && grade.id !== "") {
      const query = this.db.prepare(`
        INSERT INTO grade (${grade.id || id ? "id, " :  ""}term, value, strategy, student_id, year_subject_id) 
        VALUES (${grade.id || id ? "?, " :  ""}?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          term = excluded.term,
          value = excluded.value,
          strategy = excluded.strategy,
          student_id = excluded.student_id,
          year_subject_id = excluded.year_subject_id
      `);
      return query.run(
        grade.id || id,
        grade.term,
        grade.value,
        grade.strategy,
        grade.studentId,
        grade.yearSubjectId
      );
    }

    const query = this.db.prepare(`
      INSERT INTO grade (term, value, strategy, student_id, year_subject_id) 
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(term, strategy, year_subject_id, student_id) DO UPDATE SET
        value = excluded.value,
        strategy = excluded.strategy
    `);
    return query.run(
      grade.term,
      grade.value,
      grade.strategy,
      grade.studentId,
      grade.yearSubjectId
    );
  }

  findAllGradesByStudent(yearSubjectId, studentId) {
    const query = this.db.prepare(`
      SELECT *, grade.student_id as "studentId", grade.year_subject_id as "yearSubjectId"
      FROM grade
      WHERE year_subject_id = CAST(? AS INTEGER) AND student_id = ?
      ORDER BY term ASC, strategy ASC
    `);
    const results = query.all(yearSubjectId, studentId);
    return results.map(
      (row) =>
        new Grade(
          row.id,
          row.term,
          row.value,
          row.strategy,
          row.studentId,
          row.yearSubjectId
        )
    );
  }

  getGradeAvgByStudent(yearSubjectId, studentId) {
    const query = this.db.prepare(`
      SELECT AVG(value) as "avg"
      FROM grade WHERE year_subject_id = CAST(? AS INTEGER) AND student_id = ? AND value IS NOT NULL
    `);
    const result = query.get(yearSubjectId, studentId);
    return result.avg;
  }
}

export default new SubjectRepository(db);
