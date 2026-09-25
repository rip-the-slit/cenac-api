import supertest from "supertest";
import app from "../../src/app";

const ROOT = "/api/subjects";
const PERIOD_ROOT = "/api/periods";
const PERIOD_ID = "2150";
const agent = supertest.agent(app);

beforeAll(async () => {
  await agent
    .post("/api/users/login")
    .send({ id: 1, password: "1234" })
    .expect(200);
});

describe("Subject Endpoint", () => {
  test("requires authentication", async () => {
    await supertest(app).get(`${ROOT}/suggestions`).expect(401);
  });

  test("returns no suggestions before a period has been archived", async () => {
    await agent.get(`${ROOT}/suggestions`).expect(200, {});
  });

  test("returns the subject assignments from the latest archived period", async () => {
    const subjectsByYear = {
      1: [1, 2, 3],
      2: [1, 3, 7],
      3: [],
    };
    await agent
      .post(PERIOD_ROOT)
      .send({
        startYear: Number(PERIOD_ID),
        endYear: Number(PERIOD_ID) + 1,
        openingDate: `${PERIOD_ID}-09-01`,
      })
      .expect(201);
    await agent
      .post(`${PERIOD_ROOT}/${PERIOD_ID}/load`)
      .send({ students: [], subjects: subjectsByYear })
      .expect(200, { loaded: true });
    await agent
      .post(`${PERIOD_ROOT}/${PERIOD_ID}/archive`)
      .send({ supersede: true })
      .expect(200);

    const res = await agent.get(`${ROOT}/suggestions`).expect(200);

    expect(res.body.subjectsByYear).toEqual(subjectsByYear);
    for (const subjectIds of Object.values(res.body.subjectsByYear)) {
      expect(subjectIds.every(Number.isInteger)).toBe(true);
    }
  });
});
