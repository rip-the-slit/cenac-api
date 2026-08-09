import SubjectRepository from "../repositories/SubjectRepository.js";
import PeriodRepository from "../repositories/PeriodRepository.js";
import YearRepository from "../repositories/YearRepository.js";
import StudentRepository from "../repositories/StudentRepository.js";
import { Grade } from "../models/index.js";
import { normalizeQueryValue, sanitizePagination } from "./queryUtils.js";
import PeriodService from "./PeriodService.js";

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

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

  _getStudentClassStatus(studentId, periodId) {
    const assignedClass = this.studentRepository.findAssignedClassByPeriod(
      studentId,
      periodId
    );
    const yearPeriodId = assignedClass.yearPeriodId;
    const subjects = this.yearRepository.findAllAssignedSubjects(yearPeriodId);

    let total = 0;
    for (const subject of subjects) {
      const avg = this.subjectRepository.getGradeAvgByStudent(
        subject.yearSubjectId,
        studentId
      );
      total += avg;
    }

    total /= subjects.length;

    if (total < subjects[0].minimumGrade) {
      return { status: "Reprobado", classId: assignedClass.id };
    }

    return { status: "Aprobado", classId: assignedClass.id };
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
      classId: student.className,
      yearId: student.yearId,
    }));
  }

  // Builds a map: `${yearId}-${subjectId}` → yearSubjectId
  _getYearSubjectMap(periodId) {
    const yearPeriods = this.periodRepository.findAllAssignedYears(periodId);
    const map = new Map();
    for (const yp of yearPeriods) {
      const subjects = this.yearRepository.findAllAssignedSubjects(yp.id);
      for (const s of subjects) {
        map.set(`${yp.yearId}-${s.id}`, s.yearSubjectId);
      }
    }
    return map;
  }

  _parseGradeRows(studentRows, gradeRows) {
    const students = new Map(
      studentRows.map((student) => [
        student.id,
        {
          id: student.id,
          fullName: `${student.lastName} ${student.firstName}`,
          status: student.status,
          class: `${student.yearName || student.yearId} ${student.className}`,
          grades: {},
        },
      ])
    );

    for (const rawGrade of gradeRows) {
      const student = students.get(rawGrade.studentId);
      if (!student) continue;

      const subjectId = String(rawGrade.subjectId);
      if (!student.grades[subjectId]) {
        student.grades[subjectId] = {
          avg: toNumberOrNull(rawGrade.subjectAverage),
          terms: Array.from({ length: 3 }, () => Array(4).fill(null)),
          termAverages: Array(3).fill(null),
        };
      }

      const subjectGrades = student.grades[subjectId];
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
    const period = this.periodRepository.findById(periodId);
    if (!period) throw new Error("Periodo Escolar no registrado");

    const sanitizedFilters = {
      yearId: normalizeQueryValue(filters.yearId),
      className: normalizeQueryValue(filters.classId),
      status: normalizeQueryValue(filters.status),
      q: normalizeQueryValue(filters.q),
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
      rows: this._parseGradeRows(studentRows, gradeRows),
      recordsAmount,
      studentGradesFieldLabels: {
        id: "Cédula",
        fullName: "Nombre Completo",
        status: "Estatus",
        class: "Sección",
        grades: "Notas",
      },
      ...filterData,
      statuses: ["Aprobado", "Reprobado"],
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

          const yearSubjectId = yearSubjectMap.get(`${student.yearId}-${sKey}`);
          if (!yearSubjectId) continue;

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

              const grade = new Grade(
                id,
                term,
                value,
                strategy,
                student.id,
                yearSubjectId
              );

              this.subjectRepository.assignGrade(grade);
            });
          });
        }

        const newClassStatus = this._getStudentClassStatus(student.id, periodId);
        this.studentRepository.updateClassStatus(
          student.id,
          newClassStatus.classId,
          newClassStatus.status
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
