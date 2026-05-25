import db from "../config/db.js";
import { Period } from "../models/index.js";

class PeriodRepository {
  constructor(db) {
    this.db = db;
  }

  findById(id) {
    const query = this.db.prepare(`
      SELECT id, status, start_year as "startYear", end_year as "endYear", opening_date as "openingDate", closing_date as "closingDate" 
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
      result.closingDate
    );
  }

  findAll() {
    const query = this.db.prepare(`
      SELECT id, status, start_year as "startYear", end_year as "endYear", opening_date as "openingDate", closing_date as "closingDate" 
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
          row.closingDate
        )
    );
  }

  create(period) {
    const query = this.db.prepare(`
      INSERT INTO period (id, status, start_year, end_year, opening_date, closing_date) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return query.run(
      period.id,
      period.status,
      period.startYear,
      period.endYear,
      period.openingDate,
      period.closingDate
    );
  }

  update(id, periodData) {
    const query = this.db.prepare(`
      UPDATE period 
      SET status = ?, start_year = ?, end_year = ?, opening_date = ?, closing_date = ? 
      WHERE id = ?
    `);
    return query.run(
      periodData.status,
      periodData.startYear,
      periodData.endYear,
      periodData.openingDate,
      periodData.closingDate,
      id
    );
  }

  delete(id) {
    const query = this.db.prepare(`DELETE FROM period WHERE id = ?`);
    return query.run(id);
  }

  getStudentCount(id) {
    const query = this.db
      .prepare(`SELECT status, COUNT(*) as count FROM student_class WHERE class_id 
              IN (SELECT id FROM class WHERE year_period_id 
              IN (SELECT id FROM year_period WHERE period_id = ?))
              GROUP BY status`);
    const results = query.all(id);
    return results;
  }

  getGradeCount(id) {
    const query = this.db.prepare(
      `SELECT value IS NOT NULL as "loaded", COUNT(*) as count FROM grade WHERE year_subject_id 
      IN (SELECT id FROM year_subject WHERE year_period_id 
      IN (SELECT id FROM year_period WHERE period_id = ?))
      GROUP BY 1`
    )
    const results = query.all(id);
    return results;
  }

  assignYear(yearId, periodId) {
    const query = this.db.prepare(
      `INSERT INTO year_period (year_id, period_id) VALUES (?, ?) RETURNING *`
    );
    return query.get(yearId, periodId);
  }

  findAllAssignedYears(id) {
    const query = this.db
      .prepare(`SELECT year_period.id, year.id as "yearId", year.name as "yearName", 
              year_period.period_id as "periodId" FROM year_period 
              JOIN year ON year_period.year_id = year.id 
              WHERE period_id = ? ORDER BY year.id ASC`);
    const results = query.all(id);
    return results;
  }
}

export default new PeriodRepository(db);
