import PeriodRepository from "../repositories/PeriodRepository.js";
import YearRepository from "../repositories/YearRepository.js";
import StudentRepository from "../repositories/StudentRepository.js";
import { Class, Student } from "../models/index.js";

class PeriodService {
  constructor(periodRepository, yearRepository, studentRepository) {
    this.periodRepository = periodRepository;
    this.yearRepository = yearRepository;
    this.studentRepository = studentRepository;
  }

  // GET /periods → getPeriodList() returns string[]
  getPeriodList() {
    return this.periodRepository.findAll().map((p) => p.id);
  }

  getPeriodStats(id) {
    const period = this.periodRepository.findById(id);
    if (!period) {
      throw new Error("Periodo Escolar no registrado");
    }

    const gradeCount = this.periodRepository.getGradeCount(id);
    const loaded = gradeCount.find((g) => g.loaded === 1)?.count || 0;
    const notLoaded = gradeCount.find((g) => g.loaded === 0)?.count || 0;

    const studentCount = this.periodRepository.getStudentCount(id);
    const total = studentCount.reduce((t, c) => t + c.count, 0);
    const approved =
      studentCount.find((c) => c.status === "approved")?.count || 0;

    period.stats =
      period.status === "new"
        ? null
        : {
            grades: { total: loaded + notLoaded, loaded },
            students: { total, approved },
          };

    return period;
  }

  // GET /periods/:id/classes → getClassesByYear(periodId)
  // Returns { [yearId]: className[] }
  getClassesByYear(periodId) {
    const period = this.periodRepository.findById(periodId);
    if (!period) throw new Error("Periodo Escolar no registrado");

    const years = this.yearRepository.findAll();
    const yearPeriods = this.periodRepository.findAllAssignedYears(periodId);

    const result = Object.fromEntries(years.map((y) => [y.id, []]));

    for (const yp of yearPeriods) {
      const classes = this.yearRepository.findAllAssignedClasses(yp.id);
      if (!result[yp.yearId]) result[yp.yearId] = [];
      for (const cls of classes) {
        if (!result[yp.yearId].includes(cls.id)) {
          result[yp.yearId].push(cls.name);
        }
      }
    }

    Object.values(result).forEach((list) => list.sort());
    return result;
  }

  getStudentsByPeriod(periodId, filters = {}) {
    const period = this.periodRepository.findById(periodId);
    if (!period) throw new Error("Periodo Escolar no registrado");

    const normalize = (v) => String(v ?? "").toLowerCase().trim();

    const f = {
      id:          normalize(filters.id),
      firstName:   normalize(filters.firstName),
      lastName:    normalize(filters.lastName),
      dateOfBirth: normalize(filters.dateOfBirth),
      birthPlace:  normalize(filters.birthPlace),
      year:        normalize(filters.year),
      className:     normalize(filters.className),
    };

    const yearPeriods = this.periodRepository.findAllAssignedYears(periodId);
    const rows = [];

    for (const yp of yearPeriods) {
      if (f.year && String(yp.yearId) !== f.year) continue;

      const classes = this.yearRepository.findAllAssignedClasses(yp.id);

      for (const cls of classes) {
        if (f.classId && cls.id !== f.classId) continue;

        const classStudents = this.studentRepository.findAllByClass(cls.id);

        for (const student of classStudents) {
          if (f.id          && !String(student.id).includes(f.id))                          continue;
          if (f.firstName   && !normalize(student.firstName).includes(f.firstName))          continue;
          if (f.lastName    && !normalize(student.lastName).includes(f.lastName))            continue;
          if (f.dateOfBirth && !normalize(student.birthDate).includes(f.dateOfBirth))        continue;
          if (f.birthPlace  && !normalize(student.birthPlace).includes(f.birthPlace))        continue;

          rows.push({
            id:         student.id,
            firstName:  student.firstName,
            lastName:   student.lastName,
            birthDate:  student.birthDate,
            birthPlace: student.birthPlace,
            status:     student.status,
            _class: { id: cls.name, year: yp.yearId },
          });
        }
      }
    }

    return {rows, years: this.yearRepository.findAll(), classesByYear: this.getClassesByYear(periodId), studentFieldLabels: {
      id: "Cédula",
      firstName: "Nombres",
      lastName: "Apellidos",
      birthDate: "Fecha de Nacimiento",
      birthPlace: "Lugar de Nacimiento",
    }};
  }

  getStudentById(periodId, studentId) {
    const period = this.periodRepository.findById(periodId);
    if (!period) throw new Error("Periodo Escolar no registrado");

    const student = this.studentRepository.findById(studentId);
    if (!student) throw new Error("Estudiante no registrado");

    return {student, studentFieldLabels: {
      id: "Cédula",
      firstName: "Nombres",
      lastName: "Apellidos",
      birthDate: "Fecha de Nacimiento",
      birthPlace: "Lugar de Nacimiento",
    }};
  }

  // POST /periods/:id/load → loadPeriodData(periodId, students, subjectsPerYear)
  // students: array of student objects with _class: { id, year }
  // subjectsPerYear: { [yearId]: subjectId[] }
  // Only populates if the period has no students yet (mirrors frontend guard)
  loadPeriodData(periodId, students, subjectsPerYear) {
    const period = this.periodRepository.findById(periodId);
    if (!period) throw new Error("Periodo Escolar no registrado");

    if (period.status !== "new") {
      return { loaded: false, reason: "already_loaded" };
    }

    const studentsToLoad = Array.isArray(students) ? students : [];
    const subjectsByYear =
      subjectsPerYear && typeof subjectsPerYear === "object"
        ? subjectsPerYear
        : {};

    const yearPeriodMap = new Map()
    const classMap = new Map()

    for (const year of this.yearRepository.findAll()) {
      if (!subjectsByYear[year.id]) {
        continue;
      }

      const yearPeriod = this.periodRepository.assignYear(year.id, period.id)

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
        existingClass = this.yearRepository.assignClass(new Class(null, className, null, null, null, yp.id));
        classMap.set(`${yp.id}-${className}`, existingClass)
      }

      this.studentRepository.assignToClass(student.id, existingClass.id, "Reprobado")
    }

    this.periodRepository.update(periodId, { ...period, status: "loaded" });

    return { loaded: true };
  }

  getClassSuggestions() {
    const allYears = this.yearRepository.findAll();
    // findAll returns years ordered by id ASC; find the max year id
    const maxYearId = Math.max(...allYears.map((y) => Number(y.id)));

    // periods are returned ordered by start_year DESC, so the first one
    // that actually has students is the most recent loaded period
    const periods = this.periodRepository.findAll();
    let sourcePeriod = null;

    for (const period of periods) {
      const yearPeriods = this.periodRepository.findAllAssignedYears(period.id);
      let hasStudents = false;
      for (const yp of yearPeriods) {
        const classes = this.yearRepository.findAllAssignedClasses(yp.id);
        for (const cls of classes) {
          const s = this.studentRepository.findAllByClass(cls.id);
          if (s.length > 0) {
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
      const yearPeriods = this.periodRepository.findAllAssignedYears(
        sourcePeriod.id
      );
      for (const yp of yearPeriods) {
        const currentYearId = Number(yp.yearId);

        // Students in the final year have graduated — exclude them
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

export default new PeriodService(
  PeriodRepository,
  YearRepository,
  StudentRepository
);
