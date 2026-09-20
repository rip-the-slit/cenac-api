export class User {
  constructor(id, name, userLevel, password = null) {
    this.id = id;
    this.name = name;
    this.userLevel = userLevel;
    this.password = password;
  }
}

export class Year {
  constructor(id, name, abbr = null) {
    this.id = id;
    this.name = name;
    this.abbr = abbr;
  }
}

export class Subject {
  constructor(id, name, abbr, minimumGrade, yearSubjectId) {
    this.id = id;
    this.name = name;
    this.abbr = abbr;
    this.minimumGrade = minimumGrade;
    this.yearSubjectId = yearSubjectId;
  }
}

export class Guardian {
  constructor(
    id,
    firstName,
    lastName,
    birthDate,
    legalRole,
    phone = null,
    address = null,
    assignedStudents = []
  ) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.birthDate = birthDate;
    this.legalRole = legalRole;
    this.phone = phone;
    this.address = address;
    this.assignedStudents = assignedStudents;
  }
}

export class Student {
  constructor(
    id,
    firstName,
    lastName,
    birthDate,
    birthPlace,
    status,
    classId = null,
    assignedGuardians = []
  ) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.birthDate = birthDate;
    this.birthPlace = birthPlace;
    this.status = status;
    this.classId = classId;
    this.assignedGuardians = assignedGuardians;
  }
}

export class Period {
  constructor(id, status, startYear, endYear, openingDate, userId = null) {
    this.id = id;
    this.status = status;
    this.startYear = startYear;
    this.endYear = endYear;
    this.openingDate = openingDate;
    this.userId = userId;
  }
}

export class PeriodStats {
  constructor(totalGrades, loadedGrades, totalStudents, passedStudents) {
    this.grades = { total: totalGrades, loaded: loadedGrades };
    this.students = { total: totalStudents, passed: passedStudents };
  }
}

export class Class {
  constructor(id, name, studentCount, yearPeriodId) {
    this.id = id;
    this.name = name;
    this.studentCount = studentCount;
    this.yearPeriodId = yearPeriodId;
  }
}

export class Grade {
  constructor(id, term, value, strategy, studentId, yearSubjectId) {
    this.id = id;
    this.term = term;
    this.value = value;
    this.strategy = strategy;
    this.studentId = studentId;
    this.yearSubjectId = yearSubjectId;
  }
}
