import db from "../config/db.js";
import { Period } from "../models/index.js";

const GRADE_SLOTS_PER_TERM = 5;

class PeriodRepository {
  constructor(db) {
    this.db = db;
  }

  findById(id) {
    const query = this.db.prepare(`
      SELECT id, status, start_year as "startYear", end_year as "endYear", opening_date as "openingDate", user_id as "userId"
      FROM period
      WHERE id = ?
    `);

    const result = query.get(id);

    if (!result) return null;
    return new Period(
      result.id,
      result.status,
      result.startYear,
      result.endYear,
      result.openingDate,
      result.userId
    );
  }

  findAll() {
    const query = this.db.prepare(`
      SELECT id, status, start_year as "startYear", end_year as "endYear", opening_date as "openingDate", user_id as "userId"
      FROM period ORDER BY start_year DESC
    `);

    const results = query.all();

    return results.map(
      (row) =>
        new Period(
          row.id,
          row.status,
          row.startYear,
          row.endYear,
          row.openingDate,
          row.userId
        )
    );
  }

  create(period) {
    const query = this.db.prepare(`
      INSERT INTO period (id, status, start_year, end_year, opening_date, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return query.run(
      period.id,
      period.status,
      period.startYear,
      period.endYear,
      period.openingDate,
      period.userId
    );
  }

  update(id, periodData) {
    const query = this.db.prepare(`
      UPDATE period
      SET status = ?, start_year = ?, end_year = ?, opening_date = ?, user_id = ?
      WHERE id = ?
    `);
    return query.run(
      periodData.status,
      periodData.startYear,
      periodData.endYear,
      periodData.openingDate,
      periodData.userId,
      id
    );
  }

  delete(id) {
    const query = this.db.prepare(`DELETE FROM period WHERE id = ?`);
    return query.run(id);
  }

  getStudentCount(id) {
    const periodFilter = id === "all" ? "" : "WHERE year_period.period_id = ?";
    const query = this.db.prepare(`
      SELECT student_class.status, COUNT(*) as count
      FROM student_class
      JOIN class ON class.id = student_class.class_id
      JOIN year_period ON year_period.id = class.year_period_id
      ${periodFilter}
      GROUP BY student_class.status
    `);
    const results = id === "all" ? query.all() : query.all(id);
    return results;
  }

  getGradeCount(id) {
    const periodFilter = id === "all" ? "" : "WHERE year_period.period_id = ?";

    const totalQuery = this.db.prepare(`
      WITH students_per_year AS (
        SELECT class.year_period_id as yearPeriodId, SUM(class.student_count) as studentCount
        FROM class
        JOIN year_period ON year_period.id = class.year_period_id
        ${periodFilter.length ? periodFilter + " AND" : "WHERE"} class.id <> "z"
        GROUP BY 1
      ), subjects_per_year AS (
        SELECT year_subject.year_period_id as yearPeriodId, COUNT(*) as subjectCount
        FROM year_subject
        JOIN year_period ON year_period.id = year_subject.year_period_id
        ${periodFilter}
        GROUP BY 1
      )
      SELECT COALESCE(SUM(gradeCount), 0) as total FROM (
        SELECT subjectCount * studentCount * 3 * ${GRADE_SLOTS_PER_TERM} as gradeCount
        FROM subjects_per_year
        JOIN students_per_year ON students_per_year.yearPeriodId = subjects_per_year.yearPeriodId
      )
    `);
    const total = (id === "all" ? totalQuery.all() : totalQuery.all(id, id))[0].total;

    const loadedQuery = this.db.prepare(`
      SELECT COUNT(*) as loaded
      FROM grade
      JOIN year_subject ON year_subject.id = grade.year_subject_id
      JOIN year_period ON year_period.id = year_subject.year_period_id
      ${id === "all" ? "WHERE" : periodFilter + " AND"} grade.value IS NOT NULL
      `)
    const loaded = (id === "all" ? loadedQuery.all() : loadedQuery.all(id))[0].loaded

    return {total, loaded};
  }

  assignYear(yearId, periodId) {
    const query = this.db.prepare(
      `INSERT INTO year_period (year_id, period_id) VALUES (?, ?) RETURNING *`
    );
    return query.get(yearId, periodId);
  }

  findAllAssignedYears(id) {
    const query = this.db
      .prepare(`SELECT year_period.id, year.id as "yearId", year.name as "yearName", year.abbr as "yearAbbr",
              year_period.period_id as "periodId" FROM year_period
              JOIN year ON year_period.year_id = year.id
              WHERE period_id = ? ORDER BY year.id ASC`);
    const results = query.all(id);
    return results;
  }
}

export default new PeriodRepository(db);
