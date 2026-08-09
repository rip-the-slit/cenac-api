import GradeService from "../../../src/services/GradeService";

describe("GradeService", () => {
  describe("_parseGradeRows", () => {
    const studentRows = [
      {
        id: "V-10000001",
        firstName: "Ana",
        lastName: "Alonso",
        status: "Aprobado",
        yearName: "Primer Año",
        yearId: 1,
        className: "A",
      },
      {
        id: "V-10000002",
        firstName: "Bruno",
        lastName: "Benitez",
        status: "Reprobado",
        yearName: "Primer Año",
        yearId: 1,
        className: "B",
      },
    ];

    test("shapes raw subject grade rows by student, subject, term, and strategy", () => {
      const gradeRows = [
        {
          gradeId: 1,
          studentId: "V-10000001",
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
          subjectId: 3,
          term: 2,
          strategy: 1,
          value: 15,
          subjectAverage: 15,
          termAverage: 15,
        },
      ];

      const [student] = GradeService._parseGradeRows(studentRows, gradeRows);

      expect(student).toEqual({
        id: "V-10000001",
        fullName: "Alonso Ana",
        status: "Aprobado",
        class: "Primer Año A",
        grades: {
          1: {
            avg: 17,
            terms: [
              [18, 16, null, null],
              [null, null, null, null],
              [null, null, null, null],
            ],
            termAverages: [17, null, null],
          },
          3: {
            avg: 15,
            terms: [
              [null, null, null, null],
              [15, null, null, null],
              [null, null, null, null],
            ],
            termAverages: [null, 15, null],
          },
        },
        subjectAverages: { 1: 17, 3: 15 },
        subjectDetails: {
          1: expect.any(Object),
          3: expect.any(Object),
        },
      });
    });

    test("keeps paged students without grades and ignores grades outside the page", () => {
      const result = GradeService._parseGradeRows(studentRows, [
        {
          gradeId: 4,
          studentId: "V-99999999",
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
  });
});
