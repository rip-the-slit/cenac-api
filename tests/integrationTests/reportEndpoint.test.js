import supertest from "supertest";
import app from "../../src/app";
const agent = supertest.agent(app);

const ROOT = "/api/reports";
const PERIOD_ID = "2110";
const WORD_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const parseBinary = (res, callback) => {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
};
const students = {
  ana: "V-11000001",
  bruno: "V-11000002",
  carla: "V-11000003",
};

beforeAll(async () => {
  await agent
    .post("/api/users/login")
    .send({ id: 1, password: "1234" })
    .expect(200);

  await agent
    .post("/api/periods")
    .send({
      startYear: Number(PERIOD_ID),
      endYear: Number(PERIOD_ID) + 1,
      openingDate: `${PERIOD_ID}-09-01`,
    })
    .expect(201);

  await agent
    .post(`/api/periods/${PERIOD_ID}/load`)
    .send({
      students: [
        {
          id: students.ana,
          firstName: "Ana",
          lastName: "Alonso",
          birthDate: "2098-01-01",
          birthPlace: "Caracas",
          _class: { id: "A", year: 1 },
        },
        {
          id: students.bruno,
          firstName: "Bruno",
          lastName: "Benitez",
          birthDate: "2098-02-01",
          birthPlace: "Caracas",
          _class: { id: "B", year: 1 },
        },
        {
          id: students.carla,
          firstName: "Carla",
          lastName: "Castro",
          birthDate: "2098-03-01",
          birthPlace: "Caracas",
          _class: { id: "A", year: 2 },
        },
      ],
      subjects: { 1: [1], 2: [3] },
    })
    .expect(200, { loaded: true });

  await agent
    .post("/api/grades/load")
    .send({
      periodId: PERIOD_ID,
      grades: [
        { id: students.ana, subjects: { 1: [[18, 16]] } },
        { id: students.bruno, subjects: { 1: [[8, 6]] } },
      ],
    })
    .expect(200, { loaded: 2, skipped: 0 });
});

describe("Report Endpoint", () => {
  test("returns report option data", async () => {
    const res = await agent.get(ROOT).expect(200);

    expect(res.body.reportTypes).toEqual([
      expect.objectContaining({
        value: "grades",
        name: "Boletin",
        options: expect.any(Array),
      }),
    ]);
  });

  test("generates a Word grades report for multiple student ids", async () => {
    const res = await agent
      .get(`${ROOT}/grades`)
      .query({
        periodId: PERIOD_ID,
        q: `${students.ana} OR ${students.bruno} OR ${students.carla}`,
        term: "all",
      })
      .buffer(true)
      .parse(parseBinary)
      .expect(200)
      .expect("Content-Type", WORD_MIME);

    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
