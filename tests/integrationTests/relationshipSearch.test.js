import supertest from "supertest";
import app from "../../src/app.js";

const agent = supertest.agent(app);
const periodId = "2098";
const guardian = { id: "V-500", firstName: "María", lastName: "Pérez", address: "Avenida Bolívar" };

beforeAll(async () => {
  await agent.post("/api/users/login").send({ id: 1, password: "1234" }).expect(200);
  await agent.post("/api/guardians").send(guardian).expect(201);
  await agent.post("/api/periods").send({ startYear: 2098, endYear: 2099, openingDate: "2098-09-01" }).expect(201);
  await agent.post(`/api/periods/${periodId}/load`).send({
    subjects: { 1: [1] },
    students: [
      { id: "V-100", firstName: "José", lastName: "Gómez", birthDate: "2012-01-01", birthPlace: "Mérida", _class: { id: "A", year: 1 }, assignedGuardians: [{ id: guardian.id, legalRole: "Madre" }] },
      { id: "V-1000", firstName: "José Antonio", lastName: "Gómez", birthDate: "2012-01-01", birthPlace: "Mérida Norte", _class: { id: "A", year: 1 }, assignedGuardians: [{ id: guardian.id, legalRole: "Representante Legal" }] },
    ],
  }).expect(200);
});

test("keeps legal roles on each relationship in both directions and syncs changes", async () => {
  let res = await agent.get(`/api/guardians/${guardian.id}`).expect(200);
  expect(res.body.guardian.assignedStudents).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "V-100", legalRole: "Madre" }),
    expect.objectContaining({ id: "V-1000", legalRole: "Representante Legal" }),
  ]));
  res = await agent.get(`/api/periods/${periodId}/students/V-100`).expect(200);
  expect(res.body.student.assignedGuardians[0]).toMatchObject({ id: guardian.id, legalRole: "Madre" });
  await agent.post(`/api/periods/${periodId}/students/V-100/edit`).send({ assignedGuardians: [{ id: guardian.id, legalRole: "Padre" }] }).expect(200);
  res = await agent.get(`/api/guardians/${guardian.id}`).expect(200);
  expect(res.body.guardian.assignedStudents).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "V-100", legalRole: "Padre" }),
    expect.objectContaining({ id: "V-1000", legalRole: "Representante Legal" }),
  ]));
});

test("folds student names and places and supports exact filters including q in grades", async () => {
  for (const query of [{ firstName: "jose" }, { q: "gomez" }, { birthPlace: "merida" }, { guardianQ: "maria" }]) {
    const res = await agent.get(`/api/periods/${periodId}/students`).query(query).expect(200);
    expect(res.body.recordsAmount).toBe(2);
  }
  for (const [key, value] of [["id", "V-100"], ["firstName", "José"], ["birthPlace", "Mérida"], ["q", "V-100"]]) {
    const query = { [key]: value, [`exact[${key}]`]: true };
    const students = await agent.get(`/api/periods/${periodId}/students`).query(query).expect(200);
    expect(students.body.rows.map(({ id }) => id)).toEqual(["V-100"]);
    const grades = await agent.get("/api/grades").query({ periodId, ...query }).expect(200);
    expect(grades.body.rows.map(({ id }) => id)).toEqual(["V-100"]);
  }
});

test("folds guardian names and addresses and matches nested student names exactly", async () => {
  for (const query of [{ firstName: "maria" }, { address: "bolivar" }, { q: "perez" }, { studentQ: "jose" }]) {
    const res = await agent.get("/api/guardians").query(query).expect(200);
    expect(res.body.rows.map(({ id }) => id)).toEqual([guardian.id]);
  }
  const res = await agent.get("/api/guardians").query({ studentFirstName: "jose an", "exact[studentFirstName]": true }).expect(200);
  expect(res.body.recordsAmount).toBe(0);
});
