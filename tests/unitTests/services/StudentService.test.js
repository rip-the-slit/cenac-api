import StudentService from "../../../src/services/StudentService";

describe("StudentService", () => {
  describe("_parseStudentRows", () => {
    test("deduplicates guardian joins without merging enrollments", () => {
      const guardian = {
        assignedGuardianId: "guardian-1",
        assignedGuardianFirstName: "María",
      };
      const rows = [
        { id: "student-1", periodId: 10, yearId: 1, classDatabaseId: 1,
          className: "z", ...guardian },
        { id: "student-1", periodId: 10, yearId: 1, classDatabaseId: 1,
          className: "z", ...guardian },
        { id: "student-1", periodId: 10, yearId: 2, classDatabaseId: 2,
          className: "A", ...guardian },
      ];

      const result = StudentService._parseStudentRows(rows);

      expect(result).toHaveLength(2);
      expect(result.every(({ assignedGuardians }) =>
        assignedGuardians.length === 1
      )).toBe(true);
    });
  });

  describe("_buildClassSuggestions", () => {
    const subjectRepository = StudentService.subjectRepository;
    const originalAssignments = subjectRepository.findAllAssignmentsByPeriod;
    const originalGrades = subjectRepository.findAllGradesByStudents;
    const originalPending =
      StudentService.studentRepository.findAllPendingSubjectsByStudents;

    afterEach(() => {
      subjectRepository.findAllAssignmentsByPeriod = originalAssignments;
      subjectRepository.findAllGradesByStudents = originalGrades;
      StudentService.studentRepository.findAllPendingSubjectsByStudents =
        originalPending;
    });

    test("keeps a passed regular student back for failed floating subjects", () => {
      let pendingCalls = 0;
      StudentService.studentRepository.findAllPendingSubjectsByStudents =
        (periodId, studentIds) => {
          pendingCalls++;
          expect(periodId).toBe("2025");
          expect(studentIds).toEqual(["V-1"]);
          return [{
            studentId: "V-1",
            periodId: "2025",
            yearId: 1,
            subjectId: 1,
            status: "failed",
          }];
        };
      const guardian = { id: "G-1", firstName: "María" };

      const result = StudentService._buildClassSuggestions(
        [
          {
            id: "V-1",
            firstName: "Ana",
            status: "failed",
            assignedGuardians: [guardian],
            _class: { id: "z", year: 1 },
          },
          {
            id: "V-1",
            firstName: "Ana",
            status: "passed",
            assignedGuardians: [guardian],
            _class: { id: "A", year: 2 },
          },
        ],
        { id: "2025", startYear: 2025 },
        { 1: [], 2: [], 3: [] }
      );

      expect(pendingCalls).toBe(1);
      expect(result).toEqual([
        expect.objectContaining({
          id: "V-1",
          pendingSubjects: [1],
          assignedGuardians: [guardian],
          _class: { id: "A", year: 2, originalYear: 2 },
        }),
      ]);
    });

    test("bulk-calculates pending regular students and promotes them", () => {
      let assignmentCalls = 0;
      let gradeCalls = 0;
      subjectRepository.findAllAssignmentsByPeriod = () => {
        assignmentCalls++;
        return [1, 2].map((subjectId) => ({
          subjectId,
          yearSubjectId: subjectId,
          yearId: 1,
          minimumGrade: 10,
        }));
      };
      subjectRepository.findAllGradesByStudents = (periodId, studentIds) => {
        gradeCalls++;
        expect(periodId).toBe("2025");
        expect(studentIds).toEqual(["V-2"]);
        return [{
          studentId: "V-2",
          periodId: "2025",
          yearId: 1,
          yearSubjectId: 1,
          subjectId: 1,
          term: 4,
          strategy: 1,
          value: 12,
        }];
      };

      const result = StudentService._buildClassSuggestions(
        [{
          id: "V-2",
          status: "pending",
          assignedGuardians: [],
          _class: { id: "B", year: 1 },
        }],
        { id: "2025", startYear: 2025 },
        { 1: [1, 2], 2: [] },
        [
          { id: 1, minimumGrade: 10 },
          { id: 2, minimumGrade: 10 },
        ]
      );

      expect(assignmentCalls).toBe(1);
      expect(gradeCalls).toBe(1);
      expect(result[0]).toMatchObject({
        id: "V-2",
        pendingSubjects: [2],
        _class: { id: "B", year: 2, originalYear: 1 },
      });
    });

    test("does not treat an uppercase Z class as floating", () => {
      const result = StudentService._buildClassSuggestions(
        [{
          id: "V-3",
          status: "passed",
          assignedGuardians: [],
          _class: { id: "Z", year: 1 },
        }],
        { id: "2025", startYear: 2025 },
        { 1: [], 2: [] }
      );

      expect(result[0]._class).toEqual({ id: "Z", year: 2, originalYear: 1 });
    });
  });
});
