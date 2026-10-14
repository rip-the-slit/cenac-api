const GRADE_SLOTS_PER_TERM = 5;
const STUDENTS_PER_CLASS = 25;

const FIRST_NAMES = [
  "Adriana", "Alejandro", "Alejandra", "Andrés", "Antonella", "Carlos",
  "Carolina", "Daniel", "Daniela", "Diego", "Eduardo", "Eliana",
  "Emmanuel", "Fabiana", "Gabriel", "Gabriela", "Isabella", "Jesús",
  "José", "Katherine", "Luis", "Luisana", "Manuel", "María", "Mariana",
  "Miguel", "Nathalia", "Paola", "Rafael", "Sofía", "Valentina", "Valeria",
];

const LAST_NAMES = [
  "Acosta", "Aponte", "Briceño", "Cárdenas", "Castillo", "Colina", "Díaz",
  "Figueroa", "García", "González", "Hernández", "López", "Martínez",
  "Mendoza", "Morales", "Pérez", "Ramos", "Rodríguez", "Rojas", "Sánchez",
  "Suárez", "Torres", "Vargas", "Zambrano",
];

const BIRTH_PLACES = [
  "Caracas, Distrito Capital", "Maracay, Aragua", "Valencia, Carabobo",
  "Barquisimeto, Lara", "Maracaibo, Zulia", "Maturín, Monagas",
  "Puerto La Cruz, Anzoátegui", "San Cristóbal, Táchira",
];


const SUBJECTS_BY_YEAR = {
  1: [1, 2, 3, 4, 5, 6, 11, 12, 13, 14],
  2: [1, 2, 3, 4, 5, 6, 9, 11, 12, 13, 14],
  3: [1, 2, 3, 4, 5, 7, 8, 9, 11, 12, 13, 14],
  4: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14],
  5: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14],
};

const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomItem = (items) => items[randomInt(0, items.length - 1)];

const dateForAge = (age) => {
  const year = 2025 - age;
  const month = String(randomInt(1, 12)).padStart(2, "0");
  const day = String(randomInt(1, 28)).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const studentId = (yearId, section, position) =>
  `V-${30_000_000 + yearId * 100_000 + section * 1_000 + position}`;

const guardianId = (yearId, section, position) =>
  `V-${12_000_000 + yearId * 100_000 + section * 1_000 + position}`;

/** Adds a full Venezuelan secondary-school period when it is not already present. */
export default function seedPeriodData(db) {
  const periodId = "2025";

  if (db.prepare("SELECT id FROM period WHERE id = ?").get(periodId)) return;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO period (id, status, start_year, end_year, opening_date, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(periodId, "active", 2025, 2026, "2025-09-15", 1);

    for (let yearId = 1; yearId <= 5; yearId++) {
      const yearPeriodId = db.prepare(`
        INSERT INTO year_period (year_id, period_id) VALUES (?, ?)
      `).run(yearId, periodId).lastInsertRowid;
      const yearSubjectIds = SUBJECTS_BY_YEAR[yearId].map((subjectId) => {
        const yearSubjectId = db.prepare(`
          INSERT INTO year_subject (year_period_id, subject_id) VALUES (?, ?)
        `).run(yearPeriodId, subjectId).lastInsertRowid;
        return yearSubjectId;
      });

      for (let section = 1; section <= 2; section++) {
        const classId = db.prepare(`
          INSERT INTO class (name, student_count, year_period_id)
          VALUES (?, ?, ?)
        `).run(
          `${section === 1 ? "A" : "B"}`, STUDENTS_PER_CLASS, yearPeriodId
        ).lastInsertRowid;

        for (let position = 1; position <= STUDENTS_PER_CLASS; position++) {
          const id = studentId(yearId, section, position);
          const lastName = `${randomItem(LAST_NAMES)} ${randomItem(LAST_NAMES)}`;
          db.prepare(`
            INSERT INTO student (id, first_name, last_name, birth_date, birth_place, status)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            id, randomItem(FIRST_NAMES), lastName, dateForAge(11 + yearId + randomInt(0, 1)),
            randomItem(BIRTH_PLACES), "active"
          );

          const representativeId = guardianId(yearId, section, position);
          db.prepare(`
            INSERT INTO guardian (id, first_name, last_name, birth_date, legal_role)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            representativeId, randomItem(FIRST_NAMES), lastName, dateForAge(randomInt(30, 50)),
            randomItem(["Madre", "Padre", "Representante Legal"])
          );
          db.prepare("INSERT INTO student_guardian (student_id, guardian_id) VALUES (?, ?)")
            .run(id, representativeId);
          db.prepare("INSERT INTO student_class (student_id, class_id, status) VALUES (?, ?, ?)")
            .run(id, classId, randomItem(["passed", "passed", "passed", "passed", "pending"]));

          for (const yearSubjectId of yearSubjectIds) {
            for (let term = 1; term <= 3; term++) {
              for (let strategy = 1; strategy <= GRADE_SLOTS_PER_TERM; strategy++) {
                db.prepare(`
                  INSERT INTO grade (term, strategy, value, student_id, year_subject_id)
                  VALUES (?, ?, ?, ?, ?)
                `).run(term, strategy, randomInt(8, 20), id, yearSubjectId);
              }
            }
          }
        }
      }
    }
  });
}
