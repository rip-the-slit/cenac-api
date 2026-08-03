import PeriodService from "../services/PeriodService.js";
import StudentService from "../services/StudentService.js";

class PeriodController {
  constructor(periodService, studentService) {
    this.periodService = periodService;
    this.studentService = studentService;
  }

  getPeriodStats(req, res) {
    try {
      const data = this.periodService.getPeriodById(req.params.id);
      res.json(data);
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  }

  getPeriodList(req, res) {
    try {
      const data = this.periodService.getPeriodList();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  getPeriodStats(req, res) {
    try {
      const data = this.periodService.getPeriodStats(req.params.id);
      res.json(data);
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  }

  getClassesByYear(req, res) {
    try {
      const data = this.studentService.getClassesByYear(req.params.id);
      res.json(data);
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  }

  getStudentsByPeriod(req, res) {
    try {
      const { id, firstName, lastName, dateOfBirth, birthPlace, year } = req.query;
      // express uses the param name as-is; frontend sends "class"
      const classId = req.query.class;
      const data = this.studentService.getStudentsByPeriod(req.params.id, {
        id,
        firstName,
        lastName,
        dateOfBirth,
        birthPlace,
        year,
        classId,
      });
      res.json(data);
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  }

  getStudentById(req, res) {
    try {
      const data = this.studentService.getStudentById(req.params.id, req.params.studentId);
      res.json(data);
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  }

  addPeriod(req, res) {
    try {
      const period = req.body
      if (typeof period !== "object") {
        return res.status(400).json({ error: "body debe ser un objeto" });
      }
      const data = this.periodService.addPeriod(period);
      res.status(201).json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  loadPeriodData(req, res) {
    try {
      const { students, subjects } = req.body;
      if (!Array.isArray(students) || typeof subjects !== "object") {
        return res.status(400).json({ error: "students y subjects son requeridos" });
      }
      const data = this.periodService.loadPeriodData(req.params.id, students, subjects);
      res.json(data);
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  }

  getClassSuggestions(req, res) {
    try {
      const data = this.studentService.getClassSuggestions();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
}

export default new PeriodController(PeriodService, StudentService);