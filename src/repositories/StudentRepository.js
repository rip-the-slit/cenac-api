import { addNameFilter, fold, updateFolded, isExact } from "./searchUtils.js";
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
        SELECT student.id, student.first_name as "firstName", student.first_name_folded AS "firstNameFolded", student.last_name as "lastName", student.last_name_folded AS "lastNameFolded", student.birth_date as "birthDate", student.birth_place as "birthPlace", student.birth_place_folded AS "birthPlaceFolded", student_class.status
        FROM student JOIN student_class ON student.id = student_class.student_id
        WHERE student_class.class_id = CAST(? AS INTEGER)
        `);
    const results = query.all(classId);
    return results.map(
      (row) =>
        new Student(
          row.id,
          row.firstName,
          row.lastName,
          row.birthDate,
          row.birthPlace,
          row.status,
          classId
        )
    );
  }

  _getPeriodStudentWhere(periodId, filters) {
    const conditions = [];
    const params = [];

    if (periodId !== "all") {
      conditions.push("periodId = ?");
      params.push(periodId);
    }

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

    addFilter(filters.exactIds, "LOWER(id) = ?");
    addContainsFilter("id", filters.id, "id");
    addContainsFilter("firstNameFolded", filters.firstName, "firstName");
    addContainsFilter("lastNameFolded", filters.lastName, "lastName");
    addContainsFilter("birthDate", filters.dateOfBirth, "dateOfBirth");
    addContainsFilter("birthPlaceFolded", filters.birthPlace, "birthPlace");
    addFilter(filters.yearId, "CAST(yearId AS TEXT) = ?");
    addFilter(filters.className, "LOWER(className) = ?");
    addFilter(filters.status, "LOWER(status) = ?");
    addNameFilter(addFilter, filters, "q", "firstNameFolded", "lastNameFolded", "id");

    const guardianConditions = [
      "student_guardian_filter.student_id = student_rows.id",
    ];
    const guardianParams = [];
    const addGuardianFilter = (
      value,
      clause,
      getParams = (item) => [item]
    ) => {
      const values = (Array.isArray(value) ? value : [value]).filter(
        (item) => item !== undefined && item !== null && item !== ""
      );
      if (values.length === 0) return;

      guardianConditions.push(`(${values.map(() => clause).join(" OR ")})`);
      for (const item of values) guardianParams.push(...getParams(fold(item)));
    };
    const addGuardianContainsFilter = (column, value, key) =>
      addGuardianFilter(value, `LOWER(${column}) ${(isExact(filters.exact, key)) ? "=" : "LIKE"} ?`, (item) => [isExact(filters.exact, key) ? item : `%${item}%`]);

    addGuardianContainsFilter("guardian_filter.id", filters.guardianId, "guardianId");
    addGuardianContainsFilter("guardian_filter.first_name_folded", filters.guardianFirstName, "guardianFirstName");
    addGuardianContainsFilter("guardian_filter.last_name_folded", filters.guardianLastName, "guardianLastName");
    addNameFilter(addGuardianFilter, filters, "guardianQ", "guardian_filter.first_name_folded", "guardian_filter.last_name_folded", "guardian_filter.id");

    if (guardianConditions.length > 1) {
      conditions.push(`EXISTS (
        SELECT 1
        FROM student_guardian student_guardian_filter
        JOIN guardian guardian_filter
          ON guardian_filter.id = student_guardian_filter.guardian_id
        WHERE ${guardianConditions.join(" AND ")}
      )`);
      params.push(...guardianParams);
    }

    return {
      where: conditions.length > 0 ? conditions.join(" AND ") : "1 = 1",
      params,
    };
  }

  findAllByPeriod(
    periodId,
    {
      filters = {},
      exact = filters.exact,
      pagination = null,
      deduplicate = false,
      includeGuardians = true,
    } = {}
  ) {
    const shouldDeduplicate = periodId === "all" && deduplicate;
    const { where, params } = this._getPeriodStudentWhere(periodId, { ...filters, exact });
    const paginationSql = pagination ? "LIMIT ? OFFSET ?" : "";
    const rowParams = pagination
      ? [...params, pagination.limit, pagination.offset]
      : params;
    const activePeriodValue = (column) => shouldDeduplicate
      ? `CASE WHEN period.status = 'active' THEN ${column} END`
      : column;
    const status = shouldDeduplicate
      ? "student.status"
      : "student_class.status";
    const rankedCondition = shouldDeduplicate ? "enrollmentRank = 1 AND" : "";
    const studentColumns = `
      id,
      firstName,
      lastName,
      birthDate,
      birthPlace,
      status,
      classDatabaseId,
      className,
      classStudentCount,
      yearPeriodId,
      yearId,
      yearName,
      periodId,
      periodStatus,
      periodStartYear
    `;
    const orderQuery = `
      ORDER BY lastName COLLATE NOCASE ASC,
        firstName COLLATE NOCASE ASC,
        id ASC,
        yearId ASC,
        className COLLATE NOCASE ASC
    `;
    const studentRowsQuery = `
      WITH student_rows AS (
        SELECT
          student.id,
          student.first_name as "firstName", student.first_name_folded AS "firstNameFolded",
          student.last_name as "lastName", student.last_name_folded AS "lastNameFolded",
          student.birth_date as "birthDate",
          student.birth_place as "birthPlace", student.birth_place_folded AS "birthPlaceFolded",
          ${status} as "status",
          ${activePeriodValue("class.id")} as "classDatabaseId",
          ${activePeriodValue("class.name")} as "className",
          ${activePeriodValue("class.student_count")} as "classStudentCount",
          ${activePeriodValue("year_period.id")} as "yearPeriodId",
          ${activePeriodValue("year_period.year_id")} as "yearId",
          ${activePeriodValue("year.name")} as "yearName",
          period.id as "periodId",
          period.status as "periodStatus",
          period.start_year as "periodStartYear",
          ROW_NUMBER() OVER (
            PARTITION BY student.id
            ORDER BY CASE WHEN period.status = 'active' THEN 0 ELSE 1 END,
              CASE WHEN class.name = 'z' THEN 1 ELSE 0 END,
              period.start_year DESC
          ) as "enrollmentRank"
        FROM student
        JOIN student_class ON student_class.student_id = student.id
        JOIN class ON class.id = student_class.class_id
        JOIN year_period ON year_period.id = class.year_period_id
        JOIN year ON year.id = year_period.year_id
        JOIN period ON period.id = year_period.period_id
      ),
      filtered_students AS (
        SELECT ${studentColumns}
        FROM student_rows
        WHERE ${rankedCondition} ${where}
      )
    `;
    const countRow = this.db.prepare(`
      ${studentRowsQuery}
      SELECT COUNT(*) as "recordsAmount"
      FROM filtered_students
    `).get(...params);
    const relationshipColumns = includeGuardians
      ? `,
        guardian.id as "assignedGuardianId",
        guardian.first_name as "assignedGuardianFirstName",
        guardian.last_name as "assignedGuardianLastName",
        guardian.birth_date as "assignedGuardianBirthDate",
        student_guardian.legal_role as "assignedGuardianLegalRole",
        guardian.phone as "assignedGuardianPhone",
        guardian.address as "assignedGuardianAddress"`
      : "";
    const relationshipJoins = includeGuardians
      ? `
        LEFT JOIN student_guardian
          ON student_guardian.student_id = paged_students.id
        LEFT JOIN guardian ON guardian.id = student_guardian.guardian_id`
      : "";
    const relationshipOrder = includeGuardians
      ? `,
        guardian.last_name COLLATE NOCASE ASC,
        guardian.first_name COLLATE NOCASE ASC,
        guardian.id ASC`
      : "";
    const rows = this.db.prepare(`
      ${studentRowsQuery},
      paged_students AS (
        SELECT *
        FROM filtered_students
        ${orderQuery}
        ${paginationSql}
      )
      SELECT paged_students.*${relationshipColumns}
      FROM paged_students
      ${relationshipJoins}
      ORDER BY paged_students.lastName COLLATE NOCASE ASC,
        paged_students.firstName COLLATE NOCASE ASC,
        paged_students.id ASC${relationshipOrder}
    `).all(...rowParams);

    return { rows, recordsAmount: Number(countRow.recordsAmount) };
  }

  create(student) {
    return this.db.transaction(() => {
      const query = this.db.prepare(`
          INSERT INTO student (id, first_name, last_name, birth_date, birth_place, status)
          VALUES (?, ?, ?, ?, ?, ?)
          `);
      const result = query.run(
        student.id,
        student.firstName,
        student.lastName,
        student.birthDate,
        student.birthPlace,
        student.status
      );
      updateFolded(this.db, "student", student.id, ["first_name", "last_name", "birth_place"], { first_name: student.firstName, last_name: student.lastName, birth_place: student.birthPlace });
      return result;
    });
  }

  update(id, studentData) {
    return this.db.transaction(() => {
      const query = this.db.prepare(`
          UPDATE student
          SET first_name = ?, last_name = ?, birth_date = ?, birth_place = ?, status = ?
          WHERE id = ?
          `);
      const result = query.run(
        studentData.firstName,
        studentData.lastName,
        studentData.birthDate,
        studentData.birthPlace,
        studentData.status,
        id
      );
      updateFolded(this.db, "student", id, ["first_name", "last_name", "birth_place"], { first_name: studentData.firstName, last_name: studentData.lastName, birth_place: studentData.birthPlace });
      return result;
    });
  }

  updateStatusByPeriod(periodId, status) {
    const query = this.db.prepare(`
      UPDATE student
      SET status = ?
      WHERE id IN (
        SELECT student_class.student_id
        FROM student_class
        JOIN class ON class.id = student_class.class_id
        JOIN year_period ON year_period.id = class.year_period_id
        WHERE year_period.period_id = ?
      )
    `);
    return query.run(status, periodId);
  }

  delete(id) {
    const query = this.db.prepare(`DELETE FROM student WHERE id = ?`);
    return query.run(id);
  }

  assignGuardian(studentId, guardianId, legalRole = null) {
    if (legalRole !== null && !["Madre", "Padre", "Representante Legal"].includes(legalRole)) {
      const error = new Error("Rol legal no válido");
      error.status = 400;
      throw error;
    }
    const query = this.db.prepare(`
        INSERT INTO student_guardian (student_id, guardian_id, legal_role)
        VALUES (?, ?, ?)
        ON CONFLICT(student_id, guardian_id) DO UPDATE SET legal_role = excluded.legal_role
        `);
    return query.run(studentId, guardianId, legalRole);
  }

  findAllAssignedGuardians(studentId) {
    const query = this.db
      .prepare(`SELECT guardian.id, guardian.first_name as "firstName", guardian.last_name as "lastName", guardian.birth_date as "birthDate", student_guardian.legal_role as "legalRole", guardian.phone, guardian.address
                                  FROM guardian JOIN student_guardian ON guardian.id = student_guardian.guardian_id
                                  WHERE student_guardian.student_id = ?`);
    const results = query.all(studentId);
    return results.map(
      (row) =>
        new Guardian(
          row.id,
          row.firstName,
          row.lastName,
          row.birthDate,
          row.legalRole,
          row.phone,
          row.address
        )
    );
  }

  syncAssignedGuardians(studentId, guardians) {
    const roles = new Map(guardians.map(guardian => [String(guardian.id ?? guardian), guardian.legalRole ?? null]));
    const uniqueIds = [...roles.keys()];
    if (uniqueIds.length === 0) {
      this.db.prepare(
        "DELETE FROM student_guardian WHERE student_id = ?"
      ).run(studentId);
      return;
    }

    const placeholders = uniqueIds.map(() => "?").join(", ");
    this.db.prepare(`
      DELETE FROM student_guardian
      WHERE student_id = ? AND guardian_id NOT IN (${placeholders})
    `).run(studentId, ...uniqueIds);
    for (const guardianId of uniqueIds) {
      this.assignGuardian(studentId, guardianId, roles.get(guardianId));
    }
  }

  assignPendingSubject(yearSubjectId, studentId) {
    return this.db.prepare(`
      INSERT INTO pending_subject (year_subject_id, student_id)
      VALUES (?, ?)
      ON CONFLICT(year_subject_id, student_id) DO NOTHING
    `).run(yearSubjectId, studentId);
  }

  findAllPendingSubjectsByPeriod(periodId, studentId) {
    return this.findAllPendingSubjectsByStudents(periodId, [studentId]);
  }

  findAllPendingSubjectsByStudents(periodId, studentIds) {
    const uniqueStudentIds = [...new Set(studentIds.map(String))];
    if (uniqueStudentIds.length === 0) return [];

    const placeholders = uniqueStudentIds.map(() => "?").join(", ");
    const periodFilter = periodId === "all"
      ? ""
      : "year_period.period_id = ? AND";
    const params = periodId === "all"
      ? uniqueStudentIds
      : [periodId, ...uniqueStudentIds];
    return this.db.prepare(`
      SELECT subject.id as "subjectId", subject.name, subject.abbr,
        subject.minimum_grade as "minimumGrade",
        pending_subject.year_subject_id as "yearSubjectId",
        pending_subject.student_id as "studentId",
        pending_subject.status, year_period.year_id as "yearId",
        year_period.period_id as "periodId"
      FROM pending_subject
      JOIN year_subject
        ON year_subject.id = pending_subject.year_subject_id
      JOIN year_period ON year_period.id = year_subject.year_period_id
      JOIN subject ON subject.id = year_subject.subject_id
      WHERE ${periodFilter}
        pending_subject.student_id IN (${placeholders})
      ORDER BY pending_subject.student_id ASC,
        year_period.year_id ASC, subject.id ASC
    `).all(...params);
  }

  updatePendingSubject(yearSubjectId, studentId, status) {
    return this.db.prepare(`
      UPDATE pending_subject SET status = ?
      WHERE year_subject_id = ? AND student_id = ?
    `).run(status, yearSubjectId, studentId);
  }

  assignToClass(studentId, classId, status) {
    const query = this.db.prepare(`
        INSERT INTO student_class (student_id, class_id, status)
        VALUES (?, ?, ?)
        `);
    return query.run(studentId, classId, status);
  }

  updateClassStatus(studentId, classId, status) {
    const query = this.db.prepare(`
        UPDATE student_class
        SET status = ?
        WHERE student_id = ? AND class_id = ?
        `);
    return query.run(status, studentId, classId)
  }

  findAllAssignedClasses(studentId) {
    const query = this.db
      .prepare(`SELECT class.id, class.name, class.student_count as "studentCount", class.year_period_id as "yearPeriodId"
                                  FROM class JOIN student_class ON class.id = student_class.class_id
                                  WHERE student_class.student_id = ?`);
    const results = query.all(studentId);
    return results.map(
      (row) =>
        new Class(
          row.id,
          row.name,
          row.studentCount,
          row.yearPeriodId
        )
    );
  }

  findAssignedClassByPeriod(studentId, periodId) {
    const query = this.db.prepare(`
      SELECT class.id, class.name, class.student_count as "studentCount",
        class.year_period_id as "yearPeriodId"
      FROM student_class
      JOIN class ON class.id = student_class.class_id
      JOIN year_period ON year_period.id = class.year_period_id
      WHERE student_class.student_id = ? AND year_period.period_id = ?
      ORDER BY CASE WHEN class.name = 'z' THEN 1 ELSE 0 END
    `);
    const result = query.get(studentId, periodId);
    if (!result) return null;
    return new Class(
      result.id,
      result.name,
      result.studentCount,
      result.yearPeriodId
    );
  }
}

export default new StudentRepository(db);
