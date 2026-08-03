import supertest from "supertest";
import app from "../../src/app";
import { Period } from "../../src/models";

const ROOT = "/api/periods";

describe("Period Endpoint", () => {
  test("Root returns empty array", async () => {
    const res = await supertest(app).get(ROOT).expect(200);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body).toHaveLength(0);
  });
  test("Can start a new period", async () => {
    const newPeriod = new Period(2025, null, 2025, 2026, "10-10-2025");
    await supertest(app)
      .post(ROOT)
      .send({
        id: 2025,
        status: null,
        startYear: 2025,
        endYear: 2026,
        openingDate: "2025-10-10",
      })
      .expect(201);

    const res = await supertest(app).get(ROOT).expect(200);
    expect(res.body).toContain("2025");
  });
});
