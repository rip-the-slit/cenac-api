import supertest from "supertest";
import app from "../../src/app.js";
import StudentRepository from "../../src/repositories/StudentRepository.js";

const agent = supertest.agent(app);
const PERIOD_ID = "2160";
const STUDENT_ID = "V-16000001";

const pendingStatuses = () =>
  StudentRepository.findAllPendingSubjectsByPeriod(PERIOD_ID, STUDENT_ID)
    .map(({ subjectId, yearId, status }) => ({ subjectId, yearId, status }));

const getGrades = async () => {
  const res = await agent
    .get("/api/grades")
    .query({ periodId: PERIOD_ID, q: STUDENT_ID })
    .expect(200);
  expect(res.body.recordsAmount).toBe(1);
  expect(res.body.rows).toHaveLength(1);
  return res.body.rows[0];
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
      students: [{
        id: STUDENT_ID,
        firstName: "Ana",
        lastName: "Alonso",
        birthDate: "2142-01-01",
        birthPlace: "Caracas",
        _class: { id: "z", year: 5 },
        pendingSubjects: [7, 8],
      }],
      subjects: { 4: [7, 9], 5: [7, 8, 10] },
    })
    .expect(200, { loaded: true });
}, 15000);

describe("Standalone final-year floating enrollment endpoints", () => {
  test("loads only the incoming fifth-year z enrollment and its pending subjects", async () => {
    const res = await agent
      .get(`/api/periods/${PERIOD_ID}/students`)
      .expect(200);
    expect(res.body.recordsAmount).toBe(1);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0]).toMatchObject({
      id: STUDENT_ID,
      status: "pending",
      _class: { id: "z", year: 5 },
    });
    const classes = await agent
      .get(`/api/periods/${PERIOD_ID}/classes`)
      .expect(200);
    expect(classes.body).toEqual({
      4: [],
      5: [expect.objectContaining({ name: "z", yearId: 5 })],
    });
    expect(pendingStatuses()).toEqual([
      { subjectId: 7, yearId: 5, status: "failed" },
      { subjectId: 8, yearId: 5, status: "failed" },
    ]);

    const row = await getGrades();
    expect(row).toMatchObject({ yearId: 5, className: "z", floating: true });
    expect(Object.keys(row.subjectDetails)).toEqual(["7", "8"]);
    for (const subject of Object.values(row.subjectDetails)) {
      expect(subject.terms.map((term) => term.length)).toEqual([1, 1, 1, 1]);
    }
  });

  test("marks the standalone enrollment failed when its subjects fail", async () => {
    await agent
      .post("/api/grades/load")
      .send({
        periodId: PERIOD_ID,
        grades: [{
          id: STUDENT_ID,
          yearId: 5,
          subjects: { 7: [[6]], 8: [[8]] },
        }],
      })
      .expect(200, { loaded: 1, skipped: 0 });
    expect((await getGrades()).status).toBe("failed");
    expect(pendingStatuses()).toEqual([
      { subjectId: 7, yearId: 5, status: "failed" },
      { subjectId: 8, yearId: 5, status: "failed" },
    ]);
  });

  test("keeps the enrollment failed after only one pending subject passes", async () => {
    await agent
      .post("/api/grades/load")
      .send({
        periodId: PERIOD_ID,
        grades: [{ id: STUDENT_ID, subjects: { 7: [[], [12]] } }],
      })
      .expect(200, { loaded: 1, skipped: 0 });
    expect((await getGrades()).status).toBe("failed");
    expect(pendingStatuses()).toEqual([
      { subjectId: 7, yearId: 5, status: "passed" },
      { subjectId: 8, yearId: 5, status: "failed" },
    ]);
  });

  test("passes the standalone enrollment when revision clears its last pending subject", async () => {
    await agent
      .post("/api/grades/load")
      .send({
        periodId: PERIOD_ID,
        grades: [{
          id: STUDENT_ID,
          yearId: 5,
          subjects: { 8: [[], [], [], [10]] },
        }],
      })
      .expect(200, { loaded: 1, skipped: 0 });
    const row = await getGrades();
    expect(row.status).toBe("passed");
    expect(row.subjectDetails[8].terms[3]).toEqual([10]);
    expect(pendingStatuses()).toEqual([
      { subjectId: 7, yearId: 5, status: "passed" },
      { subjectId: 8, yearId: 5, status: "passed" },
    ]);
    const res = await agent
      .get(`/api/periods/${PERIOD_ID}/students/${STUDENT_ID}`)
      .expect(200);
    expect(res.body.student).toMatchObject({
      status: "passed",
      _class: { id: "z", year: 5 },
    });
  });
});
