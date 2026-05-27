import YearRepository from "../repositories/YearRepository.js";

class YearService {
  constructor(yearRepository) {
    this.yearRepository = yearRepository;
  }

  getYears() {
    return this.yearRepository.findAll();
  }

  getYearById(id) {
    const year = this.yearRepository.findById(id);
    if (!year) throw new Error("Año no registrado");
    return year;
  }
}

export default new YearService(YearRepository);