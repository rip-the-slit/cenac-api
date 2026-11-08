import PeriodRepository from "../repositories/PeriodRepository.js";
import StudentRepository from "../repositories/StudentRepository.js";
import SubjectRepository from "../repositories/SubjectRepository.js";
import PlaceRepository from "../repositories/PlaceRepository.js";
import GuardianRepository from "../repositories/GuardianRepository.js";
import { Period, Student } from "../models/index.js";
import {
  normalizeQueryValue,
  normalizeQueryValues,
  sanitizePagination,
} from "./queryUtils.js";
import PeriodService from "./PeriodService.js";
import GuardianService from "./GuardianService.js";
import GradeService from "./GradeService.js";
import { getGuardianFields, getStudentFields } from "./fieldDefinitions.js";

class StudentService {
  constructor(
    periodRepository,
    studentRepository,
    subjectRepository,
    periodService,
    guardianService,
    gradeService,
    placeRepository,
    guardianRepository
  ) {
    this.periodRepository = periodRepository;
    this.studentRepository = studentRepository;
    this.subjectRepository = subjectRepository;
    this.periodService = periodService;
    this.guardianService = guardianService;
    this.gradeService = gradeService;
    this.placeRepository = placeRepository;
    this.guardianRepository = guardianRepository;
  }

  updateStudent(id, studentData = {}) {
    const current = this.studentRepository.findById(id);
    if (!current) {
      const error = new Error("Estudiante no registrado");
      error.status = 404;
      throw error;
    }
    const student = new Student(
      id,
      studentData.firstName ?? current.firstName,
      studentData.lastName ?? current.lastName,
      studentData.birthDate ?? current.birthDate,
      studentData.birthPlace ?? current.birthPlace,
      studentData.status ?? current.status
    );
    if (
      !student.firstName ||
      !student.lastName ||
      !["active", "inactive"].includes(student.status)
    ) {
      const error = new Error(
        "Los nombres, apellidos y un estatus válido son requeridos"
      );
      error.status = 400;
      throw error;
    }
    const syncGuardians = Object.prototype.hasOwnProperty.call(
      studentData,
      "assignedGuardians"
    );
    if (syncGuardians) {
      if (!Array.isArray(studentData.assignedGuardians)) {
        const error = new Error(
          "Los representantes asignados deben ser un arreglo"
        );
        error.status = 400;
        throw error;
      }
      for (const guardian of studentData.assignedGuardians) {
        if (!guardian?.id || !this.guardianRepository.findById(guardian.id)) {
          const error = new Error(
            `Representante no registrado: ${guardian?.id ?? "sin cédula"}`
          );
          error.status = 400;
          throw error;
        }
      }
    }
    return this.studentRepository.db.transaction(() => {
      this.studentRepository.update(id, student);
      if (syncGuardians) {
        this.studentRepository.syncAssignedGuardians(
          id,
          studentData.assignedGuardians.map(({ id: guardianId }) => guardianId)
        );
      }
      student.assignedGuardians =
        this.studentRepository.findAllAssignedGuardians(id);
      return student;
    });
  }

  getPlaces(filters = {}) {
    const type = normalizeQueryValue(filters.type);
    const country = normalizeQueryValue(filters.country);
    const state = normalizeQueryValue(filters.state);
    const q = normalizeQueryValue(filters.q);
    const methods = {
      country: "findAllCountries",
      state: "findAllStates",
      municipality: "findAllMunicipalities",
    };
    if (
      !Object.prototype.hasOwnProperty.call(methods, type) ||
      (type !== "country" && !country) ||
      (type === "municipality" && (!state || !/^\d+$/.test(state)))
    ) {
      const error = new Error(
        "Indique un tipo de lugar válido, el país para estados y municipios, y el ID del estado para municipios"
      );
      error.status = 400;
      throw error;
    }
    return this.placeRepository[methods[type]](
      { country, state, q },
      sanitizePagination(filters)
    );
  }

  isPeriod(period) {
    if (!(period instanceof Period)) {
      throw new Error("Periodo Escolar no registrado");
    }
    return true;
  }

  _parseStudentRows(rawRows) {
    const students = new Map();
    const guardianIds = new Map();

    for (const row of rawRows) {
      const key = JSON.stringify([
        row.id,
        row.periodId,
        row.yearId,
        row.classDatabaseId,
      ]);
      if (!students.has(key)) {
        students.set(key, {
          id: row.id,
          firstName: row.firstName,
          lastName: row.lastName,
          birthDate: row.birthDate,
          birthPlace: row.birthPlace,
          status: row.status,
          classDatabaseId: row.classDatabaseId,
          className: row.className,
          classStudentCount: row.classStudentCount,
          yearPeriodId: row.yearPeriodId,
          yearId: row.yearId,
          yearName: row.yearName,
          periodId: row.periodId,
          periodStatus: row.periodStatus,
          periodStartYear: row.periodStartYear,
          assignedGuardians: [],
        });
        guardianIds.set(key, new Set());
      }

      if (
        row.assignedGuardianId &&
        !guardianIds.get(key).has(row.assignedGuardianId)
      ) {
        students.get(key).assignedGuardians.push({
          id: row.assignedGuardianId,
          firstName: row.assignedGuardianFirstName,
          lastName: row.assignedGuardianLastName,
          birthDate: row.assignedGuardianBirthDate,
          legalRole: row.assignedGuardianLegalRole,
          phone: row.assignedGuardianPhone,
          address: row.assignedGuardianAddress,
        });
        guardianIds.get(key).add(row.assignedGuardianId);
      }
    }

    return Array.from(students.values());
  }

  getStudentsByPeriod(
    periodId,
    filters = {},
    includeGuardians = true,
    deduplicate
  ) {
    if (periodId !== "all") {
      const period = this.periodRepository.findById(periodId);
      this.isPeriod(period);
    }

    const sanitizedFilters = {
      id: normalizeQueryValues(filters.id),
      firstName: normalizeQueryValues(filters.firstName),
      lastName: normalizeQueryValues(filters.lastName),
      dateOfBirth: normalizeQueryValues(
        filters.birthDate ?? filters.dateOfBirth
      ),
      birthPlace: normalizeQueryValues(filters.birthPlace),
      yearId: normalizeQueryValues(filters.year),
      className: normalizeQueryValues(filters.classId ?? filters.className),
      status: normalizeQueryValues(filters.status),
      q: normalizeQueryValues(filters.q),
      guardianId: normalizeQueryValues(filters.guardianId),
      guardianFirstName: normalizeQueryValues(filters.guardianFirstName),
      guardianLastName: normalizeQueryValues(filters.guardianLastName),
      guardianQ: normalizeQueryValues(filters.guardianQ),
    };
    const pagination = sanitizePagination(filters);
    const { rows: rawRows, recordsAmount } =
      this.studentRepository.findAllByPeriod(periodId, {
        filters: sanitizedFilters,
        pagination,
        deduplicate:
          typeof deduplicate === "boolean" ? deduplicate : periodId === "all",
        includeGuardians,
      });

    const rows = this._parseStudentRows(rawRows).map((student) => ({
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      birthDate: student.birthDate,
      birthPlace: student.birthPlace,
      status: student.status,
      periodId: student.periodId,
      _class: student.className
        ? { id: student.className, year: student.yearId }
        : null,
      assignedGuardians: student.assignedGuardians,
    }));
    const filterData = this.periodService.getPeriodFilterData(periodId, {
      useGeneralStatuses: periodId === "all",
    });

    return {
      rows,
      recordsAmount,
      ...filterData,
      fields: getStudentFields({ allPeriods: periodId === "all" }),
    };
  }

  getStudentById(periodId, studentId) {
    if (periodId !== "all") {
      const period = this.periodRepository.findById(periodId);
      this.isPeriod(period);
    }

    const student = this.studentRepository.findById(studentId);
    if (!student) throw new Error("Estudiante no registrado");

    const { rows } = this.studentRepository.findAllByPeriod(periodId, {
      filters: { id: normalizeQueryValue(studentId) },
      deduplicate: periodId === "all",
      includeGuardians: true,
    });
    const enrollments = this._parseStudentRows(rows);
    const enrollment =
      enrollments.find(
        (row) => row.id === studentId && String(row.className) !== "z"
      ) ?? enrollments.find((row) => row.id === studentId);
    if (enrollment) {
      student.status = enrollment.status;
      student.assignedGuardians = enrollment.assignedGuardians;
    }
    student._class = enrollment?.className
      ? { id: enrollment.className, year: enrollment.yearId }
      : null;

    return {
      student,
      fields: {
        student: getStudentFields({
          allPeriods: periodId === "all",
          editor: true,
        }),
        guardian: getGuardianFields(),
      },
    };
  }

  _buildClassSuggestions(
    students,
    sourcePeriod,
    subjectsByYear,
    subjects = []
  ) {
    const availableYears = new Set(Object.keys(subjectsByYear).map(Number));
    const enrollmentsByStudent = new Map();
    const regularToCalculate = [];
    const floatingIds = new Set();

    for (const student of students) {
      if (!student._class) continue;
      if (!enrollmentsByStudent.has(student.id)) {
        enrollmentsByStudent.set(student.id, {
          regular: null,
          floating: null,
        });
      }
      const enrollment = {
        ...student,
        yearId: Number(student._class.year),
        className: student._class.id,
        periodId: sourcePeriod.id,
        periodStartYear: sourcePeriod.startYear,
      };
      const grouped = enrollmentsByStudent.get(student.id);

      if (String(student._class.id) === "z") {
        grouped.floating = enrollment;
        if (student.status !== "passed") floatingIds.add(student.id);
      } else {
        grouped.regular = enrollment;
        if (student.status === "pending") regularToCalculate.push(enrollment);
      }
    }

    const regularResults = new Map();
    if (regularToCalculate.length > 0) {
      const regularIds = [...new Set(regularToCalculate.map(({ id }) => id))];
      const assignments = this.subjectRepository.findAllAssignmentsByPeriod(
        sourcePeriod.id
      );
      const assignmentsByYear = this.gradeService._groupByYear(assignments);
      const gradeRows = this.subjectRepository.findAllGradesByStudents(
        sourcePeriod.id,
        regularIds
      );
      const rowsToParse = regularToCalculate.map((student) => ({
        ...student,
        subjectAssignments: assignmentsByYear[student.yearId] || [],
      }));
      const parsed = this.gradeService._parseGradeRows(
        rowsToParse,
        gradeRows,
        subjectsByYear,
        subjects
      );
      for (const student of parsed) {
        regularResults.set(
          this.gradeService._enrollmentKey(
            student.id,
            student.periodId,
            student.yearId
          ),
          this.gradeService.calculateStatus(student.grades)
        );
      }
    }

    const pendingSubjects =
      floatingIds.size > 0
        ? this.studentRepository.findAllPendingSubjectsByStudents(
            sourcePeriod.id,
            [...floatingIds]
          )
        : [];
    const pendingByEnrollment = new Map();
    for (const subject of pendingSubjects) {
      const key = this.gradeService._enrollmentKey(
        subject.studentId,
        subject.periodId,
        subject.yearId
      );
      if (!pendingByEnrollment.has(key)) pendingByEnrollment.set(key, []);
      pendingByEnrollment.get(key).push(subject);
    }

    const suggestions = [];
    for (const { regular, floating } of enrollmentsByStudent.values()) {
      const main = regular || floating;
      if (!main) continue;

      const regularResult =
        regular?.status === "pending"
          ? regularResults.get(
              this.gradeService._enrollmentKey(
                regular.id,
                regular.periodId,
                regular.yearId
              )
            ) || { status: "failed", subjects: [] }
          : { status: regular?.status, subjects: [] };
      const floatingRows = floating
        ? pendingByEnrollment.get(
            this.gradeService._enrollmentKey(
              floating.id,
              floating.periodId,
              floating.yearId
            )
          ) || []
        : [];
      const failedFloatingSubjects = floatingRows
        .filter(({ status }) => status !== "passed")
        .map(({ subjectId }) => subjectId);
      const floatingFailed = Boolean(
        floating &&
          floating.status !== "passed" &&
          failedFloatingSubjects.length > 0
      );
      const failedRegularSubjects = regularResult.subjects
        .filter(({ status }) => status === "failed")
        .map(({ subjectId }) => subjectId);
      const currentYear = Number(regular?.yearId ?? floating?.yearId);
      const nextYear = currentYear + 1;

      const suggestion = {
        id: main.id,
        firstName: main.firstName,
        lastName: main.lastName,
        birthDate: main.birthDate,
        birthPlace: main.birthPlace,
        assignedGuardians: main.assignedGuardians,
        _class: {
          id: regular?.className ?? main.className,
          year: currentYear,
          originalYear: currentYear,
        },
      };

      if (
        floating &&
        !regular &&
        (availableYears.has(nextYear) || !floatingFailed)
      )
        continue;

      if (floatingFailed) {
        suggestion.pendingSubjects = failedFloatingSubjects;
      } else if (regularResult.status === "passed") {
        if (!availableYears.has(nextYear)) continue;
        suggestion._class.year = nextYear;
      } else if (regularResult.status === "pending") {
        if (availableYears.has(nextYear)) suggestion._class.year = nextYear;
        else suggestion._class.id = "z";
        suggestion.pendingSubjects = failedRegularSubjects;
      }

      suggestions.push(suggestion);
    }

    return suggestions;
  }

  getClassSuggestions(studentId) {
    const studentEnrollments =
      typeof studentId === "string"
        ? this.getStudentsByPeriod("all", { id: studentId }, false, false)
        : null;

    const sourcePeriod = this.periodRepository
      .findAll()
      .find(
        (period) =>
          period.status === "archived" &&
          (studentEnrollments
            ? studentEnrollments.rows.find(
                ({ periodId }) => periodId === period.id
              )
            : true)
      );
    const sourcePeriodStudents = sourcePeriod
      ? this.getStudentsByPeriod(
          sourcePeriod.id,
          studentEnrollments ? { id: studentId } : {},
          true
        )
      : { rows: [] };
    const filterData = sourcePeriod
      ? this.periodService.getPeriodFilterData(sourcePeriod.id, {
          includeSubjects: true,
        })
      : { subjectsByYear: {}, subjects: [] };
    const students = sourcePeriod
      ? this._buildClassSuggestions(
          sourcePeriodStudents.rows,
          sourcePeriod,
          filterData.subjectsByYear,
          filterData.subjects
        )
      : [];

    return {
      students,
      studentClass: {
        id: "",
        firstName: "",
        lastName: "",
        birthDate: "",
        birthPlace: "",
        _locked: false,
        _class: { id: "", year: null },
      },
      guardianClass: {
        id: "",
        firstName: "",
        lastName: "",
        birthDate: "",
        legalRole: "",
        phone: "",
        address: "",
      },
      fields: {
        student: getStudentFields({ editor: true }),
        guardian: getGuardianFields(),
      },
    };
  }
}

export default new StudentService(
  PeriodRepository,
  StudentRepository,
  SubjectRepository,
  PeriodService,
  GuardianService,
  GradeService,
  PlaceRepository,
  GuardianRepository
);
