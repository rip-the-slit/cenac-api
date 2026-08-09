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

  findAllByPeriod(periodId) {
    const query = this.db.prepare(`
      SELECT DISTINCT subject.id, subject.name, subject.abbr,
        subject.minimum_grade as "minimumGrade"
      FROM subject
      JOIN year_subject ON year_subject.subject_id = subject.id
      JOIN year_period ON year_period.id = year_subject.year_period_id
      WHERE year_period.period_id = ?
      ORDER BY subject.name COLLATE NOCASE ASC
    `);

    return query.all(periodId).map(
      (row) => new Subject(row.id, row.name, row.abbr, row.minimumGrade)
    );
  }


  findAllGradesByStudents(periodId, studentIds) {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return [];
    }

    const placeholders = studentIds.map(() => "?").join(", ");
    const query = this.db.prepare(`
      WITH selected_grades AS (
        SELECT grade.id as "gradeId",
          grade.student_id as "studentId",
          grade.term,
          grade.strategy,
          grade.value,
          year_subject.id as "yearSubjectId",
          year_subject.subject_id as "subjectId"
        FROM grade
        JOIN year_subject ON year_subject.id = grade.year_subject_id
        JOIN year_period ON year_period.id = year_subject.year_period_id
        WHERE year_period.period_id = ?
          AND grade.student_id IN (${placeholders})
      ),
      subject_averages AS (
        SELECT studentId, yearSubjectId, AVG(value) as "subjectAverage"
        FROM selected_grades
        WHERE value IS NOT NULL
        GROUP BY studentId, yearSubjectId
      ),
      term_averages AS (
        SELECT studentId, yearSubjectId, term, AVG(value) as "termAverage"
        FROM selected_grades
        WHERE value IS NOT NULL
        GROUP BY studentId, yearSubjectId, term
      )
      SELECT selected_grades.*,
        subject_averages.subjectAverage,
        term_averages.termAverage
      FROM selected_grades
      LEFT JOIN subject_averages
        ON subject_averages.studentId = selected_grades.studentId
        AND subject_averages.yearSubjectId = selected_grades.yearSubjectId
      LEFT JOIN term_averages
        ON term_averages.studentId = selected_grades.studentId
        AND term_averages.yearSubjectId = selected_grades.yearSubjectId
        AND term_averages.term = selected_grades.term
      ORDER BY selected_grades.studentId ASC,
        selected_grades.subjectId ASC,
        selected_grades.term ASC,
        selected_grades.strategy ASC
    `);

    return query.all(periodId, ...studentIds);
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
