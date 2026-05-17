CREATE TABLE IF NOT EXISTS user_level (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    user_level_id TEXT,
    FOREIGN KEY (user_level_id) REFERENCES user_level(id)
);

CREATE TABLE IF NOT EXISTS year (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subject (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
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
    legal_role TEXT
);

CREATE TABLE IF NOT EXISTS student (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date DATE,
    birth_place TEXT,
    status TEXT
);

CREATE TABLE IF NOT EXISTS period (
    id TEXT PRIMARY KEY,
    status TEXT,
    start_year INTEGER,
    end_year INTEGER,
    opening_date DATE,
    closing_date DATE
);

CREATE TABLE IF NOT EXISTS year_period (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_id TEXT,
    period_id TEXT,
    UNIQUE (year_id, period_id),
    FOREIGN KEY (year_id) REFERENCES year(id),
    FOREIGN KEY (period_id) REFERENCES period(id)
);

CREATE TABLE IF NOT EXISTS year_subject (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_period_id TEXT,
    subject_id TEXT,
    UNIQUE (year_period_id, subject_id),
    FOREIGN KEY (year_period_id) REFERENCES year_period(id),
    FOREIGN KEY (subject_id) REFERENCES subject(id)
);

CREATE TABLE IF NOT EXISTS class (
    id TEXT PRIMARY KEY,
    shift TEXT,
    location TEXT,
    capacity INTEGER,
    year_period_id TEXT,
    FOREIGN KEY (year_period_id) REFERENCES year_period(id)
);

CREATE TABLE IF NOT EXISTS grade (
    id TEXT PRIMARY KEY,
    term TEXT,
    value REAL,
    strategy TEXT,
    student_id TEXT,
    year_subject_id TEXT,
    UNIQUE (term, year_subject_id, student_id),
    FOREIGN KEY (student_id) REFERENCES student(id),
    FOREIGN KEY (year_subject_id) REFERENCES year_subject(id),
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
    class_id TEXT,
    status TEXT,
    PRIMARY KEY (student_id, class_id),
    FOREIGN KEY (student_id) REFERENCES student(id),
    FOREIGN KEY (class_id) REFERENCES class(id)
);

CREATE TABLE IF NOT EXISTS teacher_subject (
    teacher_id TEXT,
    year_subject_id TEXT,
    PRIMARY KEY (teacher_id, year_subject_id),
    FOREIGN KEY (teacher_id) REFERENCES teacher(id),
    FOREIGN KEY (year_subject_id) REFERENCES year_subject(id)
);