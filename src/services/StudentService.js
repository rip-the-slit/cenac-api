import PeriodRepository from "../repositories/PeriodRepository.js";
import YearRepository from "../repositories/YearRepository.js";
import StudentRepository from "../repositories/StudentRepository.js";
import { Period } from "../models/index.js";
import {
  normalizeQueryValue,
  normalizeQueryValues,
  sanitizePagination,
} from "./queryUtils.js";
import PeriodService from "./PeriodService.js";

class StudentService {
  constructor(
    periodRepository,
    yearRepository,
    studentRepository,
    periodService
  ) {
    this.periodRepository = periodRepository;
    this.yearRepository = yearRepository;
    this.studentRepository = studentRepository;
    this.periodService = periodService;
  }

  isPeriod(period) {
    if (!(period instanceof Period)) {
      throw new Error("Periodo Escolar no registrado");
    }
    return true;
  }

  // GET /periods/:id/classes -> getClassesByYear(periodId)
  // Returns { [yearId]: className[] }
  getClassesByYear(periodId) {
    if (periodId !== "all") {
      const period = this.periodRepository.findById(periodId);
      this.isPeriod(period);
    }

    return this.periodService.getPeriodFilterData(periodId).classesByYear;
  }

  getStudentsByPeriod(periodId, filters = {}) {
    if (periodId !== "all") {
      const period = this.periodRepository.findById(periodId);
      this.isPeriod(period);
    }

    const sanitizedFilters = {
      id: normalizeQueryValues(filters.id),
      firstName: normalizeQueryValues(filters.firstName),
      lastName: normalizeQueryValues(filters.lastName),
      dateOfBirth: normalizeQueryValues(filters.dateOfBirth),
      birthPlace: normalizeQueryValues(filters.birthPlace),
      yearId: normalizeQueryValues(filters.year),
      className: normalizeQueryValues(filters.classId ?? filters.className),
      status: normalizeQueryValues(filters.status),
    };
    const pagination = sanitizePagination(filters);
    const { rows: rawRows, recordsAmount } =
      this.studentRepository.findAllByPeriod(periodId, {
        filters: sanitizedFilters,
        pagination,
        deduplicate: periodId === "all",
      });

    const rows = rawRows.map((student) => ({
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      birthDate: student.birthDate,
      birthPlace: student.birthPlace,
      status: student.status,
      _class: student.className
        ? { id: student.className, year: student.yearId }
        : null,
    }));
    const filterData = this.periodService.getPeriodFilterData(periodId, {
      useGeneralStatuses: periodId === "all",
    });

    return {
      rows,
      recordsAmount,
      ...filterData,
      studentFieldLabels: {
        id: "Cédula",
        firstName: "Nombres",
        lastName: "Apellidos",
        birthDate: "Fecha de Nacimiento",
        birthPlace: "Lugar de Nacimiento",
        class: periodId === "all" ? "Sección actual" : "Sección",
        status: periodId === "all" ? "Estatus General" : "Estatus del Periodo",
      },
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
    });
    const enrollment = rows.find((row) => row.id === studentId);
    if (enrollment) student.status = enrollment.status;
    student._class = enrollment?.className
      ? { id: enrollment.className, year: enrollment.yearId }
      : null;

    return {
      student,
      studentFieldLabels: {
        id: "Cédula",
        firstName: "Nombres",
        lastName: "Apellidos",
        birthDate: "Fecha de Nacimiento",
        birthPlace: "Lugar de Nacimiento",
        status: periodId === "all" ? "Estatus General" : "Estatus del Periodo",
      },
    };
  }

  _buildClassSuggestions(students, sourcePeriodYearIds) {
    const availableYears = new Set(sourcePeriodYearIds.map(Number));
    const suggestions = [];

    for (const student of students) {
      const nextYearId = Number(student._class?.year) + 1;
      const hasPassingStatus =
        student.status === "passed" || student.status === "pending";
      if (
        student._class &&
        hasPassingStatus &&
        availableYears.has(nextYearId)
      ) {
        suggestions.push({
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          birthDate: student.birthDate,
          birthPlace: student.birthPlace,
          _locked: true,
          _class: { id: student._class.id, year: nextYearId },
        });
      }
    }

    return suggestions;
  }

  getClassSuggestions() {
    const sourcePeriod = this.periodRepository
      .findAll()
      .find((period) => period.status === "archived");
    const sourcePeriodStudents = sourcePeriod
      ? this.getStudentsByPeriod(sourcePeriod.id)
      : { rows: [], years: [] };
    const sourcePeriodYearIds = sourcePeriodStudents.years.map(({ id }) =>
      Number(id)
    );
    const students = this._buildClassSuggestions(
      sourcePeriodStudents.rows,
      sourcePeriodYearIds
    );

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
      studentFieldLabels: {
        id: "Cédula",
        firstName: "Nombres",
        lastName: "Apellidos",
        birthDate: "Fecha de Nacimiento",
        birthPlace: "Lugar de Nacimiento",
      },
    };
  }
}

export default new StudentService(
  PeriodRepository,
  YearRepository,
  StudentRepository,
  PeriodService
);
