import supertest from "supertest";
import app from "../../src/app";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs/dist/bcrypt.js";
import { parseCookie } from "../../src/controllers/httpUtils";

const ROOT = "/api/users";
const agent = supertest.agent(app);

describe("User Endpoint", () => {
  test("Root returns user list", async () => {
    const res = await agent.get(ROOT).expect(200);

    expect(res.body).toBeInstanceOf(Object);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      id: expect.any(Number),
      name: expect.any(String),
      userLevel: expect.any(String),
    });
  });
  test("Login returns jwt", async () => {
    const res = await agent
      .post(`${ROOT}/login`)
      .send({ id: 1, password: "1234" })
      .expect(200);

    expect(
      jwt.verify(parseCookie(res.headers["set-cookie"][0]).token, process.env.JWT_SECRET)
    ).toMatchObject({
      id: expect.any(Number),
      name: expect.any(String),
      userLevel: expect.any(String),
    });
  });
  test("Registration creates new user", async () => {
    const res = await agent
      .post(`${ROOT}/register`)
      .send({ name: "Maria", password: "1234", userLevel: "Profesor" })
      .expect(200);

    expect(res.body).toMatchObject({
      id: expect.any(Number),
      name: "Maria",
      userLevel: "Profesor",
    });
    expect(res.body).not.toHaveProperty("password", "1234");

    const users = (await agent.get(ROOT).expect(200)).body;
    expect(users).toHaveLength(3);
    expect(users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: res.body.id, name: "Maria" }),
      ])
    );
  });

  test("Allows editing of users", async () => {
    const users = (await agent.get(ROOT).expect(200)).body;

    const res = await agent
      .post(`${ROOT}/${users[2].id}/edit`)
      .send({
        name: "Mary",
        password: "12345",
        userLevel: "Administrador",
      })
      .expect(200);

    expect(res.body).toMatchObject({
      id: users[2].id,
      name: "Mary",
      userLevel: "Administrador",
    });
    await agent
      .post(`${ROOT}/login`)
      .send({ id: users[2].id, password: "12345" })
      .expect(200);
    await agent
      .post(`${ROOT}/login`)
      .send({ id: 1, password: "1234" })
      .expect(200);
  });

  test("Allows deleting users except itself", async () => {
    const users = (await agent.get(ROOT).expect(200)).body;
    const otherUser = users.find(({ id }) => id !== 1);

    expect((await agent.post(`${ROOT}/${otherUser.id}/delete`).expect(200)).body).toBe(true);
    await agent.post(`${ROOT}/1/delete`).expect(403);

    const remainingUsers = (await agent.get(ROOT).expect(200)).body;
    expect(remainingUsers.some(({ id }) => id === otherUser.id)).toBe(false);
    expect(remainingUsers.some(({ id }) => id === 1)).toBe(true);
  });

  test("Logout deactivates cookie", async () => {
    const res = await agent.post(`${ROOT}/logout`).expect(200);
    expect(res.body).toBe(true);
    const cookie = res.headers["set-cookie"][0];

    expect(parseCookie(cookie).token).toBe("");
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/i);
  });
});
