import SubjectRepository from "../repositories/SubjectRepository.js";
import PeriodRepository from "../repositories/PeriodRepository.js";
import PeriodService from "./PeriodService.js";

class SubjectService {
  constructor(subjectRepository, periodRepository, periodService) {
    this.subjectRepository = subjectRepository;
    this.periodRepository = periodRepository;
    this.periodService = periodService;
  }

  getSubjects() {
    return this.subjectRepository.findAll();
  }

  getSubjectById(id) {
    const subject = this.subjectRepository.findById(id);
    if (!subject) throw new Error("Materia no registrada");
    return subject;
  }

  getSubjectSuggestions() {
    const sourcePeriod = this.periodRepository
      .findAll()
      .find((period) => period.status === "archived");
    if (!sourcePeriod) return {};

    const { subjectsByYear } = this.periodService.getPeriodFilterData(
      sourcePeriod.id,
      { includeSubjects: true }
    );
    return {subjectsByYear};
  }
}

export default new SubjectService(
  SubjectRepository,
  PeriodRepository,
  PeriodService
);
