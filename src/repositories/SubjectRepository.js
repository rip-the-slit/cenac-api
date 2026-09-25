import db from "../config/db.js";
import { Grade, Subject } from "../models/index.js";

class SubjectRepository {
  constructor(db) {
    this.db = db;
  }

  findById(id) {
    const row = this.db.prepare(`
      SELECT *, minimum_grade as "minimumGrade"
      FROM subject WHERE id = CAST(? AS INTEGER)
    `).get(id);
    return row
      ? new Subject(row.id, row.name, row.abbr, row.minimumGrade)
      : null;
  }

  findAll() {
    return this.db.prepare(`
      SELECT *, minimum_grade as "minimumGrade" FROM subject
    `).all().map(
      (row) => new Subject(row.id, row.name, row.abbr, row.minimumGrade)
    );
  }

  findAllByPeriod(periodId) {
    return this.db.prepare(`
      SELECT DISTINCT subject.id, subject.name, subject.abbr,
        subject.minimum_grade as "minimumGrade"
      FROM subject
      JOIN year_subject ON year_subject.subject_id = subject.id
      JOIN year_period ON year_period.id = year_subject.year_period_id
      WHERE year_period.period_id = ?
      ORDER BY subject.name COLLATE NOCASE ASC
    `).all(periodId).map(
      (row) => new Subject(row.id, row.name, row.abbr, row.minimumGrade)
    );
  }

  findAllAssignmentsByPeriod(periodId) {
    return this.db.prepare(`
      SELECT subject.id as "subjectId", subject.name, subject.abbr,
        subject.minimum_grade as "minimumGrade",
        year_subject.id as "yearSubjectId",
        year_period.year_id as "yearId",
        year_period.period_id as "periodId"
      FROM year_subject
      JOIN subject ON subject.id = year_subject.subject_id
      JOIN year_period ON year_period.id = year_subject.year_period_id
      WHERE year_period.period_id = ?
      ORDER BY year_period.year_id ASC, subject.id ASC
    `).all(periodId);
  }

  findAllGradesByStudents(periodId, studentIds) {
    const uniqueStudentIds = [...new Set(studentIds)];
    if (uniqueStudentIds.length === 0) return [];

    const placeholders = uniqueStudentIds.map(() => "?").join(", ");
    const periodFilter = periodId === "all"
      ? ""
      : "AND year_period.period_id = ?";
    const query = this.db.prepare(`
      SELECT grade.id as "gradeId",
        grade.student_id as "studentId",
        grade.term,
        grade.strategy,
        grade.value,
        year_subject.id as "yearSubjectId",
        year_subject.subject_id as "subjectId",
        year_period.year_id as "yearId",
        year_period.period_id as "periodId"
      FROM grade
      JOIN year_subject ON year_subject.id = grade.year_subject_id
      JOIN year_period ON year_period.id = year_subject.year_period_id
      WHERE grade.student_id IN (${placeholders})
        ${periodFilter}
      ORDER BY grade.student_id ASC,
        year_period.year_id ASC,
        year_subject.subject_id ASC,
        grade.term ASC,
        grade.strategy ASC
    `);

    const params = periodId === "all"
      ? uniqueStudentIds
      : [...uniqueStudentIds, periodId];
    return query.all(...params);
  }

  create(subject) {
    return this.db.prepare(`
      INSERT INTO subject (id, name, minimum_grade) VALUES (?, ?, ?)
    `).run(subject.id, subject.name, subject.minimumGrade);
  }

  update(id, subjectData) {
    return this.db.prepare(`
      UPDATE subject SET name = ?, minimum_grade = ?
      WHERE id = CAST(? AS INTEGER)
    `).run(subjectData.name, subjectData.minimumGrade, id);
  }

  delete(id) {
    return this.db.prepare(
      "DELETE FROM subject WHERE id = CAST(? AS INTEGER)"
    ).run(id);
  }

  upsertGrades(grades, chunkSize = 100) {
    const validGrades = grades.filter(Boolean);
    let changes = 0;

    for (let offset = 0; offset < validGrades.length; offset += chunkSize) {
      const chunk = validGrades.slice(offset, offset + chunkSize);
      const withId = chunk.filter(
        (grade) => grade.id !== undefined && grade.id !== null && grade.id !== ""
      );
      const withoutId = chunk.filter((grade) => !withId.includes(grade));

      if (withId.length > 0) {
        const values = withId.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
        const params = withId.flatMap((grade) => [
          grade.id,
          grade.term,
          grade.value,
          grade.strategy,
          grade.studentId,
          grade.yearSubjectId,
        ]);
        changes += this.db.prepare(`
          INSERT INTO grade (
            id, term, value, strategy, student_id, year_subject_id
          ) VALUES ${values}
          ON CONFLICT(id) DO UPDATE SET
            term = excluded.term,
            value = excluded.value,
            strategy = excluded.strategy,
            student_id = excluded.student_id,
            year_subject_id = excluded.year_subject_id
        `).run(...params).changes;
      }

      if (withoutId.length > 0) {
        const values = withoutId.map(() => "(?, ?, ?, ?, ?)").join(", ");
        const params = withoutId.flatMap((grade) => [
          grade.term,
          grade.value,
          grade.strategy,
          grade.studentId,
          grade.yearSubjectId,
        ]);
        changes += this.db.prepare(`
          INSERT INTO grade (
            term, value, strategy, student_id, year_subject_id
          ) VALUES ${values}
          ON CONFLICT(term, strategy, year_subject_id, student_id)
          DO UPDATE SET value = excluded.value
        `).run(...params).changes;
      }
    }

    return { changes };
  }

  assignGrade(grade) {
    return this.upsertGrades([grade]);
  }

  findAllGradesByStudent(yearSubjectId, studentId) {
    return this.db.prepare(`
      SELECT *, student_id as "studentId", year_subject_id as "yearSubjectId"
      FROM grade
      WHERE year_subject_id = CAST(? AS INTEGER) AND student_id = ?
      ORDER BY term ASC, strategy ASC
    `).all(yearSubjectId, studentId).map(
      (row) => new Grade(
        row.id,
        row.term,
        row.value,
        row.strategy,
        row.studentId,
        row.yearSubjectId
      )
    );
  }

}

export default new SubjectRepository(db);
