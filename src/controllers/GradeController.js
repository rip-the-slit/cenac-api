import GradeService from "../services/GradeService.js";

class GradeController {
  constructor(gradeService) {
    this.gradeService = gradeService;
  }

  getGrades(req, res) {
    try {
      const { periodId } = req.query;
      if (!periodId) return res.status(400).json({ error: "El identificador del periodo es requerido" });
      const data = this.gradeService.getGrades(periodId, req.query);
      res.json(data);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  }

  loadGrades(req, res) {
    try {
      const { periodId, grades } = req.body;
      if (!periodId) return res.status(400).json({ error: "El identificador del periodo es requerido" });
      if (!Array.isArray(grades)) return res.status(400).json({ error: "Las calificaciones deben ser un arreglo" });
      const data = this.gradeService.loadGrades(periodId, grades);
      res.json(data);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  }
}

export default new GradeController(GradeService);
