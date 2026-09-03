import ReportService from "../../../src/services/ReportService";
import { Document, Packer } from "docx";
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
        ],
        termAverages: [17, null, null],
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
    expect(ReportService.getReportOptionData()).toEqual({
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
    expect((xml.match(/M. Pendiente:/g) || [])).toHaveLength(3);
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
  });
});
