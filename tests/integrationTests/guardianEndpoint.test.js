import supertest from "supertest";
import app from "../../src/app";

const ROOT = "/api/guardians";
const PERIOD_ROOT = "/api/periods";
const PERIOD_ID = "2040";
const agent = supertest.agent(app);
const coordinator = supertest.agent(app);

const students = [
  {
    id: "V-41000001",
    firstName: "Ana",
    lastName: "Alonso",
    birthDate: "2028-01-10",
    birthPlace: "Caracas",
    _class: { id: "A", year: 1 },
  },
  {
    id: "V-41000002",
    firstName: "Bruno",
    lastName: "Benitez",
    birthDate: "2028-02-10",
    birthPlace: "Valencia",
    _class: { id: "A", year: 1 },
  },
];

const guardians = [
  {
    id: "V-21000001",
    firstName: "Maria",
    lastName: "Alonso",
    birthDate: "1985-03-20",
    legalRole: "Madre",
    phone: "0412-1111111",
    address: "Caracas Norte",
  },
  {
    id: "V-21000002",
    firstName: "Carlos",
    lastName: "Benitez",
    birthDate: "1982-04-21",
    legalRole: "Padre",
    phone: "0414-2222222",
    address: "Valencia Centro",
  },
  {
    id: "V-21000003",
    firstName: "Luisa",
    lastName: "Castro",
    birthDate: "1990-05-22",
    legalRole: "Representante Legal",
    phone: "0424-3333333",
    address: "Maracay Sur",
  },
];

beforeAll(async () => {
  await agent
    .post("/api/users/login")
    .send({ id: 1, password: "1234" })
    .expect(200);
  await coordinator
    .post("/api/users/login")
    .send({ id: 2, password: "1234" })
    .expect(200);

  await agent
    .post(PERIOD_ROOT)
    .send({
      startYear: Number(PERIOD_ID),
      endYear: Number(PERIOD_ID) + 1,
      openingDate: `${PERIOD_ID}-09-01`,
    })
    .expect(201);
  for (const guardian of guardians) {
    await agent.post(ROOT).send(guardian).expect(201);
  }

  await agent
    .post(PERIOD_ROOT + "/" + PERIOD_ID + "/load")
    .send({
      students: [
        { ...students[0], assignedGuardians: [guardians[0]] },
        { ...students[1], assignedGuardians: [guardians[0], guardians[1]] },
      ],
      subjects: { 1: [] },
    })
    .expect(200, { loaded: true });
});

describe("Guardian Endpoint", () => {
  test("requires authentication", async () => {
    await supertest(app).get(ROOT).expect(401);
  });

  test("returns guardians with all assigned students", async () => {
    const res = await agent.get(ROOT).expect(200);

    expect(res.body.recordsAmount).toBe(3);
    expect(res.body.fields).toMatchObject({
      id: { label: "Cédula", type: "text" },
      assignedStudents: { label: "Estudiantes Asignados", type: "text" },
    });
    expect(
      res.body.rows.find(({ id }) => id === guardians[0].id).assignedStudents
    ).toHaveLength(2);
  });

  test("filters guardians by period-active students", async () => {
    const res = await agent
      .get(ROOT)
      .query({ periodId: PERIOD_ID })
      .expect(200);

    expect(res.body.recordsAmount).toBe(2);
    expect(res.body.rows.map(({ id }) => id)).toEqual([
      guardians[0].id,
      guardians[1].id,
    ]);
  });

  test.each([
    ["id", { id: "21000001" }, guardians[0].id],
    ["first name", { firstName: "maria" }, guardians[0].id],
    ["last name", { lastName: "benitez" }, guardians[1].id],
    ["birth date", { dateOfBirth: "1990-05" }, guardians[2].id],
    ["legal role", { legalRole: "padre" }, guardians[1].id],
    ["phone", { phone: "3333333" }, guardians[2].id],
    ["address", { address: "caracas norte" }, guardians[0].id],
    ["q by id", { q: "21000002" }, guardians[1].id],
    ["q by name", { q: "maria alonso" }, guardians[0].id],
  ])("filters by %s", async (_name, query, expectedId) => {
    const res = await agent.get(ROOT).query(query).expect(200);

    expect(res.body.recordsAmount).toBe(1);
    expect(res.body.rows[0].id).toBe(expectedId);
  });

  test("filters by student q without trimming assigned students", async () => {
    const res = await agent
      .get(ROOT)
      .query({ studentQ: "ana alonso" })
      .expect(200);

    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].id).toBe(guardians[0].id);
    expect(res.body.rows[0].assignedStudents).toHaveLength(2);
  });

  test("paginates guardians rather than joined rows", async () => {
    const res = await agent
      .get(ROOT)
      .query({ page: 2, limit: 1 })
      .expect(200);

    expect(res.body.recordsAmount).toBe(3);
    expect(res.body.rows).toHaveLength(1);
  });

  test("returns a guardian by id with assignments", async () => {
    const res = await agent
      .get(`${ROOT}/${guardians[0].id}`)
      .expect(200);

    expect(res.body.guardian).toMatchObject({ ...guardians[0], legalRole: null });
    expect(res.body.guardian.assignedStudents).toHaveLength(2);
    expect(res.body.fields.legalRole).toMatchObject({
      label: "Rol Legal",
      type: "select",
      required: true,
      options: expect.arrayContaining([{ value: "Madre", label: "Madre" }]),
    });
    expect(res.body).not.toHaveProperty("guardianFieldLabels");
  });

  test("allows a coordinator to update guardian fields", async () => {
    const res = await coordinator
      .post(`${ROOT}/${guardians[2].id}/edit`)
      .send({ phone: "0426-9999999", address: "Maracay Centro" })
      .expect(200);

    expect(res.body).toMatchObject({
      id: guardians[2].id,
      phone: "0426-9999999",
      address: "Maracay Centro",
    });
  });

});
