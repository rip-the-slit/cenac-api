import SubjectRepository from "../repositories/SubjectRepository.js";

class SubjectService {
  constructor(subjectRepository) {
    this.subjectRepository = subjectRepository;
  }

  getSubjects() {
    return this.subjectRepository.findAll();
  }

  getSubjectById(id) {
    const subject = this.subjectRepository.findById(id);
    if (!subject) throw new Error("Materia no registrada");
    return subject;
  }
}

export default new SubjectService(SubjectRepository);