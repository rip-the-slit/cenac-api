import supertest from "supertest";
import app from "../../src/app";

const ROOT = "/api/grades";
const PERIOD_ID = "2090";
const NEXT_PERIOD_ID = "2091";

const students = {
  ana: "V-10000001",
  bruno: "V-10000002",
  carla: "V-10000003",
};

beforeAll(async () => {
  await supertest(app)
    .post("/api/periods")
    .send({
      startYear: Number(PERIOD_ID),
      endYear: Number(PERIOD_ID) + 1,
      openingDate: `${PERIOD_ID}-09-01`,
    })
    .expect(201);

  await supertest(app)
    .post(`/api/periods/${PERIOD_ID}/load`)
    .send({
      students: [
        {
          id: students.ana,
          firstName: "Ana",
          lastName: "Alonso",
          birthDate: "2078-01-01",
          birthPlace: "Caracas",
          _class: { id: "A", year: 1 },
        },
        {
          id: students.bruno,
          firstName: "Bruno",
          lastName: "Benitez",
          birthDate: "2078-02-01",
          birthPlace: "Caracas",
          _class: { id: "B", year: 1 },
        },
        {
          id: students.carla,
          firstName: "Carla",
          lastName: "Castro",
          birthDate: "2078-03-01",
          birthPlace: "Caracas",
          _class: { id: "A", year: 2 },
        },
      ],
      subjects: { 1: [1], 2: [3] },
    })
    .expect(200, { loaded: true });
});

describe("Grade Endpoint", () => {
  test("loads grades", async () => {
    const grades = [
      { id: students.ana, subjects: { 1: [[18, 16]] } },
      { id: students.bruno, subjects: { 1: [[8, 6]] } },
    ];

    const res = await supertest(app)
      .post(`${ROOT}/load`)
      .send({ periodId: PERIOD_ID, grades })
      .expect(200);

    expect(res.body).toEqual({ loaded: 2, skipped: 0 });
  });

  test("returns the loaded grades", async () => {
    const res = await supertest(app)
      .get(ROOT)
      .query({ periodId: PERIOD_ID })
      .expect(200);

    expect(res.body).toMatchObject({
      rows: expect.any(Array),
      recordsAmount: expect.any(Number),
      studentGradesFieldLabels: {
        id: expect.any(String),
        period: "Periodo Escolar",
        fullName: expect.any(String),
        status: expect.any(String),
        class: expect.any(String),
        grades: expect.any(String),
      },
      years: expect.any(Array),
      classesByYear: expect.any(Object),
      subjects: expect.any(Array),
      subjectsByYear: expect.any(Object),
      statuses: [
        { value: "pending", name: "Pendiente" },
        { value: "passed", name: "Aprobado" },
        { value: "failed", name: "Reprobado" },
      ],
    });
    res.body.rows.forEach((row) =>
      expect(row).toMatchObject({
        id: expect.any(String),
        period: Number(PERIOD_ID),
        fullName: expect.any(String),
        status: expect.any(String),
        class: expect.any(String),
        grades: expect.any(Object),
        subjectAverages: expect.any(Object),
        subjectDetails: expect.any(Object),
      })
    );
    expect(res.body.rows).toHaveLength(3);
    expect(res.body.recordsAmount).toBe(3);
    expect(res.body.rows.map(({ id }) => id)).toEqual([
      students.ana, students.bruno, students.carla,
    ]);
    expect(res.body.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: students.ana,
          fullName: "Alonso Ana",
          period: Number(PERIOD_ID),
          status: "passed",
          subjectAverages: { 1: 17 },
        }),
        expect.objectContaining({
          id: students.bruno,
          status: "failed",
          subjectAverages: { 1: 7 },
        }),
        expect.objectContaining({
          id: students.carla,
          subjectAverages: { 3: null },
          subjectDetails: {
            3: {
              avg: null,
              terms: [
                [null, null, null, null, null],
                [null, null, null, null, null],
                [null, null, null, null, null],
              ],
              termAverages: [null, null, null],
            },
          },
        }),
      ])
    );
  });

  test.each([
    ["year", { yearId: 2 }, [students.carla], 1],
    ["class", { classId: "B" }, [students.bruno], 1],
    ["status", { status: "passed" }, [students.ana], 1],
    ["name", { q: "ana alonso" }, [students.ana], 1],
    ["page", { page: 1, limit: 2 }, [students.ana, students.bruno], 3],
  ])("filters by %s", async (_filter, query, expectedIds, recordsAmount) => {
    const res = await supertest(app)
      .get(ROOT)
      .query({ periodId: PERIOD_ID, ...query })
      .expect(200);

    expect(res.body.rows.map(({ id }) => id).sort()).toEqual(
      [...expectedIds].sort()
    );
    expect(res.body.recordsAmount).toBe(recordsAmount);
  });

  test("returns separate grade rows for each period when periodId is all", async () => {
    await supertest(app)
      .post(`/api/periods/${PERIOD_ID}/archive`)
      .send({ supersede: true })
      .expect(200);
    await supertest(app)
      .post(`/api/periods/${NEXT_PERIOD_ID}/load`)
      .send({
        students: [
          {
            id: students.ana,
            firstName: "Ana",
            lastName: "Alonso",
            birthDate: "2078-01-01",
            birthPlace: "Caracas",
            _class: { id: "C", year: 2 },
          },
        ],
        subjects: { 2: [3] },
      })
      .expect(200, { loaded: true });
    await supertest(app)
      .post(`${ROOT}/load`)
      .send({
        periodId: NEXT_PERIOD_ID,
        grades: [{ id: students.ana, subjects: { 3: [[14]] } }],
      })
      .expect(200, { loaded: 1, skipped: 0 });

    const res = await supertest(app)
      .get(ROOT)
      .query({ periodId: "all" })
      .expect(200);
    const anaRows = res.body.rows.filter(({ id }) => id === students.ana);

    expect(res.body.recordsAmount).toBe(4);
    expect(res.body.studentGradesFieldLabels.period).toBe(
      "Periodo Escolar"
    );
    expect(res.body.rows).toHaveLength(4);
    expect(anaRows).toHaveLength(2);
    expect(anaRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          period: Number(PERIOD_ID),
          subjectAverages: expect.objectContaining({ 1: 17 }),
        }),
        expect.objectContaining({
          period: Number(NEXT_PERIOD_ID),
          subjectAverages: expect.objectContaining({ 3: 14 }),
        }),
      ])
    );
    expect(res.body.years).toHaveLength(5);
    expect(res.body.subjects).toHaveLength(14);
    for (const year of res.body.years) {
      expect(res.body.subjectsByYear[year.id]).toEqual(
        res.body.subjects.map(({ id }) => id)
      );
    }

    const filtered = await supertest(app)
      .get(ROOT)
      .query({ periodId: "all", q: "ana alonso" })
      .expect(200);
    expect(filtered.body.recordsAmount).toBe(2);
    expect(filtered.body.rows.map(({ period }) => period).sort()).toEqual([
      Number(PERIOD_ID),
      Number(NEXT_PERIOD_ID),
    ]);

    const paged = await supertest(app)
      .get(ROOT)
      .query({ periodId: "all", page: 1, limit: 2 })
      .expect(200);
    expect(paged.body.recordsAmount).toBe(4);
    expect(paged.body.rows).toHaveLength(2);
  });
});
