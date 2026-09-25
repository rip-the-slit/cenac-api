import GradeService from "../../../src/services/GradeService";

describe("GradeService", () => {
  describe("calculateSubjectAverages", () => {
    test("treats every unloaded regular slot as zero", () => {
      const subject = GradeService._emptySubjectGrades(false, {
        subjectId: 1,
        minimumGrade: 10,
      });
      subject.terms[0][0] = 18;
      subject.terms[0][1] = 16;

      const result = GradeService.calculateSubjectAverages(subject);

      expect(result.termAverages).toEqual([7, 0, 0, 0]);
      expect(result.avg).toBe(2);
      expect(result.terms[0]).toEqual([18, 16, null, null, null]);
    });

    test("rounds term averages before calculating the subject average", () => {
      const subject = GradeService._emptySubjectGrades(false);
      subject.terms[0] = [4, 4, 4, 4, 3];
      subject.terms[1] = [4, 4, 4, 4, 3];
      subject.terms[2] = [4, 4, 4, 4, 3];
      subject.terms[3] = [20];

      const result = GradeService.calculateSubjectAverages(subject);

      expect(result.termAverages).toEqual([4, 4, 4, 20]);
      expect(result.avg).toBe(4);
    });
  });

  describe("calculateStatus", () => {
    const regularSubject = (subjectId, avg, revision = 0) => ({
      subjectId,
      minimumGrade: 10,
      floating: false,
      avg,
      termAverages: [avg, 0, 0, revision],
    });

    test.each([
      ["passed", [regularSubject(1, 12), regularSubject(2, 15)]],
      ["pending", [regularSubject(1, 12), regularSubject(2, 8)]],
      [
        "failed",
        [
          regularSubject(1, 12),
          regularSubject(2, 8),
          regularSubject(3, 7),
          regularSubject(4, 6),
        ],
      ],
    ])("returns %s and each subject result", (status, subjects) => {
      const grades = Object.fromEntries(
        subjects.map((subject) => [subject.subjectId, subject])
      );

      const result = GradeService.calculateStatus(grades);

      expect(result.status).toBe(status);
      expect(result.subjects).toEqual(
        subjects.map((subject) =>
          expect.objectContaining({
            subjectId: subject.subjectId,
            status: subject.avg >= 10 ? "passed" : "failed",
          })
        )
      );
    });

    test("uses revision without including it in the regular average", () => {
      const result = GradeService.calculateStatus({
        1: regularSubject(1, 4, 12),
      });

      expect(result).toMatchObject({
        status: "passed",
        subjects: [{ subjectId: 1, score: 12, status: "passed" }],
      });
    });

    test("fails a floating enrollment when any subject fails", () => {
      const result = GradeService.calculateStatus({
        1: {
          subjectId: 1,
          minimumGrade: 10,
          floating: true,
          avg: 0,
          termAverages: [20, 0, 0, 0],
        },
        2: {
          subjectId: 2,
          minimumGrade: 10,
          floating: true,
          avg: 0,
          termAverages: [9, 0, 0, 0],
        },
      });

      expect(result.status).toBe("failed");
    });
  });

  describe("_parseGradeRows", () => {
    test("separates regular and floating rows and calculates every slot", () => {
      const studentRows = [
        {
          id: "V-1",
          firstName: "Ana",
          lastName: "Alonso",
          status: "pending",
          yearName: "2do Año",
          yearId: 2,
          className: "A",
          periodId: "2025",
          periodStartYear: 2025,
        },
        {
          id: "V-1",
          firstName: "Ana",
          lastName: "Alonso",
          status: "failed",
          yearName: "1er Año",
          yearId: 1,
          className: "z",
          periodId: "2025",
          periodStartYear: 2025,
          pendingSubjects: [
            { subjectId: 1, yearSubjectId: 11, minimumGrade: 10 },
          ],
        },
      ];
      const gradeRows = [
        {
          studentId: "V-1",
          periodId: "2025",
          yearId: 2,
          yearSubjectId: 23,
          subjectId: 3,
          term: 1,
          strategy: 1,
          value: 14,
        },
        {
          studentId: "V-1",
          periodId: "2025",
          yearId: 2,
          yearSubjectId: 23,
          subjectId: 3,
          term: 4,
          strategy: 1,
          value: 18,
        },
        {
          studentId: "V-1",
          periodId: "2025",
          yearId: 1,
          yearSubjectId: 11,
          subjectId: 1,
          term: 2,
          strategy: 1,
          value: 11,
        },
      ];

      const result = GradeService._parseGradeRows(
        studentRows,
        gradeRows,
        { 2: [3] },
        [{ id: 3, minimumGrade: 10 }]
      );

      const regular = result.find(({ floating }) => !floating);
      const floating = result.find((row) => row.floating);
      expect(regular.subjectAverages).toEqual({ 3: 1 });
      expect(regular.subjectDetails[3]).toMatchObject({
        avg: 1,
        termAverages: [3, 0, 0, 18],
        terms: [
          [14, null, null, null, null],
          [null, null, null, null, null],
          [null, null, null, null, null],
          [18],
        ],
      });
      expect(floating.subjectAverages).toEqual({ 1: 4 });
      expect(floating.subjectDetails[1].termAverages).toEqual([0, 11, 0, 0]);
    });

    test("keeps grades isolated for the same student in different periods", () => {
      const students = ["2024", "2025"].map((periodId) => ({
        id: "V-1",
        firstName: "Ana",
        lastName: "Alonso",
        yearId: 1,
        yearName: "1er Año",
        className: "A",
        periodId,
        periodStartYear: Number(periodId),
      }));
      const gradeRows = [18, 12].map((value, index) => ({
        studentId: "V-1",
        periodId: String(2024 + index),
        yearId: 1,
        subjectId: 1,
        term: 1,
        strategy: 1,
        value,
      }));

      const result = GradeService._parseGradeRows(students, gradeRows);

      expect(result.map(({ subjectAverages }) => subjectAverages)).toEqual([
        { 1: 1 },
        { 1: 1 },
      ]);
    });
  });
});
