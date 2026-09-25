import ReportService from "../services/ReportService.js";

const WORD_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

class ReportController {
  constructor(reportService) {
    this.reportService = reportService;
  }

  getReportOptionData(req, res) {
    try {
      res.json(this.reportService.getReportOptionData());
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  }

  async generateGradesReport(req, res) {
    try {
      const { periodId, q, terms, preview } = req.query;
      if (!periodId) {
        return res.status(400).json({ error: "El identificador del periodo es requerido" });
      }

      const buffer = await this.reportService.generateGradesReport(
        periodId,
        q,
        terms,
        preview === "true"
      );
      res.setHeader("Content-Type", WORD_MIME);
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="grades-report.docx"'
      );
      res.end(buffer);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  }
}

export default new ReportController(ReportService);
