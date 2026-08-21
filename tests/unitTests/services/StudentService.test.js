import StudentService from "../../../src/services/StudentService";

describe("StudentService", () => {
  describe("_buildClassSuggestions", () => {
    test("promotes eligible students to the same class in the next available year", () => {
      const enrollments = [
        {
          student: { id: "passed", status: "passed" },
          className: "B",
          yearId: 1,
        },
        {
          student: { id: "pending", status: "pending" },
          className: "A",
          yearId: 1,
        },
        {
          student: { id: "failed", status: "failed" },
          className: "C",
          yearId: 1,
        },
        {
          student: { id: "gap", status: "passed" },
          className: "D",
          yearId: 2,
        },
        {
          student: { id: "final", status: "pending" },
          className: "E",
          yearId: 4,
        },
      ];

      const result = StudentService._buildClassSuggestions(
        enrollments,
        [1, 2, 4]
      );

      expect(result.students).toEqual([
        expect.objectContaining({
          id: "passed",
          _class: { id: "B", year: 2 },
        }),
        expect.objectContaining({
          id: "pending",
          _class: { id: "A", year: 2 },
        }),
      ]);
      expect(result.statusUpdates).toEqual([
        expect.objectContaining({ id: "passed", status: "active" }),
        expect.objectContaining({ id: "pending", status: "active" }),
        expect.objectContaining({ id: "failed", status: "inactive" }),
        expect.objectContaining({ id: "gap", status: "inactive" }),
        expect.objectContaining({ id: "final", status: "inactive" }),
      ]);
    });
  });
});
