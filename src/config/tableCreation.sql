CREATE TABLE IF NOT EXISTS user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    user_level TEXT NOT NULL CHECK(user_level IN ("Administrador", "Coordinador", "Profesor"))
);

CREATE TABLE IF NOT EXISTS year (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subject (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    abbr TEXT,
    minimum_grade REAL
);

CREATE TABLE IF NOT EXISTS teacher (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    degree TEXT
);

CREATE TABLE IF NOT EXISTS guardian (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date DATE,
    legal_role TEXT NOT NULL,
    phone TEXT,
    address TEXT
);

CREATE TABLE IF NOT EXISTS student (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date DATE,
    birth_place TEXT,
    status TEXT CHECK(status IN ("active", "inactive"))
);

CREATE TABLE IF NOT EXISTS period (
    id TEXT PRIMARY KEY,
    status TEXT DEFAULT "new" CHECK(status IN ("new", "active", "archived")),
    start_year INTEGER,
    end_year INTEGER,
    opening_date DATE,
    closing_date DATE
);

CREATE TABLE IF NOT EXISTS year_period (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_id INTEGER,
    period_id TEXT,
    UNIQUE (year_id, period_id),
    FOREIGN KEY (year_id) REFERENCES year(id),
    FOREIGN KEY (period_id) REFERENCES period(id)
);

CREATE TABLE IF NOT EXISTS year_subject (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_period_id INTEGER,
    subject_id INTEGER,
    UNIQUE (year_period_id, subject_id),
    FOREIGN KEY (year_period_id) REFERENCES year_period(id),
    FOREIGN KEY (subject_id) REFERENCES subject(id)
);

CREATE TABLE IF NOT EXISTS class (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    year_period_id INTEGER,
    shift TEXT,
    location TEXT,
    capacity INTEGER,
    UNIQUE (name, year_period_id),
    FOREIGN KEY (year_period_id) REFERENCES year_period(id)
);

CREATE TABLE IF NOT EXISTS grade (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term INTEGER,
    strategy INTEGER,
    value REAL,
    student_id TEXT,
    year_subject_id INTEGER,
    UNIQUE (term, strategy, year_subject_id, student_id),
    FOREIGN KEY (student_id) REFERENCES student(id),
    FOREIGN KEY (year_subject_id) REFERENCES year_subject(id)
);

CREATE TABLE IF NOT EXISTS student_guardian (
    student_id TEXT,
    guardian_id TEXT,
    PRIMARY KEY (student_id, guardian_id),
    FOREIGN KEY (student_id) REFERENCES student(id),
    FOREIGN KEY (guardian_id) REFERENCES guardian(id)
);

CREATE TABLE IF NOT EXISTS student_class (
    student_id TEXT,
    class_id INTEGER,
    status TEXT DEFAULT "pending" CHECK(status IN ("pending", "passed", "failed")),
    PRIMARY KEY (student_id, class_id),
    FOREIGN KEY (student_id) REFERENCES student(id),
    FOREIGN KEY (class_id) REFERENCES class(id)
);

CREATE TABLE IF NOT EXISTS teacher_subject (
    teacher_id TEXT,
    year_subject_id INTEGER,
    PRIMARY KEY (teacher_id, year_subject_id),
    FOREIGN KEY (teacher_id) REFERENCES teacher(id),
    FOREIGN KEY (year_subject_id) REFERENCES year_subject(id)
);

CREATE INDEX IF NOT EXISTS idx_grade_year_subject_student
    ON grade(year_subject_id, student_id);
CREATE INDEX IF NOT EXISTS idx_year_period_period
    ON year_period(period_id);
CREATE INDEX IF NOT EXISTS idx_student_class_class_student
    ON student_class(class_id, student_id);
CREATE INDEX IF NOT EXISTS idx_class_year_period
    ON class(year_period_id);
