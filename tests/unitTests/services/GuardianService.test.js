import GuardianService from "../../../src/services/GuardianService";

describe("GuardianService", () => {
  describe("_parseGuardianRows", () => {
    test("groups assigned students and removes duplicate joins", () => {
      const guardian = {
        id: "guardian-1",
        firstName: "María",
        lastName: "Pérez",
        legalRole: "Madre",
      };
      const student = {
        assignedStudentId: "student-1",
        assignedStudentFirstName: "Ana",
        assignedStudentLastName: "Pérez",
        assignedStudentStatus: "active",
      };

      const result = GuardianService._parseGuardianRows([
        { ...guardian, ...student },
        { ...guardian, ...student },
        {
          ...guardian,
          assignedStudentId: "student-2",
          assignedStudentFirstName: "Bruno",
          assignedStudentLastName: "Pérez",
          assignedStudentStatus: "inactive",
        },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "guardian-1",
        assignedStudents: [
          expect.objectContaining({ id: "student-1", firstName: "Ana" }),
          expect.objectContaining({ id: "student-2", firstName: "Bruno" }),
        ],
      });
    });
  });
});
