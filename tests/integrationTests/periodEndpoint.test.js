import supertest from "supertest";
import app from "../../src/app";
import YearRepository from "../../src/repositories/YearRepository.js";
const agent = supertest.agent(app);

const ROOT = "/api/periods";
const PERIOD_ID = "2025";

const students = {
  ana: "V-10000001",
  bruno: "V-10000002",
  carla: "V-10000003",
  diego: "V-10000004",
};

const periodGuardians = [
  {
    id: "V-22000001",
    firstName: "Maria",
    lastName: "Benitez",
    birthDate: "1980-01-01",
    legalRole: "Madre",
    phone: "0412-0000001",
    address: "Caracas",
  },
  {
    id: "V-22000002",
    firstName: "Carlos",
    lastName: "Benitez",
    birthDate: "1979-01-01",
    legalRole: "Padre",
    phone: "0412-0000002",
    address: "Caracas",
  },
];

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

beforeAll(async () => {
  await agent
    .post("/api/users/login")
    .send({ id: 1, password: "1234" })
    .expect(200);
});

describe("Period Endpoint", () => {
  test("Finds countries, states and municipalities by name and parent place", async () => {
    const countries = await agent
      .get(`${ROOT}/places`)
      .query({ type: "country", q: "Venezuela" })
      .expect(200);
    expect(countries.body.rows).toEqual([
      expect.objectContaining({ iso2: "VE", name: "Venezuela" }),
    ]);
    expect(countries.body.recordsAmount).toBe(1);

    const states = await agent
      .get(`${ROOT}/places`)
      .query({ type: "state", country: "VE", q: "Miranda" })
      .expect(200);
    expect(states.body.rows).toEqual([
      expect.objectContaining({
        id: expect.any(Number),
        country: "VE",
        name: "Miranda",
      }),
    ]);

    const state = states.body.rows[0].id;
    const municipalities = await agent
      .get(`${ROOT}/places`)
      .query({ type: "municipality", country: "VE", state, q: "Sucre" })
      .expect(200);
    expect(municipalities.body.recordsAmount).toBeGreaterThan(0);
    expect(municipalities.body.rows.length).toBe(
      municipalities.body.recordsAmount
    );
    for (const municipality of municipalities.body.rows) {
      expect(municipality).toMatchObject({
        country: "VE",
        state,
        name: expect.stringMatching(/sucre/i),
      });
    }
  });

  test("Root returns empty object", async () => {
    const res = await agent.get(ROOT).expect(200);

    expect(res.body).toBeInstanceOf(Object);
    expect(res.body).toHaveLength(0);
  });

  test("Can start a new period", async () => {
    const newPeriod = {
      startYear: 2025,
      endYear: 2026,
      openingDate: "2025-10-10",
    };
    await agent.post(ROOT).send(newPeriod).expect(201);

    const res = await agent.get(ROOT).expect(200);
    expect(res.body[0]).toMatchObject({
      status: "new",
      startYear: 2025,
      endYear: 2026,
      openingDate: "2025-10-10",
      userId: 1,
    });
  });

  test("Loads the period students", async () => {
    for (const guardian of periodGuardians) {
      await agent.post("/api/guardians").send(guardian).expect(201);
    }

    await agent
      .post(`${ROOT}/${PERIOD_ID}/load`)
      .send({
        students: periodStudents.map((student) => ({
          ...student,
          ...(student.id === students.bruno
            ? { assignedGuardians: periodGuardians }
            : {}),
        })),
        subjects: { 1: [], 2: [] },
      })
      .expect(200, { loaded: true });

    expect(
      YearRepository.findAllAssignedClassesByPeriod(PERIOD_ID).map(
        ({ name, studentCount, yearId }) => ({ name, studentCount, yearId })
      )
    ).toEqual([
      { name: "A", studentCount: 1, yearId: 1 },
      { name: "B", studentCount: 1, yearId: 1 },
      { name: "A", studentCount: 1, yearId: 2 },
    ]);
  });

  test("Returns complete class rows grouped by year", async () => {
    const res = await agent.get(`${ROOT}/${PERIOD_ID}/classes`).expect(200);
    const classes = YearRepository.findAllAssignedClassesByPeriod(PERIOD_ID);
    expect(res.body).toEqual({
      1: classes.filter(({ yearId }) => yearId === 1),
      2: classes.filter(({ yearId }) => yearId === 2),
    });
    expect(res.body[1][0]).toMatchObject({
      id: expect.any(Number),
      name: "A",
      studentCount: 1,
      yearPeriodId: expect.any(Number),
      yearId: 1,
      periodId: PERIOD_ID,
    });
  });

  test("Returns the students in the period", async () => {
    const res = await agent.get(`${ROOT}/${PERIOD_ID}/students`).expect(200);

    expect(res.body).toMatchObject({
      rows: expect.any(Array),
      recordsAmount: expect.any(Number),
      years: expect.any(Array),
      classesByYear: expect.any(Object),
      statuses: [
        { value: "pending", name: "Pendiente" },
        { value: "passed", name: "Aprobado" },
        { value: "failed", name: "Reprobado" },
      ],
      fields: {
        id: { label: "Cédula", type: "text" },
        firstName: { label: "Nombres", type: "text" },
        lastName: { label: "Apellidos", type: "text" },
        birthDate: { label: "Fecha de Nacimiento", type: "text" },
        birthPlace: { label: "Lugar de Nacimiento", type: "text" },
        status: { label: "Estatus del Periodo", type: "select" },
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
    expect(res.body.years).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, abbr: "1er" }),
        expect.objectContaining({ id: 2, abbr: "2do" }),
      ])
    );
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
    [
      "multiple first names",
      { firstName: "ana OR carla OR nobody" },
      [students.ana, students.carla],
      2,
    ],
    ["last name", { lastName: "benitez" }, [students.bruno], 1],
    ["birth date", { dateOfBirth: "2010-09" }, [students.carla], 1],
    ["birthDate field", { birthDate: "2010-09" }, [students.carla], 1],
    ["birth place", { birthPlace: "maracaibo" }, [students.bruno], 1],
    ["year", { year: 2 }, [students.carla], 1],
    ["class", { class: "B" }, [students.bruno], 1],
    [
      "pending",
      { status: "pending" },
      [students.ana, students.bruno, students.carla],
      3,
    ],
    ["page", { page: 2, limit: 2 }, [students.carla], 3],
  ])(
    "Filters students by %s",
    async (_filter, query, expectedIds, recordsAmount) => {
      const res = await agent
        .get(`${ROOT}/${PERIOD_ID}/students`)
        .query(query)
        .expect(200);

      expect(res.body.rows.map(({ id }) => id).sort()).toEqual(
        [...expectedIds].sort()
      );
      expect(res.body.recordsAmount).toBe(recordsAmount);
    }
  );

  test("Filters students by guardian and returns every assignment", async () => {
    const res = await agent
      .get(`${ROOT}/${PERIOD_ID}/students`)
      .query({ guardianQ: "carlos benitez" })
      .expect(200);

    expect(res.body.recordsAmount).toBe(1);
    expect(res.body.rows[0].id).toBe(students.bruno);
    expect(res.body.rows[0].assignedGuardians).toHaveLength(2);
  });

  test("Returns enrollment data for an individual period student", async () => {
    const res = await agent
      .get(`${ROOT}/${PERIOD_ID}/students/${students.ana}`)
      .expect(200);

    expect(res.body.student).toMatchObject({
      id: students.ana,
      status: "pending",
      _class: { id: "A", year: 1 },
    });
  });

  test("Archives period and starts new one", async () => {
    const newPeriod = {
      status: "new",
      startYear: 2026,
      endYear: 2027,
      openingDate: "2025-10-10",
      userId: 1,
    };
    expect(
      (
        await agent
          .post(`${ROOT}/${PERIOD_ID}/archive`)
          .send({ supersede: true })
          .expect(200)
      ).body
    ).toMatchObject(newPeriod);

    const res = await agent.get(ROOT).expect(200);
    expect(res.body[0]).toMatchObject(newPeriod);
    expect(res.body[1]).toMatchObject({
      status: "archived",
      startYear: 2025,
      endYear: 2026,
      openingDate: "2025-10-10",
      userId: 1,
    });

    await agent
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

  test("Returns suggestions only for students with an available next year", async () => {
    const res = await agent.get(`${ROOT}/suggestions`).expect(200);

    expect(res.body.students).toEqual([
      expect.objectContaining({
        id: students.ana,
        firstName: "Ana",
        lastName: "Alonso",
        _class: expect.objectContaining({ id: "A", year: 2 }),
      }),
      expect.objectContaining({
        id: students.bruno,
        firstName: "Bruno",
        lastName: "Benitez",
        _class: expect.objectContaining({ id: "B", year: 2 }),
      }),
    ]);
    expect(res.body.students).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: students.carla })])
    );
  });

  test("Returns the suggestion form templates and Spanish field labels", async () => {
    const res = await agent.get(`${ROOT}/suggestions`).expect(200);

    expect(res.body).toMatchObject({
      studentClass: {
        id: "",
        firstName: "",
        lastName: "",
        birthDate: "",
        birthPlace: "",
        _locked: false,
        _class: { id: "", year: null },
      },
      guardianClass: {
        id: "",
        firstName: "",
        lastName: "",
        birthDate: "",
        legalRole: "",
        phone: "",
        address: "",
      },
      fields: {
        student: {
          id: { label: "Cédula", type: "text", required: true },
          firstName: {
            label: "Nombres",
            type: "text",
            required: true,
            maxLength: 80,
          },
          lastName: { label: "Apellidos", type: "text", required: true },
          birthDate: {
            label: "Fecha de Nacimiento",
            type: "date",
            required: true,
          },
          birthPlace: {
            label: "Lugar de Nacimiento",
            type: "text",
            required: true,
          },
        },
        guardian: {
          legalRole: {
            type: "select",
            required: true,
            default: "Madre",
            options: [
              { value: "Madre", label: "Madre" },
              { value: "Padre", label: "Padre" },
              { value: "Representante Legal", label: "Representante Legal" },
            ],
          },
        },
      },
    });
  });

  test("Returns aggregate statistics in the period model shape", async () => {
    const res = await agent.get(`${ROOT}/all`).expect(200);

    expect(res.body).toEqual({
      id: "all",
      status: null,
      startYear: null,
      endYear: null,
      openingDate: null,
      userId: null,
      stats: {
        grades: { total: 0, loaded: 0 },
        students: { total: 5, passed: 0 },
      },
    });
  });

  test("Returns unique students with class data from the loaded period", async () => {
    const res = await agent.get(`${ROOT}/all/students`).expect(200);

    expect(res.body.recordsAmount).toBe(4);
    expect(res.body.fields.status.label).toBe("Estatus General");
    expect(res.body.statuses).toEqual([
      { value: "active", name: "Activo" },
      { value: "inactive", name: "Inactivo" },
    ]);
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
          status: "inactive",
          _class: null,
        }),
        expect.objectContaining({
          id: students.carla,
          status: "inactive",
          _class: null,
        }),
        expect.objectContaining({
          id: students.diego,
          status: "active",
          _class: { id: "D", year: 2 },
        }),
      ])
    );
  });

  test.each([
    ["year", { year: 2 }, [students.ana, students.diego], 2],
    ["class", { class: "C" }, [students.ana], 1],
    ["status", { status: "inactive" }, [students.bruno, students.carla], 2],
    ["page", { page: 2, limit: 2 }, [students.carla, students.diego], 4],
  ])(
    "Filters all-period students by %s after deduplication",
    async (_filter, query, expectedIds, recordsAmount) => {
      const res = await agent
        .get(`${ROOT}/all/students`)
        .query(query)
        .expect(200);

      expect(res.body.rows.map(({ id }) => id)).toEqual(expectedIds);
      expect(res.body.recordsAmount).toBe(recordsAmount);
    }
  );

  test("Returns current class data for individual all-period students", async () => {
    const current = await agent
      .get(`${ROOT}/all/students/${students.ana}`)
      .expect(200);
    const historical = await agent
      .get(`${ROOT}/all/students/${students.bruno}`)
      .expect(200);

    expect(current.body.student).toMatchObject({
      id: students.ana,
      status: "active",
      _class: { id: "C", year: 2 },
    });
    expect(historical.body.student).toMatchObject({
      id: students.bruno,
      status: "inactive",
      _class: null,
    });
  });

  test("Allows a coordinator to update student fields", async () => {
    const coordinator = supertest.agent(app);
    await coordinator
      .post("/api/users/login")
      .send({ id: 2, password: "1234" })
      .expect(200);

    const fields = {
      firstName: "Carolina",
      lastName: "Perez",
      birthDate: "2010-10-20",
      birthPlace: "Maracay",
    };
    const updated = await coordinator
      .post(`${ROOT}/${PERIOD_ID}/students/${students.carla}/edit`)
      .send(fields)
      .expect(200);
    expect(updated.body).toMatchObject({ id: students.carla, ...fields });

    const detail = await coordinator
      .get(`${ROOT}/${PERIOD_ID}/students/${students.carla}`)
      .expect(200);
    expect(detail.body.student).toMatchObject({
      id: students.carla,
      ...fields,
    });
  });

  test("Returns the largest class list found for each year", async () => {
    const res = await agent.get(`${ROOT}/all/classes`).expect(200);

    expect(res.body[1].map(({ name }) => name)).toEqual(["A", "B"]);
    expect(res.body[2].map(({ name }) => name)).toEqual(["C", "D"]);
  });
});
