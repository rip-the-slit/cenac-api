export class User {
  constructor(id, name, userLevel, password = null) {
    this.id = id;
    this.name = name;
    this.userLevel = userLevel;
    this.password = password;
  }
}

export class Year {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }
}

export class Subject {
  constructor(id, name, minimumGrade, yearSubjectId) {
    this.id = id;
    this.name = name;
    this.minimumGrade = minimumGrade;
    this.yearSubjectId = yearSubjectId;
  }
}

export class Teacher {
  constructor(id, firstName, lastName, degree) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.degree = degree;
  }
}

export class Guardian {
  constructor(id, firstName, lastName, birthDate, legalRole) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.birthDate = birthDate;
    this.legalRole = legalRole;
  }
}

export class Student {
  constructor(id, firstName, lastName, birthDate, birthPlace, status, classId = null) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.birthDate = birthDate;
    this.birthPlace = birthPlace;
    this.status = status;
    this.classId = classId;
  }
}

export class Period {
  constructor(id, status, startYear, endYear, openingDate, closingDate) {
    this.id = id;
    this.status = status;
    this.startYear = startYear;
    this.endYear = endYear;
    this.openingDate = openingDate;
    this.closingDate = closingDate;
  }
}

export class Class {
  constructor(id, name, shift, location, capacity, yearPeriodId) {
    this.id = id;
    this.name = name;
    this.shift = shift;
    this.location = location;
    this.capacity = capacity;
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