import db from "../config/db.js";
import { Class, Subject, Year } from "../models/index.js";

class YearRepository {
  constructor(db) {
    this.db = db;
  }

  findById(id) {
    const query = this.db.prepare(`SELECT id, name FROM year WHERE id = ?`);
    const result = query.get(id);

    if (!result) return null;
    return new Year(result.id, result.name);
  }

  findAll() {
    const query = this.db.prepare(`SELECT id, name FROM year`);
    const results = query.all();

    return results.map((row) => new Year(row.id, row.name));
  }

  create(year) {
    const query = this.db.prepare(`INSERT INTO year (id, name) VALUES (?, ?)`);
    return query.run(year.id, year.name);
  }

  update(id, yearData) {
    const query = this.db.prepare(`UPDATE year SET name = ? WHERE id = ?`);
    return query.run(yearData.name, id);
  }

  delete(id) {
    const query = this.db.prepare(`DELETE FROM year WHERE id = ?`);
    return query.run(id);
  }

  assignClass(classData) {
    const query = this.db.prepare(
      `INSERT INTO class (name, year_period_id, shift, location, capacity) VALUES (?, ?, ?, ?, ?) RETURNING *`
    );
    return query.get(
      classData.name,
      classData.yearPeriodId,
      classData.shift,
      classData.location,
      classData.capacity
    );
  }

  findAllAssignedClasses(yearPeriodId) {
    const query = this.db.prepare(
      `SELECT *, year_period_id as "yearPeriodId" FROM class WHERE year_period_id = CAST(? AS INTEGER)`
    );
    const results = query.all(yearPeriodId);
    return results.map(
      (row) =>
        new Class(
          row.id,
          row.name,
          row.shift,
          row.location,
          row.capacity,
          row.yearPeriodId
        )
    );
  }

  findAllAssignedClassesByPeriod(periodId) {
    const query = this.db.prepare(`
      SELECT class.*, class.year_period_id as "yearPeriodId", year_period.year_id as "yearId"
      FROM class
      JOIN year_period ON year_period.id = class.year_period_id
      WHERE year_period.period_id = ?
      ORDER BY year_period.year_id ASC, class.name COLLATE NOCASE ASC
    `);

    return query.all(periodId).map((row) => {
      const assignedClass = new Class(
        row.id,
        row.name,
        row.shift,
        row.location,
        row.capacity,
        row.yearPeriodId
      );
      assignedClass.yearId = row.yearId;
      return assignedClass;
    });
  }

  findClassByName(className, yearPeriodId) {
    const query = this.db.prepare(
      `SELECT *, year_period_id as "yearPeriodId" FROM class WHERE name = ? AND year_period_id = CAST(? AS INTEGER)`
    );
    const row = query.get(className, yearPeriodId);
    if (!row) return null;
    return new Class(
      row.id,
      row.name,
      row.shift,
      row.location,
      row.capacity,
      row.yearPeriodId
    );
  }

  assignSubject(subjectId, yearPeriodId) {
    const query = this.db.prepare(
      `INSERT INTO year_subject (year_period_id, subject_id) VALUES (?, ?)`
    );
    return query.run(yearPeriodId, subjectId);
  }

  findAllAssignedSubjects(yearPeriodId) {
    const query = this.db.prepare(
      `SELECT subject.id, subject.name, subject.abbr, subject.minimum_grade as "minimumGrade", year_subject.id as "yearSubjectId"
      FROM year_subject JOIN subject ON year_subject.subject_id = subject.id 
      WHERE year_subject.year_period_id = CAST(? AS INTEGER)`
    );
    const results = query.all(yearPeriodId);
    return results.map(
      (row) =>
        new Subject(row.id, row.name, row.abbr, row.minimumGrade, row.yearSubjectId)
    );
  }
}

export default new YearRepository(db);
