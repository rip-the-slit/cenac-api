import supertest from "supertest";
import app from "../../src/app";

const ROOT = "/api/grades";
const PERIOD_ID = "2090";

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
        fullName: expect.any(String),
        status: expect.any(String),
        class: expect.any(String),
        grades: expect.any(String),
      },
      years: expect.any(Array),
      classesByYear: expect.any(Object),
      subjects: expect.any(Array),
      subjectsByYear: expect.any(Object),
      statuses: expect.any(Array),
    });
    res.body.rows.forEach((row) =>
      expect(row).toMatchObject({
        id: expect.any(String),
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
          status: "Aprobado",
          subjectAverages: { 1: 17 },
        }),
        expect.objectContaining({
          id: students.bruno,
          status: "Reprobado",
          subjectAverages: { 1: 7 },
        }),
      ])
    );
  });

  test.each([
    ["year", { yearId: 2 }, [students.carla], 1],
    ["class", { classId: "B" }, [students.bruno], 1],
    ["status", { status: "Aprobado" }, [students.ana], 1],
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
});
