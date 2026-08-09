import supertest from "supertest";
import app from "../../src/app";

const ROOT = "/api/periods";
const PERIOD_ID = "2025";

const students = {
  ana: "V-10000001",
  bruno: "V-10000002",
  carla: "V-10000003",
};

const periodStudents = [
  {
    id: students.ana,
    firstName: "Ana",
    lastName: "Alonso",
    birthDate: "2012-01-10",
    birthPlace: "Caracas",
    _class: { id: "A", year: 1 },
  },
  {
    id: students.bruno,
    firstName: "Bruno",
    lastName: "Benitez",
    birthDate: "2011-06-20",
    birthPlace: "Maracaibo",
    _class: { id: "B", year: 1 },
  },
  {
    id: students.carla,
    firstName: "Carla",
    lastName: "Castro",
    birthDate: "2010-09-15",
    birthPlace: "Valencia",
    _class: { id: "A", year: 2 },
  },
];

describe("Period Endpoint", () => {
  test("Root returns empty array", async () => {
    const res = await supertest(app).get(ROOT).expect(200);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body).toHaveLength(0);
  });

  test("Can start a new period", async () => {
    await supertest(app)
      .post(ROOT)
      .send({
        startYear: 2025,
        endYear: 2026,
        openingDate: "2025-10-10",
      })
      .expect(201);

    const res = await supertest(app).get(ROOT).expect(200);
    expect(res.body).toContain(PERIOD_ID);
  });

  test("Loads the period students", async () => {
    await supertest(app)
      .post(`${ROOT}/${PERIOD_ID}/load`)
      .send({
        students: periodStudents,
        subjects: { 1: [], 2: [] },
      })
      .expect(200, { loaded: true });
  });

  test("Returns the students in the period", async () => {
    const res = await supertest(app)
      .get(`${ROOT}/${PERIOD_ID}/students`)
      .expect(200);

    expect(res.body).toMatchObject({
      rows: expect.any(Array),
      recordsAmount: expect.any(Number),
      years: expect.any(Array),
      classesByYear: expect.any(Object),
      studentFieldLabels: {
        id: expect.any(String),
        firstName: expect.any(String),
        lastName: expect.any(String),
        birthDate: expect.any(String),
        birthPlace: expect.any(String),
      },
    });
    res.body.rows.forEach((row) =>
      expect(row).toMatchObject({
        id: expect.any(String),
        firstName: expect.any(String),
        lastName: expect.any(String),
        birthDate: expect.any(String),
        birthPlace: expect.any(String),
        status: expect.any(String),
        _class: { id: expect.any(String), year: expect.any(Number) },
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
          firstName: "Ana",
          lastName: "Alonso",
          _class: { id: "A", year: 1 },
        }),
      ])
    );
  });

  test.each([
    ["id", { id: "10000001" }, [students.ana], 1],
    ["first name", { firstName: "ana" }, [students.ana], 1],
    ["last name", { lastName: "benitez" }, [students.bruno], 1],
    ["birth date", { dateOfBirth: "2010-09" }, [students.carla], 1],
    ["birth place", { birthPlace: "maracaibo" }, [students.bruno], 1],
    ["year", { year: 2 }, [students.carla], 1],
    ["class", { class: "B" }, [students.bruno], 1],
    ["page", { page: 2, limit: 2 }, [students.carla], 3],
  ])("Filters students by %s", async (_filter, query, expectedIds, recordsAmount) => {
    const res = await supertest(app)
      .get(`${ROOT}/${PERIOD_ID}/students`)
      .query(query)
      .expect(200);

    expect(res.body.rows.map(({ id }) => id).sort()).toEqual(
      [...expectedIds].sort()
    );
    expect(res.body.recordsAmount).toBe(recordsAmount);
  });
});
