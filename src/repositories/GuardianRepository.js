import db from "../config/db.js";
import { Guardian } from "../models/index.js";

class GuardianRepository {
  constructor(db) {
    this.db = db;
  }

  _toGuardian(row) {
    return new Guardian(
      row.id,
      row.firstName,
      row.lastName,
      row.birthDate,
      row.legalRole,
      row.phone,
      row.address
    );
  }

  findById(id) {
    const row = this.db.prepare(`
      SELECT id,
        first_name as "firstName",
        last_name as "lastName",
        birth_date as "birthDate",
        legal_role as "legalRole",
        phone,
        address
      FROM guardian
      WHERE id = ?
    `).get(id);

    return row ? this._toGuardian(row) : null;
  }

  findAll() {
    return this.db.prepare(`
      SELECT id,
        first_name as "firstName",
        last_name as "lastName",
        birth_date as "birthDate",
        legal_role as "legalRole",
        phone,
        address
      FROM guardian
      ORDER BY last_name COLLATE NOCASE ASC,
        first_name COLLATE NOCASE ASC,
        id ASC
    `).all().map((row) => this._toGuardian(row));
  }

  _getGuardianWhere(periodId, filters) {
    const conditions = [];
    const params = [];

    const addFilter = (value, clause, getParams = (item) => [item]) => {
      const values = (Array.isArray(value) ? value : [value]).filter(
        (item) => item !== undefined && item !== null && item !== ""
      );
      if (values.length === 0) return;

      conditions.push(`(${values.map(() => clause).join(" OR ")})`);
      for (const item of values) params.push(...getParams(item));
    };
    const addContainsFilter = (column, value) =>
      addFilter(value, `LOWER(${column}) LIKE ?`, (item) => [`%${item}%`]);

    addContainsFilter("guardian.id", filters.id);
    addContainsFilter("guardian.first_name", filters.firstName);
    addContainsFilter("guardian.last_name", filters.lastName);
    addContainsFilter("guardian.birth_date", filters.dateOfBirth);
    addContainsFilter("guardian.legal_role", filters.legalRole);
    addContainsFilter("guardian.phone", filters.phone);
    addContainsFilter("guardian.address", filters.address);
    addFilter(
      filters.q,
      `(
        LOWER(guardian.last_name || ' ' || guardian.first_name) LIKE ? OR 
        LOWER(guardian.last_name || ' ' || guardian.first_name) LIKE ? OR
        LOWER(guardian.first_name || ' ' || guardian.last_name) LIKE ? OR
        LOWER(guardian.first_name || ' ' || guardian.last_name) LIKE ? OR
        LOWER(guardian.id) LIKE ?
      )`,
      (item) => [`${item}%`, `% ${item}%`, `${item}%`, `% ${item}%`, `%${item}%`]
    );

    const studentConditions = [
      "student_guardian_filter.guardian_id = guardian.id",
    ];
    const studentParams = [];
    const addStudentFilter = (
      value,
      clause,
      getParams = (item) => [item]
    ) => {
      const values = (Array.isArray(value) ? value : [value]).filter(
        (item) => item !== undefined && item !== null && item !== ""
      );
      if (values.length === 0) return;

      studentConditions.push(`(${values.map(() => clause).join(" OR ")})`);
      for (const item of values) studentParams.push(...getParams(item));
    };
    const addStudentContainsFilter = (column, value) =>
      addStudentFilter(value, `LOWER(${column}) LIKE ?`, (item) => [
        `%${item}%`,
      ]);

    addStudentContainsFilter("student_filter.id", filters.studentId);
    addStudentContainsFilter(
      "student_filter.first_name",
      filters.studentFirstName
    );
    addStudentContainsFilter(
      "student_filter.last_name",
      filters.studentLastName
    );
    addStudentFilter(
      filters.studentQ,
      `(
        LOWER(student_filter.last_name || ' ' || student_filter.first_name) LIKE ? OR 
        LOWER(student_filter.last_name || ' ' || student_filter.first_name) LIKE ? OR
        LOWER(student_filter.first_name || ' ' || student_filter.last_name) LIKE ? OR
        LOWER(student_filter.first_name || ' ' || student_filter.last_name) LIKE ? OR
        LOWER(student_filter.id) LIKE ?
      )`,
      (item) => [`${item}%`, `% ${item}%`, `${item}%`, `% ${item}%`, `%${item}%`]
    );

    const hasStudentFilters = studentConditions.length > 1;
    if (periodId !== "all" || hasStudentFilters) {
      const periodJoins = periodId === "all"
        ? ""
        : `
          JOIN student_class student_class_filter
            ON student_class_filter.student_id = student_filter.id
          JOIN class class_filter
            ON class_filter.id = student_class_filter.class_id
          JOIN year_period year_period_filter
            ON year_period_filter.id = class_filter.year_period_id
        `;
      if (periodId !== "all") {
        studentConditions.push("student_filter.status = 'active'");
        studentConditions.push("year_period_filter.period_id = ?");
        studentParams.push(periodId);
      }

      conditions.push(`EXISTS (
        SELECT 1
        FROM student_guardian student_guardian_filter
        JOIN student student_filter
          ON student_filter.id = student_guardian_filter.student_id
        ${periodJoins}
        WHERE ${studentConditions.join(" AND ")}
      )`);
      params.push(...studentParams);
    }

    return {
      where: conditions.length > 0 ? conditions.join(" AND ") : "1 = 1",
      params,
    };
  }

  findAllByPeriod(
    periodId,
    { filters = {}, pagination = null, includeStudents = true } = {}
  ) {
    const { where, params } = this._getGuardianWhere(periodId, filters);
    const paginationSql = pagination ? "LIMIT ? OFFSET ?" : "";
    const rowParams = pagination
      ? [...params, pagination.limit, pagination.offset]
      : params;
    const relationshipColumns = includeStudents
      ? `,
        student.id as "assignedStudentId",
        student.first_name as "assignedStudentFirstName",
        student.last_name as "assignedStudentLastName",
        student.birth_date as "assignedStudentBirthDate",
        student.birth_place as "assignedStudentBirthPlace",
        student.status as "assignedStudentStatus"`
      : "";
    const relationshipOrder = includeStudents
      ? `,
        student.last_name COLLATE NOCASE ASC,
        student.first_name COLLATE NOCASE ASC,
        student.id ASC`
      : "";
    const relationshipJoins = includeStudents
      ? `
        LEFT JOIN student_guardian
          ON student_guardian.guardian_id = paged_guardians.id
        LEFT JOIN student ON student.id = student_guardian.student_id`
      : "";

    const baseQuery = `
      WITH filtered_guardians AS (
        SELECT guardian.id,
          guardian.first_name as "firstName",
          guardian.last_name as "lastName",
          guardian.birth_date as "birthDate",
          guardian.legal_role as "legalRole",
          guardian.phone,
          guardian.address
        FROM guardian
        WHERE ${where}
      )
    `;
    const countRow = this.db.prepare(`
      ${baseQuery}
      SELECT COUNT(*) as "recordsAmount"
      FROM filtered_guardians
    `).get(...params);
    const rows = this.db.prepare(`
      ${baseQuery},
      paged_guardians AS (
        SELECT *
        FROM filtered_guardians
        ORDER BY lastName COLLATE NOCASE ASC,
          firstName COLLATE NOCASE ASC,
          id ASC
        ${paginationSql}
      )
      SELECT paged_guardians.*${relationshipColumns}
      FROM paged_guardians
      ${relationshipJoins}
      ORDER BY paged_guardians.lastName COLLATE NOCASE ASC,
        paged_guardians.firstName COLLATE NOCASE ASC,
        paged_guardians.id ASC${relationshipOrder}
    `).all(...rowParams);

    return { rows, recordsAmount: Number(countRow.recordsAmount) };
  }

  create(guardian) {
    return this.db.prepare(`
      INSERT INTO guardian (
        id, first_name, last_name, birth_date, legal_role, phone, address
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      guardian.id,
      guardian.firstName,
      guardian.lastName,
      guardian.birthDate,
      guardian.legalRole,
      guardian.phone,
      guardian.address
    );
  }

  update(id, guardianData) {
    return this.db.prepare(`
      UPDATE guardian
      SET first_name = ?,
        last_name = ?,
        birth_date = ?,
        legal_role = ?,
        phone = ?,
        address = ?
      WHERE id = ?
    `).run(
      guardianData.firstName,
      guardianData.lastName,
      guardianData.birthDate,
      guardianData.legalRole,
      guardianData.phone,
      guardianData.address,
      id
    );
  }

  delete(id) {
    return this.db.prepare("DELETE FROM guardian WHERE id = ?").run(id);
  }
}

export default new GuardianRepository(db);
