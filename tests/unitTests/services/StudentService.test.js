import StudentService from "../../../src/services/StudentService";

describe("StudentService", () => {
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
