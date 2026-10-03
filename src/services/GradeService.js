import SubjectRepository from "../repositories/SubjectRepository.js";
import PeriodRepository from "../repositories/PeriodRepository.js";
import StudentRepository from "../repositories/StudentRepository.js";
import { Grade } from "../models/index.js";
import {
  normalizeQueryValues,
  sanitizePagination,
  toNumberOrNull,
} from "./queryUtils.js";
import PeriodService from "./PeriodService.js";

const GRADE_SLOTS_PER_TERM = 5;
const REVISION_TERM = 4;

class GradeService {
  constructor(
    subjectRepository,
    periodRepository,
    studentRepository,
    periodService
  ) {
    this.subjectRepository = subjectRepository;
    this.periodRepository = periodRepository;
    this.studentRepository = studentRepository;
    this.periodService = periodService;
  }

  _enrollmentKey(studentId, periodId, yearId) {
    return JSON.stringify([String(studentId), String(periodId), Number(yearId)]);
  }

  _groupByYear(rows) {
    const rowsByYear = {};
    for (const row of rows) {
      rowsByYear[row.yearId] ||= [];
      rowsByYear[row.yearId].push(row);
    }
    return rowsByYear;
  }

  _attachPendingSubjects(studentRows, pendingSubjects) {
    const pendingByEnrollment = new Map();
    for (const subject of pendingSubjects) {
      const key = this._enrollmentKey(
        subject.studentId,
        subject.periodId,
        subject.yearId
      );
      if (!pendingByEnrollment.has(key)) pendingByEnrollment.set(key, []);
      pendingByEnrollment.get(key).push(subject);
    }

    return studentRows.map((student) => ({
      ...student,
      classId: student.classDatabaseId,
      floating: String(student.className) === "z",
      pendingSubjects:
        String(student.className) === "z"
          ? pendingByEnrollment.get(
              this._enrollmentKey(
                student.id,
                student.periodId,
                student.yearId
              )
            ) || []
          : [],
    }));
  }

  _emptySubjectGrades(floating, subject = {}) {
    return {
      subjectId: subject.subjectId ?? subject.id ?? null,
      yearSubjectId: subject.yearSubjectId ?? null,
      minimumGrade: subject.minimumGrade ?? 10,
      floating,
      avg: 0,
      terms: floating
        ? Array.from({ length: 4 }, () => [0])
        : [
            ...Array.from(
              { length: 3 },
              () => Array(GRADE_SLOTS_PER_TERM).fill(0)
            ),
            [0],
          ],
      termAverages: Array(4).fill(0),
    };
  }

  calculateSubjectAverages(subject) {
    const floating = Boolean(subject.floating);
    const termAverages = subject.terms.map((term) => {
      const total = term.reduce(
        (sum, value) => sum + (toNumberOrNull(value) ?? 0),
        0
      );
      return Math.round(total / term.length);
    });
    const avg = floating ? Math.max(...termAverages) : Math.round(
      termAverages.slice(0, 3).reduce((sum, value) => sum + value, 0) / 3
    );

    return { ...subject, avg, termAverages };
  }

  calculateStatus(grades) {
    const subjects = Object.entries(grades).map(([rawSubjectId, subject]) => {
      const floating = Boolean(subject.floating);
      const score = floating
        ? Math.max(...subject.termAverages)
        : Math.max(subject.avg, subject.termAverages[REVISION_TERM - 1]);
      return {
        subjectId: subject.subjectId ?? Number(rawSubjectId),
        yearSubjectId: subject.yearSubjectId,
        minimumGrade: subject.minimumGrade,
        score,
        status: score >= subject.minimumGrade ? "passed" : "failed",
      };
    });
    const floating = Object.values(grades).some(({ floating }) => floating);
    const failedCount = subjects.filter(
      ({ status }) => status === "failed"
    ).length;
    const status = floating
      ? failedCount === 0
        ? "passed"
        : "failed"
      : failedCount === 0
        ? "passed"
        : failedCount <= 2
          ? "pending"
          : "failed";

    return { status, subjects };
  }

  _parseGradeRows(
    studentRows,
    gradeRows,
    subjectsByYear = {},
    subjectMetadata = []
  ) {
    const students = new Map();
    const metadataById = new Map(
      subjectMetadata.map((subject) => [String(subject.id), subject])
    );

    for (const student of studentRows) {
      const key = this._enrollmentKey(
        student.id,
        student.periodId,
        student.yearId
      );
      const floating = String(student.className) === "z";
      const assignedSubjects = floating
        ? student.pendingSubjects || []
        : student.subjectAssignments ||
          (subjectsByYear[student.yearId] || []).map((subjectId) => ({
            ...metadataById.get(String(subjectId)),
            subjectId,
          }));
      students.set(key, {
        id: student.id,
        yearId: student.yearId,
        period: student.periodStartYear,
        periodId: student.periodId,
        fullName: `${student.lastName} ${student.firstName}`,
        status: student.status,
        classId: student.classId ?? student.classDatabaseId,
        className: student.className,
        class: `${student.yearName || student.yearId} ${student.className}`,
        floating,
        grades: Object.fromEntries(
          assignedSubjects.map((subject) => {
            const subjectId = subject.subjectId ?? subject.id;
            return [
              String(subjectId),
              this._emptySubjectGrades(floating, {
                ...subject,
                subjectId,
              }),
            ];
          })
        ),
      });
    }

    for (const rawGrade of gradeRows) {
      let student = students.get(
        this._enrollmentKey(
          rawGrade.studentId,
          rawGrade.periodId,
          rawGrade.yearId
        )
      );
      if (!student && rawGrade.yearId === undefined) {
        const matches = Array.from(students.values()).filter(
          (candidate) =>
            String(candidate.id) === String(rawGrade.studentId) &&
            String(candidate.periodId) === String(rawGrade.periodId)
        );
        student = matches.length === 1 ? matches[0] : null;
      }
      if (!student) continue;

      const subjectId = String(rawGrade.subjectId);
      if (!student.grades[subjectId]) {
        const metadata = metadataById.get(subjectId) || {};
        student.grades[subjectId] = this._emptySubjectGrades(
          student.floating,
          {
            ...metadata,
            subjectId: rawGrade.subjectId,
            yearSubjectId: rawGrade.yearSubjectId,
          }
        );
      }

      const subjectGrades = student.grades[subjectId];
      subjectGrades.yearSubjectId ??= rawGrade.yearSubjectId;
      const termIndex = Number(rawGrade.term) - 1;
      const strategyIndex = Number(rawGrade.strategy) - 1;
      if (
        subjectGrades.terms[termIndex] &&
        strategyIndex >= 0 &&
        strategyIndex < subjectGrades.terms[termIndex].length
      ) {
        subjectGrades.terms[termIndex][strategyIndex] =
          toNumberOrNull(rawGrade.value);
      }
    }

    return Array.from(students.values()).map((student) => {
      student.grades = Object.fromEntries(
        Object.entries(student.grades).map(([subjectId, subject]) => [
          subjectId,
          this.calculateSubjectAverages(subject),
        ])
      );
      return {
        ...student,
        subjectAverages: Object.fromEntries(
          Object.entries(student.grades).map(([subjectId, details]) => [
            subjectId,
            details.avg,
          ])
        ),
        subjectDetails: student.grades,
      };
    });
  }

  getGrades(periodId, filters = {}) {
    if (periodId !== "all" && !this.periodRepository.findById(periodId)) {
      throw new Error("Periodo Escolar no registrado");
    }

    const sanitizedFilters = {
      yearId: normalizeQueryValues(filters.yearId),
      className: normalizeQueryValues(filters.classId),
      status: normalizeQueryValues(filters.status),
      q: normalizeQueryValues(filters.q),
    };
    const pagination = sanitizePagination(filters);
    const { rows: rawStudentRows, recordsAmount } =
      this.studentRepository.findAllByPeriod(periodId, {
        filters: sanitizedFilters,
        pagination,
        includeGuardians: false,
      });
    const studentIds = [...new Set(rawStudentRows.map(({ id }) => id))];
    const pendingSubjects =
      this.studentRepository.findAllPendingSubjectsByStudents(
        periodId,
        studentIds
      );
    const studentRows = this._attachPendingSubjects(
      rawStudentRows,
      pendingSubjects
    );
    const gradeRows = this.subjectRepository.findAllGradesByStudents(
      periodId,
      studentIds
    );
    const filterData = this.periodService.getPeriodFilterData(periodId, {
      includeSubjects: true,
    });

    return {
      rows: this._parseGradeRows(
        studentRows,
        gradeRows,
        filterData.subjectsByYear,
        filterData.subjects
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

  loadGrades(periodId, grades) {
    if (!Array.isArray(grades)) return { loaded: 0, skipped: 0 };
    if (!this.periodRepository.findById(periodId)) {
      throw new Error("Periodo Escolar no registrado");
    }

    return this.subjectRepository.db.transaction(() => {
      const studentIds = [
        ...new Set(grades.map(({ id }) => id).filter(Boolean).map(String)),
      ];
      if (studentIds.length === 0) {
        return { loaded: 0, skipped: grades.length };
      }
      const { rows: rawStudentRows } =
        this.studentRepository.findAllByPeriod(periodId, {
          filters: { exactIds: studentIds },
          includeGuardians: false,
        });
      const assignmentRows =
        this.subjectRepository.findAllAssignmentsByPeriod(periodId);
      const assignmentsByYear = this._groupByYear(assignmentRows);
      const pendingSubjects =
        this.studentRepository.findAllPendingSubjectsByStudents(
          periodId,
          studentIds
        );
      const students = this._attachPendingSubjects(
        rawStudentRows,
        pendingSubjects
      ).map((student) => ({
        ...student,
        subjectAssignments: assignmentsByYear[student.yearId] || [],
      }));
      const studentsById = new Map();
      for (const student of students) {
        if (!studentsById.has(student.id)) studentsById.set(student.id, []);
        studentsById.get(student.id).push(student);
      }

      const pendingGrades = [];
      let skipped = 0;
      for (const entry of grades) {
        const enrollments = studentsById.get(entry?.id) || [];
        const candidates = entry?.yearId === undefined
          ? enrollments
          : enrollments.filter(
              ({ yearId }) => Number(yearId) === Number(entry.yearId)
            );
        const student = candidates.length === 1 ? candidates[0] : null;
        if (!student || !entry?.subjects || typeof entry.subjects !== "object") {
          skipped++;
          continue;
        }

        const assignments = student.floating
          ? student.pendingSubjects
          : student.subjectAssignments;
        const assignmentsBySubject = new Map(
          assignments.map((subject) => [String(subject.subjectId), subject])
        );

        for (const [rawSubjectId, terms] of Object.entries(entry.subjects)) {
          const assignment = assignmentsBySubject.get(String(rawSubjectId));
          if (!assignment || !Array.isArray(terms)) continue;

          terms.slice(0, 4).forEach((termGrades, termIndex) => {
            if (!Array.isArray(termGrades)) return;
            const term = termIndex + 1;
            const maxStrategies = student.floating || term === REVISION_TERM
              ? 1
              : GRADE_SLOTS_PER_TERM;

            termGrades.slice(0, maxStrategies).forEach(
              (rawGrade, strategyIndex) => {
                const isObject =
                  rawGrade &&
                  typeof rawGrade === "object" &&
                  !Array.isArray(rawGrade);
                const strategy =
                  (isObject && Number(rawGrade.strategy)) || strategyIndex + 1;
                if (strategy < 1 || strategy > maxStrategies || rawGrade === null) return;

                pendingGrades.push(
                  new Grade(
                    isObject ? rawGrade.id : null,
                    term,
                    toNumberOrNull(isObject ? rawGrade.value : rawGrade),
                    strategy,
                    student.id,
                    assignment.yearSubjectId
                  )
                );
              }
            );
          });
        }
      }

      this.subjectRepository.upsertGrades(pendingGrades);
      const gradeRows = this.subjectRepository.findAllGradesByStudents(
        periodId,
        studentIds
      );
      const parsedStudents = this._parseGradeRows(
        students,
        gradeRows,
        {},
        assignmentRows
      );

      for (const student of parsedStudents) {
        const result = this.calculateStatus(student.grades);
        this.studentRepository.updateClassStatus(
          student.id,
          student.classId,
          result.status
        );
        if (student.floating) {
          for (const subject of result.subjects) {
            this.studentRepository.updatePendingSubject(
              subject.yearSubjectId,
              student.id,
              subject.status
            );
          }
        }
      }

      return { loaded: grades.length - skipped, skipped };
    });
  }
}

export default new GradeService(
  SubjectRepository,
  PeriodRepository,
  StudentRepository,
  PeriodService
);
