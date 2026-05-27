import YearService from "../services/YearService.js";

class YearController {
  constructor(yearService) {
    this.yearService = yearService;
  }

  getYears(req, res) {
    try {
      const data = this.yearService.getYears();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
}

export default new YearController(YearService);