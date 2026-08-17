import supertest from "supertest";
import app from "../../src/app";

const ROOT = "/api/periods";
const PERIOD_ID = "2025";

const students = {
  ana: "V-10000001",
  bruno: "V-10000002",
  carla: "V-10000003",
  diego: "V-10000004",
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
  test("Root returns empty object", async () => {
    const res = await supertest(app).get(ROOT).expect(200);

    expect(res.body).toBeInstanceOf(Object);
    expect(res.body).toHaveLength(0);
  });

  test("Can start a new period", async () => {
    const newPeriod = {
      startYear: 2025,
      endYear: 2026,
      openingDate: "2025-10-10",
    };
    await supertest(app).post(ROOT).send(newPeriod).expect(201);

    const res = await supertest(app).get(ROOT).expect(200);
    expect(res.body[0]).toMatchObject({
      status: "new",
      startYear: 2025,
      endYear: 2026,
      openingDate: "2025-10-10",
    });
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
        status: expect.any(String),
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
      students.ana,
      students.bruno,
      students.carla,
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
    [
      "status",
      { status: "Reprobado" },
      [students.ana, students.bruno, students.carla],
      3,
    ],
    ["page", { page: 2, limit: 2 }, [students.carla], 3],
  ])(
    "Filters students by %s",
    async (_filter, query, expectedIds, recordsAmount) => {
      const res = await supertest(app)
        .get(`${ROOT}/${PERIOD_ID}/students`)
        .query(query)
        .expect(200);

      expect(res.body.rows.map(({ id }) => id).sort()).toEqual(
        [...expectedIds].sort()
      );
      expect(res.body.recordsAmount).toBe(recordsAmount);
    }
  );

  test("Returns enrollment data for an individual period student", async () => {
    const res = await supertest(app)
      .get(`${ROOT}/${PERIOD_ID}/students/${students.ana}`)
      .expect(200);

    expect(res.body.student).toMatchObject({
      id: students.ana,
      status: "Reprobado",
      _class: { id: "A", year: 1 },
    });
    expect(res.body.studentFieldLabels.status).toBe("Estatus del Periodo");
  });

  test("Archives period and starts new one", async () => {
    const newPeriod = {
      status: "new",
      startYear: 2026,
      endYear: 2027,
      openingDate: "2025-10-10",
    };
    expect(
      (
        await supertest(app)
          .post(`${ROOT}/${PERIOD_ID}/archive`)
          .send({ supersede: true })
          .expect(200)
      ).body
    ).toMatchObject(newPeriod);

    const res = await supertest(app).get(ROOT).expect(200);
    expect(res.body[0]).toMatchObject(newPeriod)
    expect(res.body[1]).toMatchObject({
      status: "archived",
      startYear: 2025,
      endYear: 2026,
      openingDate: "2025-10-10",
    });

    await supertest(app)
      .post(`${ROOT}/2026/load`)
      .send({
        students: [
          {
            ...periodStudents[0],
            _class: { id: "C", year: 2 },
          },
          {
            id: students.diego,
            firstName: "Diego",
            lastName: "Delgado",
            birthDate: "2011-11-05",
            birthPlace: "Caracas",
            status: "inactive",
            _class: { id: "D", year: 2 },
          },
        ],
        subjects: { 2: [] },
      })
      .expect(200, { loaded: true });
  });

  test("Returns aggregate statistics in the period model shape", async () => {
    const res = await supertest(app).get(`${ROOT}/all`).expect(200);

    expect(res.body).toEqual({
      id: "all",
      status: null,
      startYear: null,
      endYear: null,
      openingDate: null,
      closingDate: null,
      stats: {
        grades: { total: 0, loaded: 0 },
        students: { total: 5, approved: 0 },
      },
    });
  });

  test("Returns unique students with class data from the loaded period", async () => {
    const res = await supertest(app)
      .get(`${ROOT}/all/students`)
      .expect(200);

    expect(res.body.recordsAmount).toBe(4);
    expect(res.body.studentFieldLabels.status).toBe("Estatus General");
    expect(res.body.rows.map(({ id }) => id)).toEqual([
      students.ana,
      students.bruno,
      students.carla,
      students.diego,
    ]);
    expect(res.body.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: students.ana,
          status: "active",
          _class: { id: "C", year: 2 },
        }),
        expect.objectContaining({
          id: students.bruno,
          status: "active",
          _class: null,
        }),
      ])
    );
  });

  test.each([
    ["year", { year: 2 }, [students.ana, students.diego], 2],
    ["class", { class: "C" }, [students.ana], 1],
    ["status", { status: "inactive" }, [students.diego], 1],
    ["page", { page: 2, limit: 2 }, [students.carla, students.diego], 4],
  ])(
    "Filters all-period students by %s after deduplication",
    async (_filter, query, expectedIds, recordsAmount) => {
      const res = await supertest(app)
        .get(`${ROOT}/all/students`)
        .query(query)
        .expect(200);

      expect(res.body.rows.map(({ id }) => id)).toEqual(expectedIds);
      expect(res.body.recordsAmount).toBe(recordsAmount);
    }
  );

  test("Returns current class data for individual all-period students", async () => {
    const current = await supertest(app)
      .get(`${ROOT}/all/students/${students.ana}`)
      .expect(200);
    const historical = await supertest(app)
      .get(`${ROOT}/all/students/${students.bruno}`)
      .expect(200);

    expect(current.body.student).toMatchObject({
      id: students.ana,
      status: "active",
      _class: { id: "C", year: 2 },
    });
    expect(current.body.studentFieldLabels.status).toBe("Estatus General");
    expect(historical.body.student).toMatchObject({
      id: students.bruno,
      status: "active",
      _class: null,
    });
  });

  test("Returns the largest class list found for each year", async () => {
    const res = await supertest(app)
      .get(`${ROOT}/all/classes`)
      .expect(200);

    expect(res.body[1]).toEqual(["A", "B"]);
    expect(res.body[2]).toEqual(["C", "D"]);
  });
});
