import PeriodRepository from "../repositories/PeriodRepository.js";
import YearRepository from "../repositories/YearRepository.js";
import StudentRepository from "../repositories/StudentRepository.js";
import { Period } from "../models/index.js";

const studentFieldLabels = {
  id: "Cédula",
  firstName: "Nombres",
  lastName: "Apellidos",
  birthDate: "Fecha de Nacimiento",
  birthPlace: "Lugar de Nacimiento",
};

class StudentService {
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

  // GET /periods/:id/classes -> getClassesByYear(periodId)
  // Returns { [yearId]: className[] }
  getClassesByYear(periodId) {
    const period = this.periodRepository.findById(periodId);
    this.isPeriod(period);

    const years = this.yearRepository.findAll();
    const yearPeriod = this.periodRepository.findAllAssignedYears(periodId);

    const result = Object.fromEntries(years.map((y) => [y.id, []]));

    for (const yp of yearPeriod) {
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
    this.isPeriod(period);

    const normalize = (v) =>
      String(v ?? "")
        .toLowerCase()
        .trim();

    const f = {
      id: normalize(filters.id),
      firstName: normalize(filters.firstName),
      lastName: normalize(filters.lastName),
      dateOfBirth: normalize(filters.dateOfBirth),
      birthPlace: normalize(filters.birthPlace),
      year: normalize(filters.year),
      classId: normalize(filters.classId),
      className: normalize(filters.className),
    };

    const yearPeriod = this.periodRepository.findAllAssignedYears(periodId);
    const rows = [];

    for (const yp of yearPeriod) {
      if (f.year && String(yp.yearId) !== f.year) continue;

      const classes = this.yearRepository.findAllAssignedClasses(yp.id);

      for (const cls of classes) {
        if (f.classId && String(cls.id) !== f.classId) continue;

        const classStudents = this.studentRepository.findAllByClass(cls.id);

        for (const student of classStudents) {
          if (f.id && !String(student.id).includes(f.id)) continue;
          if (
            f.firstName &&
            !normalize(student.firstName).includes(f.firstName)
          )
            continue;
          if (f.lastName && !normalize(student.lastName).includes(f.lastName))
            continue;
          if (
            f.dateOfBirth &&
            !normalize(student.birthDate).includes(f.dateOfBirth)
          )
            continue;
          if (
            f.birthPlace &&
            !normalize(student.birthPlace).includes(f.birthPlace)
          )
            continue;

          rows.push({
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            birthDate: student.birthDate,
            birthPlace: student.birthPlace,
            status: student.status,
            _class: { id: cls.name, year: yp.yearId },
          });
        }
      }
    }

    return {
      rows,
      years: this.yearRepository.findAll(),
      classesByYear: this.getClassesByYear(periodId),
      studentFieldLabels,
    };
  }

  getStudentById(periodId, studentId) {
    const period = this.periodRepository.findById(periodId);
    this.isPeriod(period);

    const student = this.studentRepository.findById(studentId);
    if (!student) throw new Error("Estudiante no registrado");

    return {
      student,
      studentFieldLabels,
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
  StudentRepository
);
