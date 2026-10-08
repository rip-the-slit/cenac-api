import PeriodRepository from "../repositories/PeriodRepository.js";
import YearRepository from "../repositories/YearRepository.js";
import StudentRepository from "../repositories/StudentRepository.js";
import SubjectRepository from "../repositories/SubjectRepository.js";
import GuardianRepository from "../repositories/GuardianRepository.js";
import { Class, Period, PeriodStats, Student, Year } from "../models/index.js";

class PeriodService {
  constructor(
    periodRepository,
    yearRepository,
    studentRepository,
    subjectRepository,
    guardianRepository
  ) {
    this.periodRepository = periodRepository;
    this.yearRepository = yearRepository;
    this.studentRepository = studentRepository;
    this.subjectRepository = subjectRepository;
    this.guardianRepository = guardianRepository;
  }

  isPeriod(period) {
    if (!(period instanceof Period)) {
      throw new Error("Periodo Escolar no registrado");
    }
    return true;
  }

  getPeriodList() {
    return this.periodRepository.findAll();
  }

  getPeriodFilterData(
    periodId,
    {
      includeSubjects = false,
      useGeneralStatuses = false,
    } = {}
  ) {
    const isAllPeriods = periodId === "all";
    const years = isAllPeriods
      ? this.yearRepository.findAll()
      : this.periodRepository
          .findAllAssignedYears(periodId)
          .map((y) => ({
            ...new Year(y.yearId, y.yearName, y.yearAbbr),
            yearPeriodId: y.id,
          }));
    const classes =
      this.yearRepository.findAllAssignedClassesByPeriod(periodId);
    const classesByYear = Object.fromEntries(
      years.map((year) => [year.id, []])
    );

    if (isAllPeriods) {
      const classesByYearPeriod = new Map();
      for (const assignedClass of classes) {
        const key = `${assignedClass.yearId}-${assignedClass.periodId}`;
        if (!classesByYearPeriod.has(key)) {
          classesByYearPeriod.set(key, {
            yearId: assignedClass.yearId,
            names: [],
          });
        }

        const classNames = classesByYearPeriod.get(key).names;
        if (!classNames.includes(assignedClass.name)) {
          classNames.push(assignedClass.name);
        }
      }

      for (const { yearId, names } of classesByYearPeriod.values()) {
        if (names.length > (classesByYear[yearId]?.length ?? 0)) {
          classesByYear[yearId] = names;
        }
      }
    } else {
      for (const assignedClass of classes) {
        if (!classesByYear[assignedClass.yearId]) {
          classesByYear[assignedClass.yearId] = [];
        }

        const classNames = classesByYear[assignedClass.yearId];
        if (!classNames.includes(assignedClass.name)) {
          classNames.push(assignedClass.name);
        }
      }
    }

    const statuses = useGeneralStatuses
      ? [
          { value: "active", name: "Activo" },
          { value: "inactive", name: "Inactivo" },
        ]
      : [
          { value: "pending", name: "Pendiente" },
          { value: "passed", name: "Aprobado" },
          { value: "failed", name: "Reprobado" },
        ];
    const filterData = { years, classesByYear, statuses };
    if (!includeSubjects) return filterData;

    const subjects = isAllPeriods
      ? this.subjectRepository.findAll()
      : this.subjectRepository.findAllByPeriod(periodId);
    const assignedSubjectsByYear = isAllPeriods
      ? {}
      : Object.fromEntries(
          years.map((year) => [
            year.id,
            this.yearRepository.findAllAssignedSubjects(year.yearPeriodId),
          ])
        );
    const subjectsByYear = isAllPeriods
      ? Object.fromEntries(
          years.map((year) => [year.id, subjects.map((subject) => subject.id)])
        )
      : Object.fromEntries(
          years.map((year) => [
            year.id,
            assignedSubjectsByYear[year.id].map((subject) => subject.id),
          ])
        );

    return {
      ...filterData,
      subjects,
      subjectsByYear,
    };
  }

  getPeriodStats(id) {
    const period = id === "all"
      ? new Period("all", null, null, null, null, null)
      : this.periodRepository.findById(id);
    this.isPeriod(period);

    const gradeCount = this.periodRepository.getGradeCount(id);
    const loadedGrades = gradeCount.find((g) => g.loaded === 1)?.count || 0;
    const notLoadedGrades = gradeCount.find((g) => g.loaded === 0)?.count || 0;

    const studentCount = this.periodRepository.getStudentCount(id);
    const totalStudents = studentCount.reduce((t, c) => t + c.count, 0);
    const passedStudents =
      studentCount.find((c) => c.status === "passed")?.count || 0;

    period.stats =
      period.status === "new"
        ? null
        : new PeriodStats(
            loadedGrades + notLoadedGrades,
            loadedGrades,
            totalStudents,
            passedStudents
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

  addPeriod(period, userId) {
    const periodList = this.periodRepository.findAll();

    if (!this.isPeriodListAddable(periodList)) {
      throw new Error(
        "No se puede agregar un nuevo periodo sin haber archivado los demás"
      );
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
      userId
    );
    this.periodRepository.create(newPeriod);
    return newPeriod;
  }

  // POST /periods/:id/load → loadPeriodData(periodId, students, subjectsPerYear)
  // students: array of student objects with _class: { id, year }
  // subjectsPerYear: { [yearId]: subjectId[] }
  // Only populates if the period has no students yet (mirrors frontend guard)
  loadPeriodData(periodId, students, subjectsPerYear) {
    return this.periodRepository.db.transaction(() => {
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
      const yearSubjectMap = new Map();
      const classMap = new Map();

      for (const year of this.yearRepository.findAll()) {
        if (!subjectsByYear[year.id]) continue;

        const yearPeriod = this.periodRepository.assignYear(year.id, period.id);
        yearPeriodMap.set(Number(year.id), yearPeriod);

        for (const subjectId of subjectsByYear[year.id]) {
          const result = this.yearRepository.assignSubject(
            subjectId,
            yearPeriod.id
          );
          yearSubjectMap.set(
            `${Number(year.id)}-${String(subjectId)}`,
            result.lastInsertRowid
          );
        }
      }

      const expandedStudents = [];
      const pendingAssignments = new Map();
      for (const student of studentsToLoad) {
        const yearId = Number(student._class?.year);
        expandedStudents.push(student);

        if (Object.prototype.hasOwnProperty.call(student, "assignedGuardians")) {
          if (!Array.isArray(student.assignedGuardians)) {
            const error = new Error(
              "Los representantes asignados deben ser un arreglo"
            );
            error.status = 400;
            throw error;
          }
          for (const guardian of student.assignedGuardians) {
            if (!guardian?.id || !this.guardianRepository.findById(guardian.id)) {
              const error = new Error(
                `Representante no registrado: ${guardian?.id ?? "sin cédula"}`
              );
              error.status = 400;
              throw error;
            }
          }
        }

        const floating = student._class?.id === "z";
        const pendingYear = floating ? yearId : yearId - 1;
        const assignedPendingSubjects = [];
        for (const subjectId of Array.isArray(student.pendingSubjects)
          ? student.pendingSubjects
          : []) {
          const yearSubjectId = yearSubjectMap.get(
            `${pendingYear}-${String(subjectId)}`
          );
          if (!yearSubjectId) continue;

          if (!pendingAssignments.has(student.id)) {
            pendingAssignments.set(student.id, []);
          }
          pendingAssignments.get(student.id).push(yearSubjectId);
          assignedPendingSubjects.push(subjectId);
        }

        if (!floating && assignedPendingSubjects.length > 0) {
          expandedStudents.push({
            ...student,
            pendingSubjects: assignedPendingSubjects,
            assignedGuardians: undefined,
            _class: { id: "z", year: pendingYear },
          });
        }
      }

      const classCounts = new Map();
      for (const student of expandedStudents) {
        const yearId = Number(student._class?.year);
        const className = student._class?.id;
        const yearPeriod = yearPeriodMap.get(yearId);
        if (!yearPeriod || !className) continue;

        const key = `${yearPeriod.id}-${className}`;
        if (!classCounts.has(key)) classCounts.set(key, new Set());
        classCounts.get(key).add(student.id);
      }

      const createdStudents = new Set();
      for (const student of expandedStudents) {
        if (!createdStudents.has(student.id)) {
          if (!this.studentRepository.findById(student.id)) {
            this.studentRepository.create(
              new Student(
                student.id,
                student.firstName,
                student.lastName,
                student.birthDate,
                student.birthPlace,
                "active"
              )
            );
          }
          createdStudents.add(student.id);

          for (const yearSubjectId of pendingAssignments.get(student.id) || []) {
            this.studentRepository.assignPendingSubject(
              yearSubjectId,
              student.id
            );
          }

          if (Object.prototype.hasOwnProperty.call(student, "assignedGuardians")) {
            this.studentRepository.syncAssignedGuardians(
              student.id,
              student.assignedGuardians.map(({ id }) => id)
            );
          }
        }

        const yearId = Number(student._class?.year);
        const className = student._class?.id;
        const yearPeriod = yearPeriodMap.get(yearId);
        if (!yearPeriod || !className) continue;

        const classKey = `${yearPeriod.id}-${className}`;
        let assignedClass = classMap.get(classKey);
        if (!assignedClass) {
          assignedClass = this.yearRepository.assignClass(
            new Class(
              null,
              className,
              classCounts.get(classKey)?.size ?? 0,
              yearPeriod.id
            )
          );
          classMap.set(classKey, assignedClass);
        }

        this.studentRepository.assignToClass(
          student.id,
          assignedClass.id,
          "pending"
        );
      }

      this.periodRepository.update(periodId, { ...period, status: "active" });
      this.studentRepository.updateStatusByPeriod(periodId, "active");

      return { loaded: true };
    });
  }

  archivePeriod(periodId, supersede, userId) {
    return this.periodRepository.db.transaction(() => {
      const period = this.periodRepository.findById(periodId);
      this.isPeriod(period);

      this.studentRepository.updateStatusByPeriod(periodId, "inactive");
      this.periodRepository.update(periodId, { ...period, status: "archived" });

      if (!supersede) return;

      const newPeriod = new Period(
        period.endYear,
        "new",
        period.endYear,
        period.endYear + 1,
        period.openingDate,
        userId
      );

      const periodList = this.periodRepository.findAll();

      if (!this.isPeriodListAddable(periodList)) {
        throw new Error(
          "No se puede agregar un nuevo periodo sin haber archivado los demás"
        );
      }

      this.periodRepository.create(newPeriod);

      return this.periodRepository.findById(newPeriod.id);
    });
  }
}

export default new PeriodService(
  PeriodRepository,
  YearRepository,
  StudentRepository,
  SubjectRepository,
  GuardianRepository
);
