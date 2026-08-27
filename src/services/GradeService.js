import SubjectRepository from "../repositories/SubjectRepository.js";
import PeriodRepository from "../repositories/PeriodRepository.js";
import YearRepository from "../repositories/YearRepository.js";
import StudentRepository from "../repositories/StudentRepository.js";
import { Grade } from "../models/index.js";
import {
  normalizeQueryValues,
  sanitizePagination,
  toNumberOrNull,
} from "./queryUtils.js";
import PeriodService from "./PeriodService.js";

const GRADE_SLOTS_PER_TERM = 5;

class GradeService {
  constructor(
    subjectRepository,
    periodRepository,
    yearRepository,
    studentRepository,
    periodService
  ) {
    this.subjectRepository = subjectRepository;
    this.periodRepository = periodRepository;
    this.yearRepository = yearRepository;
    this.studentRepository = studentRepository;
    this.periodService = periodService;
  }

  _getStudentClassStatus(assignedSubjects) {
    const subjectsPassed = assignedSubjects.filter(
      ({ average, minimumGrade }) =>
        average !== null && average >= minimumGrade
    ).length;

    if (subjectsPassed === assignedSubjects.length) {
      return "passed";
    }

    if (subjectsPassed >= assignedSubjects.length - 3) {
      return "pending";
    }

    return "failed";
  }

  // Builds { [yearId]: [subjectId, ...] } for a period using existing repositories
  _getSubjectsPerYear(periodId) {
    const yearPeriods = this.periodRepository.findAllAssignedYears(periodId);
    const subjectsPerYear = {};
    for (const yp of yearPeriods) {
      const subjects = this.yearRepository.findAllAssignedSubjects(yp.id);
      subjectsPerYear[String(yp.yearId)] = subjects.map((s) => String(s.id));
    }
    return subjectsPerYear;
  }

  _getStudentsWithMeta(periodId) {
    return this.studentRepository.findAllByPeriod(periodId).rows.map((student) => ({
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      status: student.status,
      classId: student.classDatabaseId,
      yearId: student.yearId,
    }));
  }

  // Builds a map: `${yearId}-${subjectId}` → assignment metadata
  _getYearSubjectMap(periodId) {
    const yearPeriods = this.periodRepository.findAllAssignedYears(periodId);
    const map = new Map();
    for (const yp of yearPeriods) {
      const subjects = this.yearRepository.findAllAssignedSubjects(yp.id);
      for (const s of subjects) {
        map.set(`${yp.yearId}-${s.id}`, {
          yearSubjectId: s.yearSubjectId,
          minimumGrade: s.minimumGrade,
        });
      }
    }
    return map;
  }

  _parseGradeRows(studentRows, gradeRows, subjectsByYear = {}) {
    const enrollmentKey = (studentId, periodId) => JSON.stringify([studentId, periodId]);
    const emptySubjectGrades = () => ({
      avg: null,
      terms: Array.from(
        { length: 3 },
        () => Array(GRADE_SLOTS_PER_TERM).fill(null)
      ),
      termAverages: Array(3).fill(null),
    });

    const students = new Map(
      studentRows.map((student) => [
        enrollmentKey(student.id, student.periodId),
        {
          id: student.id,
          period: student.periodStartYear,
          fullName: `${student.lastName} ${student.firstName}`,
          status: student.status,
          class: `${student.yearName || student.yearId} ${student.className}`,
          grades: Object.fromEntries(
            (subjectsByYear[student.yearId] || []).map((subjectId) => [
              String(subjectId),
              emptySubjectGrades(),
            ])
          ),
        },
      ])
    );

    for (const rawGrade of gradeRows) {
      const student = students.get(
        enrollmentKey(rawGrade.studentId, rawGrade.periodId)
      );
      if (!student) continue;

      const subjectId = String(rawGrade.subjectId);
      if (!student.grades[subjectId]) {
        student.grades[subjectId] = emptySubjectGrades();
      }

      const subjectGrades = student.grades[subjectId];
      subjectGrades.avg ??= toNumberOrNull(rawGrade.subjectAverage);
      const termIndex = Number(rawGrade.term) - 1;
      const strategyIndex = Number(rawGrade.strategy) - 1;
      if (
        subjectGrades.terms[termIndex] &&
        strategyIndex >= 0 &&
        strategyIndex < subjectGrades.terms[termIndex].length
      ) {
        subjectGrades.terms[termIndex][strategyIndex] =
          toNumberOrNull(rawGrade.value);
        subjectGrades.termAverages[termIndex] =
          toNumberOrNull(rawGrade.termAverage);
      }
    }

    return Array.from(students.values()).map((student) => ({
      ...student,
      subjectAverages: Object.fromEntries(
        Object.entries(student.grades).map(([subjectId, details]) => [
          subjectId,
          details.avg,
        ])
      ),
      subjectDetails: student.grades,
    }));
  }

  // GET /grades?periodId&yearId&classId&status&q&page&limit
  getGrades(periodId, filters = {}) {
    if (periodId !== "all") {
      const period = this.periodRepository.findById(periodId);
      if (!period) throw new Error("Periodo Escolar no registrado");
    }

    const sanitizedFilters = {
      yearId: normalizeQueryValues(filters.yearId),
      className: normalizeQueryValues(filters.classId),
      status: normalizeQueryValues(filters.status),
      q: normalizeQueryValues(filters.q),
    };
    const pagination = sanitizePagination(filters);
    const { rows: studentRows, recordsAmount } =
      this.studentRepository.findAllByPeriod(periodId, {
        filters: sanitizedFilters,
        pagination,
      });
    const gradeRows = this.subjectRepository.findAllGradesByStudents(
      periodId,
      studentRows.map((student) => student.id)
    );
    const filterData = this.periodService.getPeriodFilterData(periodId, {
      includeSubjects: true,
    });

    return {
      rows: this._parseGradeRows(
        studentRows,
        gradeRows,
        filterData.subjectsByYear
      ),
      recordsAmount,
      studentGradesFieldLabels: {
        id: "Cédula",
        period: "Periodo Escolar",
        fullName: "Nombre Completo",
        status: "Estatus",
        class: "Sección",
        grades: "Notas",
      },
      ...filterData,
    };
  }

  // POST /grades/load → loadGrades(periodId, grades)
  // grades: [{ id: studentId, subjects: { [subjectId]: terms } }]
  // terms: [[grade, ...], ...]  — each inner array is one term
  // grade can be a number or object: { id, value, strategy }
  loadGrades(periodId, grades) {
    if (!Array.isArray(grades)) return { loaded: 0, skipped: 0 };

    const period = this.periodRepository.findById(periodId);
    if (!period) throw new Error("Periodo Escolar no registrado");

    return this.subjectRepository.db.transaction(() => {
      const subjectsPerYear = this._getSubjectsPerYear(periodId);
      const studentsMeta = this._getStudentsWithMeta(periodId);
      const yearSubjectMap = this._getYearSubjectMap(periodId);
      const studentsById = new Map(studentsMeta.map((s) => [s.id, s]));

      let skipped = 0;

      for (const entry of grades) {
        const student = studentsById.get(entry?.id);
        if (!student || !entry?.subjects || typeof entry.subjects !== "object") {
          skipped++;
          continue;
        }

        const allowed = new Set(subjectsPerYear[String(student.yearId)] || []);

        for (const [rawSubjectId, terms] of Object.entries(entry.subjects)) {
          const sKey = String(rawSubjectId);
          if (!allowed.has(sKey) || !Array.isArray(terms)) continue;

          const yearSubject = yearSubjectMap.get(`${student.yearId}-${sKey}`);
          if (!yearSubject) continue;

          terms.forEach((termGrades, termIndex) => {
            const term = Number(termIndex + 1);
            if (!Array.isArray(termGrades)) return;

            termGrades.forEach((rawGrade, strategyIndex) => {
              const isObj =
                rawGrade &&
                typeof rawGrade === "object" &&
                !Array.isArray(rawGrade);
              const rawValue = isObj ? rawGrade.value : rawGrade;
              const value = toNumberOrNull(rawValue);
              const strategy =
                (isObj && Number(rawGrade.strategy)) || strategyIndex + 1;
              const id = isObj ? rawGrade.id : null;
              if (strategy < 1 || strategy > GRADE_SLOTS_PER_TERM) return;

              const grade = new Grade(
                id,
                term,
                value,
                strategy,
                student.id,
                yearSubject.yearSubjectId
              );

              this.subjectRepository.assignGrade(grade);
            });
          });
        }

        const assignedSubjects = [...allowed].map((subjectId) => {
          const yearSubject = yearSubjectMap.get(
            `${student.yearId}-${subjectId}`
          );
          return {
            average: this.subjectRepository.getGradeAvgByStudent(
              yearSubject.yearSubjectId,
              student.id
            ),
            minimumGrade: yearSubject.minimumGrade,
          };
        });
        const newClassStatus =
          this._getStudentClassStatus(assignedSubjects);
        this.studentRepository.updateClassStatus(
          student.id,
          student.classId,
          newClassStatus
        );
      }

      return { loaded: grades.length - skipped, skipped };
    });
  }

}

export default new GradeService(
  SubjectRepository,
  PeriodRepository,
  YearRepository,
  StudentRepository,
  PeriodService
);
