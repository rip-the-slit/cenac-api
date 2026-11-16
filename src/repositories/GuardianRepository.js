import { addNameFilter, fold, updateFolded, isExact } from "./searchUtils.js";
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
        NULL as "legalRole",
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
        NULL as "legalRole",
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
      for (const item of values) params.push(...getParams(fold(item)));
    };
    const addContainsFilter = (column, value, key) =>
      addFilter(value, `LOWER(${column}) ${(isExact(filters.exact, key)) ? "=" : "LIKE"} ?`, (item) => [isExact(filters.exact, key) ? item : `%${item}%`]);

    addContainsFilter("guardian.id", filters.id, "id");
    addContainsFilter("guardian.first_name_folded", filters.firstName, "firstName");
    addContainsFilter("guardian.last_name_folded", filters.lastName, "lastName");
    addContainsFilter("guardian.birth_date", filters.dateOfBirth, "dateOfBirth");

    addContainsFilter("guardian.phone", filters.phone, "phone");
    addContainsFilter("guardian.address_folded", filters.address, "address");
    addNameFilter(addFilter, filters, "q", "guardian.first_name_folded", "guardian.last_name_folded", "guardian.id");

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
      for (const item of values) studentParams.push(...getParams(fold(item)));
    };
    const addStudentContainsFilter = (column, value, key) =>
      addStudentFilter(value, `LOWER(${column}) ${(isExact(filters.exact, key)) ? "=" : "LIKE"} ?`, (item) => [isExact(filters.exact, key) ? item : `%${item}%`]);

    addStudentContainsFilter("student_filter.id", filters.studentId, "studentId");
    addStudentContainsFilter("student_filter.first_name_folded", filters.studentFirstName, "studentFirstName");
    addStudentContainsFilter("student_filter.last_name_folded", filters.studentLastName, "studentLastName");
    addNameFilter(addStudentFilter, filters, "studentQ", "student_filter.first_name_folded", "student_filter.last_name_folded", "student_filter.id");

    addStudentContainsFilter("student_guardian_filter.legal_role", filters.legalRole, "legalRole");
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
    { filters = {}, exact = filters.exact, pagination = null, includeStudents = true } = {}
  ) {
    const { where, params } = this._getGuardianWhere(periodId, { ...filters, exact });
    const paginationSql = pagination ? "LIMIT ? OFFSET ?" : "";
    const rowParams = pagination
      ? [...params, pagination.limit, pagination.offset]
      : params;
    const relationshipColumns = includeStudents
      ? `,
        student_guardian.legal_role AS "assignedStudentLegalRole",
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
          NULL as "legalRole",
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
    return this.db.transaction(() => {
      const result = this.db.prepare(`
        INSERT INTO guardian (
          id, first_name, last_name, birth_date, phone, address
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        guardian.id,
        guardian.firstName,
        guardian.lastName,
        guardian.birthDate,
        guardian.phone,
        guardian.address
      );
      updateFolded(this.db, "guardian", guardian.id, ["first_name", "last_name", "address"], { first_name: guardian.firstName, last_name: guardian.lastName, address: guardian.address });
      return result;
    });
  }

  update(id, guardianData) {
    return this.db.transaction(() => {
      const result = this.db.prepare(`
        UPDATE guardian
        SET first_name = ?,
          last_name = ?,
          birth_date = ?,
          phone = ?,
          address = ?
        WHERE id = ?
      `).run(
        guardianData.firstName,
        guardianData.lastName,
        guardianData.birthDate,
        guardianData.phone,
        guardianData.address,
        id
      );
      updateFolded(this.db, "guardian", id, ["first_name", "last_name", "address"], { first_name: guardianData.firstName, last_name: guardianData.lastName, address: guardianData.address });
      return result;
    });
  }

  delete(id) {
    return this.db.prepare("DELETE FROM guardian WHERE id = ?").run(id);
  }
}

export default new GuardianRepository(db);
