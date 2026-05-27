import SubjectService from "../services/SubjectService.js";

class SubjectController {
  constructor(subjectService) {
    this.subjectService = subjectService;
  }

  getSubjects(req, res) {
    try {
      const data = this.subjectService.getSubjects();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
}

export default new SubjectController(SubjectService);