const GRADE_SLOTS_PER_TERM = 5;

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

const TEACHERS = [
  ["V-11234567", "Maritza", "Gómez", "Licenciada en Educación, mención Castellano"],
  ["V-12345678", "José", "Márquez", "Licenciado en Educación, mención Inglés"],
  ["V-13456789", "Carmen", "Rivas", "Licenciada en Matemática"],
  ["V-14567890", "Luis", "Salcedo", "Profesor de Educación Física"],
  ["V-15678901", "Elena", "Pinto", "Licenciada en Artes"],
  ["V-16789012", "Ricardo", "Peña", "Licenciado en Biología"],
  ["V-17890123", "Ana", "Moreno", "Licenciada en Física"],
  ["V-18901234", "David", "Silva", "Licenciado en Química"],
  ["V-19012345", "Rosa", "Parra", "Licenciada en Geografía e Historia"],
  ["V-20123456", "Pedro", "Bastidas", "Licenciado en Ciencias Sociales"],
  ["V-21234567", "Yelitza", "Ruiz", "Orientadora"],
  ["V-22345678", "Orlando", "León", "Licenciado en Educación"],
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
  const periodId = "2025-2026";

  if (db.prepare("SELECT id FROM period WHERE id = ?").get(periodId)) return;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO period (id, status, start_year, end_year, opening_date, closing_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(periodId, "active", 2025, 2026, "2025-09-15", "2026-07-31");

    for (const [id, firstName, lastName, degree] of TEACHERS) {
      db.prepare(`
        INSERT INTO teacher (id, first_name, last_name, degree)
        VALUES (?, ?, ?, ?)
      `).run(id, firstName, lastName, degree);
    }

    for (let yearId = 1; yearId <= 5; yearId++) {
      const yearPeriodId = db.prepare(`
        INSERT INTO year_period (year_id, period_id) VALUES (?, ?)
      `).run(yearId, periodId).lastInsertRowid;
      const yearSubjectIds = SUBJECTS_BY_YEAR[yearId].map((subjectId, index) => {
        const yearSubjectId = db.prepare(`
          INSERT INTO year_subject (year_period_id, subject_id) VALUES (?, ?)
        `).run(yearPeriodId, subjectId).lastInsertRowid;
        db.prepare(`
          INSERT INTO teacher_subject (teacher_id, year_subject_id) VALUES (?, ?)
        `).run(TEACHERS[index % TEACHERS.length][0], yearSubjectId);
        return yearSubjectId;
      });

      for (let section = 1; section <= 2; section++) {
        const classId = db.prepare(`
          INSERT INTO class (name, year_period_id, shift, location, capacity)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          `Sección ${section === 1 ? "A" : "B"}`, yearPeriodId,
          section === 1 ? "Mañana" : "Tarde", "Sede Principal, Caracas", 30
        ).lastInsertRowid;

        for (let position = 1; position <= 25; position++) {
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
                `).run(term, strategy, randomInt(10, 20), id, yearSubjectId);
              }
            }
          }
        }
      }
    }
  });
}
