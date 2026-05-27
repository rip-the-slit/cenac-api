import GradeService from "../services/GradeService.js";

class GradeController {
  constructor(gradeService) {
    this.gradeService = gradeService;
  }

  getGrades(req, res) {
    try {
      const { periodId, yearId, classId, status, q } = req.query;
      if (!periodId) return res.status(400).json({ error: "periodId es requerido" });
      const data = this.gradeService.getGrades(periodId, { yearId, classId, status, q });
      res.json(data);
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  }

  loadGrades(req, res) {
    try {
      const { periodId, grades } = req.body;
      if (!periodId) return res.status(400).json({ error: "periodId es requerido" });
      if (!Array.isArray(grades)) return res.status(400).json({ error: "grades debe ser un arreglo" });
      const data = this.gradeService.loadGrades(periodId, grades);
      res.json(data);
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  }
}

export default new GradeController(GradeService);