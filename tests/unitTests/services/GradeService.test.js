import GradeService from "../../../src/services/GradeService";

const GRADE_SLOTS_PER_TERM = 5;

describe("GradeService", () => {
  describe("_getStudentClassStatus", () => {
    test.each([
      [
        "passed",
        [12, 15, 18, 10, 14].map((average) => ({
          average,
          minimumGrade: 10,
        })),
      ],
      [
        "pending",
        [12, 15, 8, 6, null].map((average) => ({
          average,
          minimumGrade: 10,
        })),
      ],
      [
        "failed",
        [12, 8, 7, 6, null].map((average) => ({
          average,
          minimumGrade: 10,
        })),
      ],
    ])("returns %s from individual subject results", (status, subjects) => {
      expect(GradeService._getStudentClassStatus(subjects)).toBe(status);
    });
  });

  describe("_parseGradeRows", () => {
    const studentRows = [
      {
        id: "V-10000001",
        firstName: "Ana",
        lastName: "Alonso",
        status: "passed",
        yearName: "Primer Año",
        yearId: 1,
        className: "A",
        periodId: "2025",
        periodStartYear: 2025,
      },
      {
        id: "V-10000002",
        firstName: "Bruno",
        lastName: "Benitez",
        status: "failed",
        yearName: "Primer Año",
        yearId: 1,
        className: "B",
        periodId: "2025",
        periodStartYear: 2025,
      },
    ];

    test("shapes raw subject grade rows by student, subject, term, and strategy", () => {
      const gradeRows = [
        {
          gradeId: 1,
          studentId: "V-10000001",
          periodId: "2025",
          subjectId: 1,
          term: 1,
          strategy: 1,
          value: 18,
          subjectAverage: 17,
          termAverage: 17,
        },
        {
          gradeId: 2,
          studentId: "V-10000001",
          periodId: "2025",
          subjectId: 1,
          term: 1,
          strategy: 2,
          value: 16,
          subjectAverage: 17,
          termAverage: 17,
        },
        {
          gradeId: 3,
          studentId: "V-10000001",
          periodId: "2025",
          subjectId: 3,
          term: 2,
          strategy: 1,
          value: 15,
          subjectAverage: 15,
          termAverage: 15,
        },
      ];

      const [student] = GradeService._parseGradeRows(
        studentRows,
        gradeRows,
        { 1: [1, 2, 3] }
      );

      expect(student).toEqual({
        id: "V-10000001",
        period: 2025,
        fullName: "Alonso Ana",
        status: "passed",
        class: "Primer Año A",
        grades: {
          1: {
            avg: 17,
            terms: [
              [18, 16, null, null, null],
              [null, null, null, null, null],
              [null, null, null, null, null],
            ],
            termAverages: [17, null, null],
          },
          2: {
            avg: null,
            terms: [
              [null, null, null, null, null],
              [null, null, null, null, null],
              [null, null, null, null, null],
            ],
            termAverages: [null, null, null],
          },
          3: {
            avg: 15,
            terms: [
              [null, null, null, null, null],
              [15, null, null, null, null],
              [null, null, null, null, null],
            ],
            termAverages: [null, 15, null],
          },
        },
        subjectAverages: { 1: 17, 2: null, 3: 15 },
        subjectDetails: {
          1: expect.any(Object),
          2: expect.any(Object),
          3: expect.any(Object),
        },
      });
    });

    test("keeps paged students without grades and ignores grades outside the page", () => {
      const result = GradeService._parseGradeRows(studentRows, [
        {
          gradeId: 4,
          studentId: "V-99999999",
          periodId: "2025",
          subjectId: 1,
          term: 1,
          strategy: 1,
          value: 20,
          subjectAverage: 20,
          termAverage: 20,
        },
        {
          gradeId: 5,
          studentId: "V-10000001",
          periodId: "2024",
          subjectId: 1,
          term: 1,
          strategy: 1,
          value: 20,
          subjectAverage: 20,
          termAverage: 20,
        },
      ]);

      expect(result.map(({ id }) => id)).toEqual([
        "V-10000001",
        "V-10000002",
      ]);
      expect(result.every((student) => (
        Object.keys(student.grades).length === 0 &&
        Object.keys(student.subjectAverages).length === 0
      ))).toBe(true);
    });

    test("keeps grades isolated for the same student in different periods", () => {
      const repeatedStudentRows = [
        {
          ...studentRows[0],
          periodId: "2024",
          periodStartYear: 2024,
          yearName: "Primer Año",
          className: "A",
        },
        {
          ...studentRows[0],
          periodId: "2025",
          periodStartYear: 2025,
          yearName: "Segundo Año",
          className: "B",
        },
      ];
      const gradeRows = [
        {
          studentId: "V-10000001",
          periodId: "2024",
          subjectId: 1,
          term: 1,
          strategy: 1,
          value: 18,
          subjectAverage: 18,
          termAverage: 18,
        },
        {
          studentId: "V-10000001",
          periodId: "2025",
          subjectId: 1,
          term: 1,
          strategy: 1,
          value: 12,
          subjectAverage: 12,
          termAverage: 12,
        },
      ];

      const result = GradeService._parseGradeRows(
        repeatedStudentRows,
        gradeRows
      );

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "V-10000001",
            period: 2024,
            subjectAverages: { 1: 18 },
            grades: expect.objectContaining({
              1: expect.objectContaining({
                terms: expect.arrayContaining([
                  [18, null, null, null, null],
                ]),
              }),
            }),
          }),
          expect.objectContaining({
            id: "V-10000001",
            period: 2025,
            subjectAverages: { 1: 12 },
            grades: expect.objectContaining({
              1: expect.objectContaining({
                terms: expect.arrayContaining([
                  [12, null, null, null, null],
                ]),
              }),
            }),
          }),
        ])
      );
    });
  });
});
