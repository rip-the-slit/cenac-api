import ReportService from "../../../src/services/ReportService";
import docx from "docx";
const { Document, Packer } = docx;
import JSZip from "jszip";

describe("ReportService", () => {
  const gradeRecord = {
    id: "V-10000001",
    period: 2090,
    fullName: "Alonso Ana",
    status: "passed",
    class: "1er Año A",
    subjectAverages: { 1: 17 },
    subjectDetails: {
      1: {
        avg: 17,
        terms: [
          [18, 16, null, null, null],
          [null, null, null, null, null],
          [null, null, null, null, null],
          [20],
        ],
        termAverages: [17, null, null, 20],
      },
    },
  };
  const subjects = [{ id: 1, name: "Matemáticas" }];
  const years = [{ id: 1, name: "1er Año" }];
  const reportDate = "31/08/2026";

  const renderSectionXml = async (section) => {
    const document = new Document({ sections: [section] });
    const archive = await JSZip.loadAsync(await Packer.toBuffer(document));
    return archive.file("word/document.xml").async("string");
  };

  test("returns the available report options", () => {
    expect(ReportService.getReportOptionData()).toMatchObject({
      fields: { q: { label: "Buscar estudiante", type: "text" } },
      years: expect.any(Array),
      classesByYear: expect.any(Object),
      statuses: expect.any(Array),
      reportTypes: [
        {
          value: "grades",
          name: "Boletin",
          options: [
            {
              value: "terms",
              name: "Lapsos",
              options: [
                { value: "all", name: "Todos los lapsos" },
                { value: "1", name: "1er Lapso" },
                { value: "2", name: "2do Lapso" },
                { value: "3", name: "3er Lapso" },
              ],
            },
          ],
        },
      ],
    });
  });

  test("builds the landscape all-lapso bulletin layout", async () => {
    const section = ReportService._buildGradesReport(
      gradeRecord,
      "all",
      subjects,
      years,
      reportDate
    );
    const xml = await renderSectionXml(section);

    expect(section.properties.page.size.orientation).toBe("landscape");
    expect(xml).toContain("BOLETÍN INFORMATIVO");
    expect(xml).toContain("1ER LAPSO");
    expect(xml).toContain("2DO LAPSO");
    expect(xml).toContain("3ER LAPSO");
    expect(xml).toContain("Matemáticas");
    expect(xml).toContain("31/08/2026");
    expect(xml).toContain("MATERIAS PENDIENTES");
    expect(xml).toContain("Materia pendiente");
    expect(xml).toContain("M1");
    expect(xml).toContain("M4");
  });

  test("builds five strategy columns for a selected lapso", async () => {
    const section = ReportService._buildGradesReport(
      gradeRecord,
      "1",
      subjects,
      years,
      reportDate
    );
    const xml = await renderSectionXml(section);

    expect(xml).toContain("1ER LAPSO");
    expect(xml).toContain("Estrategia 1");
    expect(xml).toContain("Estrategia 5");
    expect(xml).toContain("Definitiva");
    expect(xml).not.toContain("2DO LAPSO");
    expect(xml).not.toContain("MATERIAS PENDIENTES");
  });

  test("merges floating grades into one regular report record", () => {
    const rows = ReportService._mergeFloatingEnrollments([
      { ...gradeRecord, periodId: "2090", className: "A" },
      {
        ...gradeRecord,
        periodId: "2090",
        className: "z",
        floating: true,
        subjectDetails: { 2: { termAverages: [8, 10, null, 12] } },
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      className: "A",
      pendingSubjectDetails: {
        2: { termAverages: [8, 10, null, 12] },
      },
    });
  });

  test("limits grade retrieval to five rows for previews", async () => {
    const original = ReportService.gradeService.getGrades;
    let receivedFilters;
    ReportService.gradeService.getGrades = (_periodId, filters) => {
      receivedFilters = filters;
      return { rows: [], subjects: [], years: [] };
    };

    try {
      await ReportService.generateGradesReport("2090", "ana", "all", true);
      expect(receivedFilters).toEqual({ q: ["ana"], page: 1, limit: 5 });
    } finally {
      ReportService.gradeService.getGrades = original;
    }
  });

  test("splits report q on commas and forwards the remaining filters", async () => {
    const original = ReportService.gradeService.getGrades;
    let receivedFilters;
    ReportService.gradeService.getGrades = (_periodId, filters) => {
      receivedFilters = filters;
      return { rows: [], subjects: [], years: [] };
    };
    try {
      await ReportService.generateGradesReport(
        "2090", " V-1, , E-2 ", "2", false,
        { year: "1", class: "A", guardianQ: "Maria", status: "pending" }
      );
      expect(receivedFilters).toEqual({
        q: ["V-1", "E-2"],
        year: "1",
        class: "A",
        guardianQ: "Maria",
        status: "pending",
      });
    } finally {
      ReportService.gradeService.getGrades = original;
    }
  });
});
