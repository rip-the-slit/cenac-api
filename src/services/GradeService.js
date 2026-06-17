import SubjectRepository from "../repositories/SubjectRepository.js";
import PeriodRepository from "../repositories/PeriodRepository.js";
import YearRepository from "../repositories/YearRepository.js";
import StudentRepository from "../repositories/StudentRepository.js";
import { Grade } from "../models/index.js";

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
    studentRepository
  ) {
    this.subjectRepository = subjectRepository;
    this.periodRepository = periodRepository;
    this.yearRepository = yearRepository;
    this.studentRepository = studentRepository;
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

  // Builds [{ studentId, yearId, classId, firstName, lastName }] for a period
  _getStudentsWithMeta(periodId) {
    const yearPeriods = this.periodRepository.findAllAssignedYears(periodId);
    const rows = [];
    for (const yp of yearPeriods) {
      const classes = this.yearRepository.findAllAssignedClasses(yp.id);
      for (const cls of classes) {
        const students = this.studentRepository.findAllByClass(cls.id);
        for (const s of students) {
          rows.push({
            id: s.id,
            firstName: s.firstName,
            lastName: s.lastName,
            status: s.status,
            classId: cls.name,
            yearId: yp.yearId,
          });
        }
      }
    }
    return rows;
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

  // GET /grades?periodId&yearId&classId&subjectId&q
  // Mirrors getGrades() in db.js
  getGrades(periodId, { yearId, classId, status, q } = {}) {
    const period = this.periodRepository.findById(periodId);
    if (!period) throw new Error("Periodo Escolar no registrado");

    const subjectsPerYear = this._getSubjectsPerYear(periodId);
    const studentsMeta = this._getStudentsWithMeta(periodId);
    const yearSubjectMap = this._getYearSubjectMap(periodId);

    const allYears = this.yearRepository.findAll();
    const yearsById = new Map(allYears.map((y) => [y.id, y]));

    const allSubjects = this.subjectRepository.findAll();
    const subjectsById = Object.fromEntries(
      allSubjects.map((s) => [String(s.id), s])
    );

    const normalize = (v) =>
      String(v ?? "")
        .toLowerCase()
        .trim();
    const query = normalize(q);
    const rows = [];

    for (const student of studentsMeta) {
      // Apply yearId / classId filters early
      if (yearId && String(student.yearId) !== String(yearId)) continue;
      if (classId && String(student.classId) !== String(classId)) continue;
      if (status && student.status !== status) continue;

      // Apply text search filter
      if (
        query &&
        !(
          normalize(`${student.firstName} ${student.lastName}`).includes(
            query
          ) || String(student.id).includes(query)
        )
      ) {
        continue;
      }

      const allowedSubjects = new Set(
        subjectsPerYear[String(student.yearId)] || []
      );

      // Build bySubject: { subjectId: { avg, terms, lapsoAverages } }
      const bySubject = {};

      for (const sKey of allowedSubjects) {
        const yearSubjectId = yearSubjectMap.get(`${student.yearId}-${sKey}`);
        if (!yearSubjectId) continue;

        const gradeRows = this.subjectRepository.findAllGradesByStudent(
          yearSubjectId,
          student.id
        );

        if (!gradeRows.length) continue;

        const terms = Array.from({ length: 3 }, () => Array(4).fill(null));
        for (const row of gradeRows) {
          const term = Number(row.term) - 1;
          const strategy = Number(row.strategy) - 1;
          const value = toNumberOrNull(row.value);
          if (!terms[term] || strategy < 0 || strategy >= terms[term].length) {
            continue;
          }
          terms[term][strategy] = value;
        }

        const termAverages = terms.map((grades) => {
          const safe = grades.filter(Number.isFinite);
          return safe.length
            ? safe.reduce((a, b) => a + b, 0) / safe.length
            : null;
        });

        const avg = this.subjectRepository.getGradeAvgByStudent(
          yearSubjectId,
          student.id
        );

        bySubject[sKey] = { avg, terms, termAverages };
      }

      const year = yearsById.get(student.yearId);
      rows.push({
        id: student.id,
        fullName: `${student.firstName} ${student.lastName}`,
        status: student.status,
        class: `${year?.name || student.yearId} ${student.classId}`,
        grades: bySubject,
        subjectAverages: Object.fromEntries(
          Object.entries(bySubject).map(([k, v]) => [k, v.avg])
        ),
        subjectDetails: bySubject,
      });
    }

    // Subjects present in any year of this period
    const periodSubjectIds = new Set(
      Object.values(subjectsPerYear).flat().map(String)
    );
    const filteredSubjects = allSubjects.filter((s) =>
      periodSubjectIds.has(String(s.id))
    );

    // classesByYear
    const classesByYear = Object.fromEntries(allYears.map((y) => [y.id, []]));
    for (const s of studentsMeta) {
      if (!classesByYear[s.yearId]) classesByYear[s.yearId] = [];
      if (!classesByYear[s.yearId].includes(s.classId)) {
        classesByYear[s.yearId].push(s.classId);
      }
    }
    Object.values(classesByYear).forEach((list) => list.sort());

    return {
      rows,
      studentGradesFieldLabels: {
        id: "Cédula",
        fullName: "Nombre Completo",
        status: "Estatus",
        class: "Sección",
        grades: "Notas",
      },
      subjects: filteredSubjects,
      years: allYears,
      classesByYear,
      subjectsById,
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
  StudentRepository
);
