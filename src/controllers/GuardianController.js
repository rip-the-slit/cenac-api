import GuardianService from "../services/GuardianService.js";

class GuardianController {
  constructor(guardianService) {
    this.guardianService = guardianService;
  }

  getGuardians(req, res) {
    try {
      const { periodId = "all", ...filters } = req.query;
      res.json(this.guardianService.getGuardians(periodId, filters));
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  }

  getGuardianById(req, res) {
    try {
      res.json(
        this.guardianService.getGuardianById(
          req.params.id,
          req.query.periodId ?? "all"
        )
      );
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  }

  createGuardian(req, res) {
    try {
      res.status(201).json(this.guardianService.createGuardian(req.body));
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  }

  updateGuardian(req, res) {
    try {
      res.json(
        this.guardianService.updateGuardian(req.params.id, req.body)
      );
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  }
}

export default new GuardianController(GuardianService);
