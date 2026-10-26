import db from "../src/config/db.js";

afterAll(() => db.close());
