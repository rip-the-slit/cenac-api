import PeriodRepository from "../repositories/PeriodRepository.js";
import YearRepository from "../repositories/YearRepository.js";
import StudentRepository from "../repositories/StudentRepository.js";
import { Period } from "../models/index.js";
import { normalizeQueryValue, sanitizePagination } from "./queryUtils.js";
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
      id: normalizeQueryValue(filters.id),
      firstName: normalizeQueryValue(filters.firstName),
      lastName: normalizeQueryValue(filters.lastName),
      dateOfBirth: normalizeQueryValue(filters.dateOfBirth),
      birthPlace: normalizeQueryValue(filters.birthPlace),
      yearId: normalizeQueryValue(filters.year),
      className: normalizeQueryValue(filters.classId ?? filters.className),
      status: normalizeQueryValue(filters.status),
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

  getClassSuggestions() {
    const allYears = this.yearRepository.findAll();
    const maxYearId = Math.max(...allYears.map((y) => Number(y.id)));

    const periods = this.periodRepository.findAll();
    let sourcePeriod = null;

    for (const period of periods) {
      const yearPeriod = this.periodRepository.findAllAssignedYears(period.id);
      let hasStudents = false;
      for (const yp of yearPeriod) {
        const classes = this.yearRepository.findAllAssignedClasses(yp.id);
        for (const cls of classes) {
          const students = this.studentRepository.findAllByClass(cls.id);
          if (students.length > 0) {
            hasStudents = true;
            break;
          }
        }
        if (hasStudents) break;
      }
      if (hasStudents) {
        sourcePeriod = period;
        break;
      }
    }

    const students = [];

    if (sourcePeriod) {
      const yearPeriod = this.periodRepository.findAllAssignedYears(
        sourcePeriod.id
      );
      for (const yp of yearPeriod) {
        const currentYearId = Number(yp.yearId);

        if (currentYearId >= maxYearId) continue;

        const nextYearId = currentYearId + 1;
        const classes = this.yearRepository.findAllAssignedClasses(yp.id);

        for (const cls of classes) {
          const classStudents = this.studentRepository.findAllByClass(cls.id);
          for (const student of classStudents) {
            students.push({
              id: student.id,
              firstName: student.firstName,
              lastName: student.lastName,
              birthDate: student.birthDate,
              birthPlace: student.birthPlace,
              _class: { id: "", year: nextYearId },
            });
          }
        }
      }
    }

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
      studentFieldLabels,
    };
  }
}

export default new StudentService(
  PeriodRepository,
  YearRepository,
  StudentRepository,
  PeriodService
);
