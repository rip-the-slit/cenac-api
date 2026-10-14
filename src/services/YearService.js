import YearRepository from "../repositories/YearRepository.js";
import PeriodRepository from "../repositories/PeriodRepository.js";

class YearService {
  constructor(yearRepository, periodRepository) {
    this.yearRepository = yearRepository;
    this.periodRepository = periodRepository;
  }

  getYears() {
    return this.yearRepository.findAll();
  }

  getYearById(id) {
    const year = this.yearRepository.findById(id);
    if (!year) throw new Error("Año no registrado");
    return year;
  }

  getClassesByYear(periodId) {
    const isAllPeriods = periodId === "all";
    if (!isAllPeriods && !this.periodRepository.findById(periodId)) {
      throw new Error("Periodo Escolar no registrado");
    }
    const yearIds = isAllPeriods
      ? this.yearRepository.findAll().map((year) => year.id)
      : this.periodRepository.findAllAssignedYears(periodId)
          .map((year) => year.yearId);
    const classesByYear = Object.fromEntries(yearIds.map((id) => [id, []]));
    const classes = this.yearRepository.findAllAssignedClassesByPeriod(periodId);
    const classesByYearPeriod = new Map();

    for (const assignedClass of classes) {
      const key = `${assignedClass.yearId}-${assignedClass.periodId}`;
      if (!classesByYearPeriod.has(key)) {
        classesByYearPeriod.set(key, {
          yearId: assignedClass.yearId,
          rows: [],
        });
      }
      const rows = classesByYearPeriod.get(key).rows;
      if (!rows.some((row) => row.name === assignedClass.name)) {
        rows.push(assignedClass);
      }
    }

    for (const { yearId, rows } of classesByYearPeriod.values()) {
      if (rows.length > classesByYear[yearId].length) {
        classesByYear[yearId] = rows;
      }
    }
    return classesByYear;
  }
}

export default new YearService(YearRepository, PeriodRepository);
