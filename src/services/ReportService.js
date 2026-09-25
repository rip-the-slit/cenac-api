import * as docx from "docx";
const {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} = docx.default ?? docx;
import fs from "fs";
import path from "path";
import GradeService from "./GradeService.js";

const INSTITUTION_NAME = "C.E. Juan German Roscio";
const INSTITUTION_LOGO_PLACEHOLDER = "[LOGO DE LA INSTITUCIÓN]";

const FONT_NAME = "Arial";
const BODY_FONT_SIZE = 22;
const SMALL_FONT_SIZE = 16;
const TABLE_WIDTH = 100;
const PAGE_MARGIN = 360;
const TERM_NAMES = {
  1: "1ER LAPSO",
  2: "2DO LAPSO",
  3: "3ER LAPSO",
};

const visibleBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
};
const invisibleBorders = {
  top: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
  insideHorizontal: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
  insideVertical: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
};

class ReportService {
  constructor(gradeService) {
    this.gradeService = gradeService;
  }

  getReportOptionData() {
    return {
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
    };
  }

  _formatReportDate(date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return day + "/" + month + "/" + date.getFullYear();
  }

  _buildGradesReport(gradeRecord, terms, subjects, years, reportDate) {
    const textParagraph = (
      text = "",
      {
        bold = false,
        size = BODY_FONT_SIZE,
        alignment = AlignmentType.LEFT,
        spacing = {},
      } = {}
    ) =>
      new Paragraph({
        alignment,
        spacing: { before: 0, after: 0, ...spacing },
        children: [
          new TextRun({
            text: String(text ?? ""),
            bold,
            size,
            font: FONT_NAME,
          }),
        ],
      });
    
    const reportCell = (
      text,
      {
        bold = false,
        size = BODY_FONT_SIZE,
        alignment = AlignmentType.CENTER,
        columnSpan,
        rowSpan,
        width,
        borders = visibleBorders,
        children,
      } = {}
    ) =>
      new TableCell({
        borders,
        columnSpan,
        rowSpan,
        width: width
          ? { size: width, type: WidthType.PERCENTAGE }
          : undefined,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 40, bottom: 40, left: 100, right: 100 },
        children:
          children || [textParagraph(text, { bold, size, alignment })],
      });
    
    const displayGrade = (value) =>
      value === null || value === undefined ? "" : String(Math.trunc(value * 10) / 10).replace(".", ",");  

    const selectedTerm = ["1", "2", "3"].includes(String(terms))
      ? String(terms)
      : "all";
    const isAllTerms = selectedTerm === "all";
    const subjectNames = new Map(
      subjects.map((subject) => [String(subject.id), subject.name])
    );
    const assignedSubjects = Object.entries(gradeRecord.subjectDetails || {})
      .map(([subjectId, grades]) => ({
        name: subjectNames.get(String(subjectId)) || String(subjectId),
        grades,
      }));
    const matchingYear = [...years]
      .sort((first, second) => second.name.length - first.name.length)
      .find((year) => gradeRecord.class.startsWith(year.name));
    const yearName = matchingYear?.name || "";
    const sectionName = matchingYear
      ? gradeRecord.class.slice(matchingYear.name.length).trim()
      : gradeRecord.class;
    const academicPeriod = gradeRecord.period + " - " + (Number(gradeRecord.period) + 1);

    const logoPath = path.resolve("public/logo.png");
    const logoParagraph = fs.existsSync(logoPath)
      ? new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              type: "png",
              data: fs.readFileSync(logoPath),
              transformation: { width: 72, height: 72 },
              altText: {
                name: "Logo institucional",
                title: "Logo institucional",
                description: "Logo de la institución",
              },
            }),
          ],
        })
      : textParagraph(INSTITUTION_LOGO_PLACEHOLDER, {
          bold: true,
          alignment: AlignmentType.CENTER,
        });
    const institutionDetails = [
      textParagraph("República Bolivariana de Venezuela", { bold: true }),
      textParagraph("Ministerio del Poder Popular para la Educación", {
        bold: true,
      }),
      textParagraph(INSTITUTION_NAME, { bold: true }),
    ];
    const institutionHeader = new Table({
      width: { size: TABLE_WIDTH, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: invisibleBorders,
      rows: [
        new TableRow({
          children: [
            reportCell("", {
              width: 24,
              borders: invisibleBorders,
              children: [logoParagraph],
            }),
            reportCell("", {
              width: 76,
              borders: invisibleBorders,
              children: institutionDetails,
            }),
          ],
        }),
      ],
    });
    const studentDetails = [
      textParagraph("Año Escolar: " + academicPeriod),
      textParagraph("Estudiante: " + gradeRecord.fullName),
      textParagraph("Cédula: " + gradeRecord.id),
      textParagraph(`${yearName}, ${sectionName}`),
    ];
    const reportHeader = new Table({
      width: { size: TABLE_WIDTH, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: invisibleBorders,
      rows: [
        new TableRow({
          children: [
            reportCell("", {
              width: 68,
              borders: invisibleBorders,
              children: [institutionHeader],
            }),
            reportCell("", {
              width: 32,
              borders: invisibleBorders,
              children: studentDetails,
            }),
          ],
        }),
      ],
    });
    const reportTitle = textParagraph("BOLETÍN INFORMATIVO", {
      bold: true,
      size: 20,
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 100 },
    });

    let gradeHeaderRows;
    let studentGradeRows;
    if (isAllTerms) {
      gradeHeaderRows = [
        new TableRow({
          tableHeader: true,
          children: [
            reportCell("ÁREAS DE FORMACIÓN", {
              bold: true,
              rowSpan: 2,
              width: 30,
            }),
            ...Object.values(TERM_NAMES).map((termName) =>
              reportCell(termName, { bold: true, columnSpan: 2 })
            ),
            reportCell("Calificación\nDefinitiva", {
              bold: true,
              rowSpan: 2,
            }),
            reportCell("Total\nInasistencias", {
              bold: true,
              rowSpan: 2,
            }),
          ],
        }),
        new TableRow({
          tableHeader: true,
          children: Object.values(TERM_NAMES).flatMap(() => [
            reportCell("Calificación", {
              bold: true,
              size: SMALL_FONT_SIZE,
            }),
            reportCell("Inasistencias", {
              bold: true,
              size: SMALL_FONT_SIZE,
            }),
          ]),
        }),
      ];
      studentGradeRows = assignedSubjects.map(({ name, grades }) =>
        new TableRow({
          children: [
            reportCell(name, { alignment: AlignmentType.LEFT }),
            ...grades.termAverages.slice(0, 3).flatMap((average) => [
              reportCell(displayGrade(average)),
              reportCell(""),
            ]),
            reportCell(displayGrade(grades.avg), { bold: true }),
            reportCell(""),
          ],
        })
      );
    } else {
      const termIndex = Number(selectedTerm) - 1;
      gradeHeaderRows = [
        new TableRow({
          tableHeader: true,
          children: [
            reportCell("ÁREAS DE FORMACIÓN", {
              bold: true,
              rowSpan: 2,
              width: 35,
            }),
            reportCell(TERM_NAMES[selectedTerm], {
              bold: true,
              columnSpan: 5,
            }),
            reportCell("Definitiva", { bold: true, rowSpan: 2 }),
          ],
        }),
        new TableRow({
          tableHeader: true,
          children: Array.from({ length: 5 }, (_, index) =>
            reportCell("Estrategia " + (index + 1), {
              bold: true,
              size: SMALL_FONT_SIZE,
            })
          ),
        }),
      ];
      studentGradeRows = assignedSubjects.map(({ name, grades }) =>
        new TableRow({
          children: [
            reportCell(name, { alignment: AlignmentType.LEFT }),
            ...grades.terms[termIndex].map((grade) =>
              reportCell(displayGrade(grade))
            ),
            reportCell(displayGrade(grades.termAverages[termIndex]), {
              bold: true,
            }),
          ],
        })
      );
    }

    const gradesTable = new Table({
      width: { size: TABLE_WIDTH, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: visibleBorders,
      rows: [...gradeHeaderRows, ...studentGradeRows],
    });

    const pendingSubjects = Object.entries(
      gradeRecord.pendingSubjectDetails || {}
    ).map(([subjectId, grades]) => ({
      name: subjectNames.get(String(subjectId)) || String(subjectId),
      grades,
    }));
    const pendingRows = Array.from({ length: 2 }, (_, index) => {
      const pending = pendingSubjects[index];
      return new TableRow({
        children: [
          reportCell(pending?.name || "", {
            alignment: AlignmentType.LEFT,
          }),
          ...Array.from({ length: 4 }, (_, termIndex) =>
            reportCell(
              displayGrade(pending?.grades?.termAverages?.[termIndex])
            )
          ),
        ],
      });
    });
    const pendingTitle = isAllTerms
      ? textParagraph("MATERIAS PENDIENTES", {
          bold: true,
          size: 20,
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 100 },
        })
      : null;
    const pendingTable = isAllTerms
      ? new Table({
          width: { size: TABLE_WIDTH, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          borders: visibleBorders,
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                reportCell("Materia pendiente", { bold: true, width: 40 }),
                ...Array.from({ length: 4 }, (_, index) =>
                  reportCell(`M${index + 1}`, { bold: true })
                ),
              ],
            }),
            ...pendingRows,
          ],
        })
      : null;

    const observations = reportCell("", {
      width: 75,
      alignment: AlignmentType.LEFT,
      borders: {...visibleBorders, top: invisibleBorders.top},
      children: [
        textParagraph("OBSERVACIONES:", { bold: true }),
        textParagraph(""),
        textParagraph(""),
        textParagraph(""),
      ],
    });
    const signatures = reportCell("", {
      width: 25,
      borders: invisibleBorders,
      alignment: AlignmentType.LEFT,
      children: [
        textParagraph("Docente Guía: __________________"),
        textParagraph("Fecha: " + reportDate),
      ],
    });
    const reportFooter = new Table({
      width: { size: TABLE_WIDTH, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: invisibleBorders,
      rows: [
        new TableRow({
          children: [observations, signatures],
        }),
      ],
    });

    return {
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE },
          margin: {
            top: PAGE_MARGIN,
            right: PAGE_MARGIN,
            bottom: PAGE_MARGIN,
            left: PAGE_MARGIN,
          },
        },
      },
      children: [
        reportHeader,
        reportTitle,
        gradesTable,
        ...(pendingTable ? [pendingTitle, pendingTable] : []),
        reportFooter,
      ],
    };
  }

  _mergeFloatingEnrollments(rows) {
    const records = new Map();

    for (const row of rows) {
      const key = JSON.stringify([row.id, row.periodId ?? row.period]);
      if (!records.has(key)) {
        records.set(key, { regular: null, floating: null });
      }
      const entry = records.get(key);
      if (row.floating || String(row.className) === "z") {
        entry.floating = row;
      } else {
        entry.regular = row;
      }
    }

    return Array.from(records.values()).map(({ regular, floating }) => ({
      ...(regular || floating),
      pendingSubjectDetails: floating?.subjectDetails || {},
    }));
  }

  async generateGradesReport(periodId, q, terms, preview = false) {
    const { rows, subjects, years } = this.gradeService.getGrades(periodId, {
      q,
      ...(preview ? { page: 1, limit: 5 } : {}),
    });
    const document = new Document({ sections: [] });
    const reportDate = this._formatReportDate(new Date());

    for (const gradeRecord of this._mergeFloatingEnrollments(rows)) {
      document.addSection(
        this._buildGradesReport(
          gradeRecord,
          terms,
          subjects,
          years,
          reportDate
        )
      );
    }

    return Packer.toBuffer(document);
  }

}

export default new ReportService(GradeService);
