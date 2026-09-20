import StudentService from "../../../src/services/StudentService";

describe("StudentService", () => {
  describe("_parseStudentRows", () => {
    test("groups guardians by student enrollment and removes duplicate joins", () => {
      const enrollment = {
        id: "student-1",
        firstName: "Ana",
        lastName: "Pérez",
        periodId: 10,
        className: "A",
        yearId: 1,
      };
      const guardian = {
        assignedGuardianId: "guardian-1",
        assignedGuardianFirstName: "María",
        assignedGuardianLastName: "Pérez",
        assignedGuardianLegalRole: "Madre",
      };

      const result = StudentService._parseStudentRows([
        { ...enrollment, ...guardian },
        { ...enrollment, ...guardian },
        {
          ...enrollment,
          periodId: 11,
          assignedGuardianId: "guardian-2",
          assignedGuardianFirstName: "José",
          assignedGuardianLastName: "Pérez",
          assignedGuardianLegalRole: "Padre",
        },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].assignedGuardians).toEqual([
        expect.objectContaining({ id: "guardian-1", firstName: "María" }),
      ]);
      expect(result[1]).toMatchObject({
        id: "student-1",
        periodId: 11,
        assignedGuardians: [
          expect.objectContaining({ id: "guardian-2", firstName: "José" }),
        ],
      });
    });
  });

  describe("_buildClassSuggestions", () => {
    test("promotes eligible students to the same class in the next available year", () => {
      const enrollments = [
        {
          id: "passed",
          status: "passed",
          _class: { id: "B", year: 1 },
        },
        {
          id: "pending",
          status: "pending",
          _class: { id: "A", year: 1 },
        },
        {
          id: "failed",
          status: "failed",
          _class: { id: "C", year: 1 },
        },
        {
          id: "gap",
          status: "passed",
          _class: { id: "D", year: 2 },
        },
        {
          id: "final",
          status: "pending",
          _class: { id: "E", year: 4 },
        },
      ];

      const result = StudentService._buildClassSuggestions(
        enrollments,
        [1, 2, 4]
      );

      expect(result).toEqual([
        expect.objectContaining({
          id: "passed",
          _class: { id: "B", year: 2 },
        }),
        expect.objectContaining({
          id: "pending",
          _class: { id: "A", year: 2 },
        }),
      ]);
    });
  });
});
