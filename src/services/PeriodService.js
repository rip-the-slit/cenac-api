import PeriodRepository from "../repositories/PeriodRepository.js";
import YearRepository from "../repositories/YearRepository.js";
import StudentRepository from "../repositories/StudentRepository.js";
import { Class, Period, PeriodStats, Student } from "../models/index.js";

class PeriodService {
  constructor(periodRepository, yearRepository, studentRepository) {
    this.periodRepository = periodRepository;
    this.yearRepository = yearRepository;
    this.studentRepository = studentRepository;
  }

  isPeriod(period) {
    if (!(period instanceof Period)) {
      throw new Error("Periodo Escolar no registrado");
    }
    return true;
  }

  getPeriodList() {
    return this.periodRepository.findAll().map((p) => p.id);
  }

  getPeriodStats(id) {
    const period = this.periodRepository.findById(id);
    this.isPeriod(period);

    const gradeCount = this.periodRepository.getGradeCount(id);
    const loadedGrades = gradeCount.find((g) => g.loaded === 1)?.count || 0;
    const notLoadedGrades = gradeCount.find((g) => g.loaded === 0)?.count || 0;

    const studentCount = this.periodRepository.getStudentCount(id);
    const totalStudents = studentCount.reduce((t, c) => t + c.count, 0);
    const approvedStudents =
      studentCount.find((c) => c.status === "approved")?.count || 0;

    period.stats =
      period.status === "new"
        ? null
        : new PeriodStats(
            loadedGrades + notLoadedGrades,
            loadedGrades,
            totalStudents,
            approvedStudents
          );

    return period;
  }

  isPeriodListAddable(periodList) {
    if (!Array.isArray(periodList)) {
      return false;
    }

    return !periodList.some(
      (period) => period.status === "new" || period.status === "active"
    );
  }

  isValidNewPeriod(period) {
    const isSqliteDate = (date) => {
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return false;
      }

      const [year, month, day] = date.split("-").map(Number);
      const parsedDate = new Date(Date.UTC(year, month - 1, day));

      return (
        parsedDate.getUTCFullYear() === year &&
        parsedDate.getUTCMonth() === month - 1 &&
        parsedDate.getUTCDate() === day
      );
    };

    if (!period || typeof period !== "object") {
      return false;
    }

    if (
      !Number.isInteger(period.startYear) ||
      !Number.isInteger(period.endYear)
    ) {
      return false;
    }

    if (period.endYear !== period.startYear + 1) {
      return false;
    }

    if (!isSqliteDate(period.openingDate)) {
      return false;
    }

    const openingYear = Number(period.openingDate.slice(0, 4));
    return openingYear === period.startYear;
  }

  addPeriod(period) {
    const periodList = this.periodRepository.findAll();

    if (!this.isPeriodListAddable(periodList)) {
      throw new Error("No se puede agregar un nuevo periodo sin haber archivado los todos los demás");
    }

    if (!this.isValidNewPeriod(period)) {
      throw new Error("Periodo no válido");
    }
    
    const newPeriod = new Period(
      period.startYear,
      "new",
      period.startYear,
      period.endYear,
      period.openingDate,
      null
    );
    this.periodRepository.create(newPeriod);
    return newPeriod
  }

  // POST /periods/:id/load → loadPeriodData(periodId, students, subjectsPerYear)
  // students: array of student objects with _class: { id, year }
  // subjectsPerYear: { [yearId]: subjectId[] }
  // Only populates if the period has no students yet (mirrors frontend guard)
  loadPeriodData(periodId, students, subjectsPerYear) {
    const period = this.periodRepository.findById(periodId);
    this.isPeriod(period);

    if (period.status !== "new") {
      return { loaded: false, reason: "already_loaded" };
    }

    const studentsToLoad = Array.isArray(students) ? students : [];
    const subjectsByYear =
      subjectsPerYear && typeof subjectsPerYear === "object"
        ? subjectsPerYear
        : {};

    const yearPeriodMap = new Map();
    const classMap = new Map();

    for (const year of this.yearRepository.findAll()) {
      if (!subjectsByYear[year.id]) {
        continue;
      }

      const yearPeriod = this.periodRepository.assignYear(year.id, period.id);

      for (const subjectId of subjectsByYear[year.id]) {
        this.yearRepository.assignSubject(subjectId, yearPeriod.id);
      }

      yearPeriodMap.set(Number(year.id), yearPeriod);
    }

    for (const student of studentsToLoad) {
      const existingStudent = this.studentRepository.findById(student.id);
      if (!existingStudent) {
        this.studentRepository.create(
          new Student(
            student.id,
            student.firstName,
            student.lastName,
            student.birthDate,
            student.birthPlace,
            student.status ?? "active"
          )
        );
      }

      const yearId = Number(student._class?.year);
      const className = student._class?.id;
      const yp = yearPeriodMap.get(yearId);
      if (!yp || !className) continue;

      let existingClass = classMap.get(`${yp.id}-${className}`);
      if (!existingClass) {
        existingClass = this.yearRepository.assignClass(
          new Class(null, className, null, null, null, yp.id)
        );
        classMap.set(`${yp.id}-${className}`, existingClass);
      }

      this.studentRepository.assignToClass(
        student.id,
        existingClass.id,
        "Reprobado"
      );
    }

    this.periodRepository.update(periodId, { ...period, status: "loaded" });

    return { loaded: true };
  }

}

export default new PeriodService(
  PeriodRepository,
  YearRepository,
  StudentRepository
);
