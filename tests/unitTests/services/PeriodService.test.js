import { Period } from "../../../src/models";
import PeriodService from "../../../src/services/PeriodService";

describe("PeriodService", () => {
  const samplePeriodList = [
    new Period(2023, "archived", 2023, 2024, "2023-10-10"),
    new Period(2022, "archived", 2022, 2023, "2022-10-10"),
    new Period(2021, "archived", 2021, 2022, "2021-10-10"),
    new Period(2020, "archived", 2020, 2021, "2020-10-10"),
    new Period(2019, "archived", 2019, 2020, "2019-10-10"),
  ];

  describe("isPeriodListAddable", () => {
    test("allows adding to an empty period list", () => {
      expect(PeriodService.isPeriodListAddable([])).toBeTruthy();
    });

    test("allows adding to a list of archived periods", () => {
      expect(PeriodService.isPeriodListAddable(samplePeriodList)).toBeTruthy();
    });

    test("does not allow adding to a list already containing a new or active period", () => {
      const periodList = structuredClone(samplePeriodList);
      periodList.push(new Period(2024, "new", 2024, 2025, "2024-10-10"));

      expect(PeriodService.isPeriodListAddable(periodList)).toBeFalsy();

      periodList.at(-1).status = "active";

      expect(PeriodService.isPeriodListAddable(periodList)).toBeFalsy();
    });

    test("does not treat non-array values as addable period lists", () => {
      expect(PeriodService.isPeriodListAddable(null)).toBeFalsy();
      expect(PeriodService.isPeriodListAddable({})).toBeFalsy();
    });
  });

  describe("isValidNewPeriod", () => {
    test("validates a new period with sqlite date format and opening date within the opening year", () => {
      const newPeriod = new Period(2025, null, 2025, 2026, "2025-10-10");

      expect(PeriodService.isValidNewPeriod(newPeriod)).toBeTruthy();
    });

    test("rejects periods with dates outside sqlite YYYY-MM-DD format", () => {
      expect(
        PeriodService.isValidNewPeriod(new Period(2025, null, 2025, 2026, "10-10-2025"))
      ).toBeFalsy();
      expect(
        PeriodService.isValidNewPeriod(new Period(2025, null, 2025, 2026, "2025-02-30"))
      ).toBeFalsy();
    });

    test("rejects periods with opening dates outside the opening year", () => {
      const newPeriod = new Period(2025, null, 2025, 2026, "2026-01-01");

      expect(PeriodService.isValidNewPeriod(newPeriod)).toBeFalsy();
    });

    test("rejects periods with invalid year attributes", () => {
      expect(
        PeriodService.isValidNewPeriod(new Period(2025, null, 2025, 2027, "2025-10-10"))
      ).toBeFalsy();
      expect(
        PeriodService.isValidNewPeriod(new Period(2025, null, "2025", 2026, "2025-10-10"))
      ).toBeFalsy();
    });
  });
});
