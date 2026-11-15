const MAX_STUDENT_AGE = 18;
const MIN_STUDENT_AGE = 12;
const MAX_GUARDIAN_AGE = 130;
const MIN_GUARDIAN_AGE = 18;

export function getStudentFields({ editor = false, allPeriods = false } = {}) {
  const minBirthDate = new Date();
  minBirthDate.setMonth(minBirthDate.getMonth() - 12 * MAX_STUDENT_AGE);
  const maxBirthDate = new Date();
  maxBirthDate.setMonth(maxBirthDate.getMonth() - 12 * MIN_STUDENT_AGE);

  const fields = {
    id: {
      label: "Cédula",
      type: "text",
      placeholder: "Ej: 30000001",
      pattern: {v: "[2-7][0-9]{7}", e:"[8-9][0-9]{7}"},
      validationMessages: { patternMismatch: "Documento inválido. Ej: V-20000001 o E-80000001." },
    },
    firstName: {
      label: "Nombres",
      type: "text",
      placeholder: "Ej: Ana María",
      pattern: "[A-Za-zÁ-Źá-źÑñ']+( [A-Za-zÁ-Źá-źÑñ']+)*",
      validationMessages: { patternMismatch: "Nombres solo puede contener letras o espacios." },
    },
    lastName: {
      label: "Apellidos",
      type: "text",
      placeholder: "Ej: Pérez García",
      pattern: "[A-Za-zÁ-Źá-źÑñ']+( [A-Za-zÁ-Źá-źÑñ']+)*",
      validationMessages: { patternMismatch: "Apellidos solo puede contener letras o espacios." },
    },
    birthDate: {
      label: "Fecha de Nacimiento",
      type: editor ? "date" : "text",
      placeholder: "Ej: 2010-05-15",
      min: minBirthDate.toISOString().slice(0, 10),
      max: maxBirthDate.toISOString().slice(0, 10),
      validationMessages: { rangeOverflow: `Debe ser mayor de ${MIN_STUDENT_AGE} años.`, rangeUnderflow: `Debe ser menor de ${MAX_STUDENT_AGE} años.`},
    },
    birthPlace: {
      label: "Lugar de Nacimiento",
      type: "text",
      placeholder: "Ej: Venezuela, Ej: Guárico, Ej: Municipio Leonardo Infante",
    },
  };
  if (editor) {
    for (const field of Object.values(fields)) field.required = true;
    fields.firstName.maxLength = 50;
    fields.firstName.minLength = 2;
    fields.lastName.maxLength = 50;
    fields.lastName.minLength = 2;
    return fields;
  }
  return {
    ...fields,
    q: {
      label: "Buscar estudiante",
      type: "text",
      placeholder: "Ej: Ana Pérez o V-10000001",
    },
    guardianQ: {
      label: "Representante",
      type: "text",
      placeholder: "Ej: María Pérez",
    },
    year: { label: "Año", type: "select", placeholder: "Ej: 1er Año" },
    class: {
      label: allPeriods ? "Sección actual" : "Sección",
      type: "select",
      placeholder: "Ej: A",
    },
    status: {
      label: allPeriods ? "Estatus General" : "Estatus del Periodo",
      type: "select",
      placeholder: allPeriods ? "Ej: Activo" : "Ej: Pendiente",
    },
    assignedGuardians: {
      label: "Representantes Asignados",
      type: "text",
      placeholder: "Ej: María Pérez",
    },
  };
}

export function getGuardianFields({ editor = true } = {}) {
  const maxBirthDate = new Date();
  maxBirthDate.setMonth(maxBirthDate.getMonth() - 12 * MIN_GUARDIAN_AGE);
  const minBirthDate = new Date();
  minBirthDate.setMonth(minBirthDate.getMonth() - 12 * MAX_GUARDIAN_AGE);
  const fields = {
    id: {
      label: "Cédula",
      type: "text",
      required: true,
      placeholder: "Ej: V-10000001",
      pattern: {v: "1[0-9]{7}", e:"[8-9][0-9]{7}"},
      validationMessages: { patternMismatch: "Documento inválido. Ej: V-10000001 o E-80000001." },
    },
    firstName: {
      label: "Nombres",
      type: "text",
      pattern: "[A-Za-zÁ-Źá-źÑñ']+( [A-Za-zÁ-Źá-źÑñ']+)*",
      required: true,
      minLength: 2,
      maxLength: 50,
      placeholder: "Ej: María Elena",
      validationMessages: { patternMismatch: "Nombres solo puede contener letras o espacios." },
    },
    lastName: {
      label: "Apellidos",
      type: "text",
      pattern: "[A-Za-zÁ-Źá-źÑñ']+( [A-Za-zÁ-Źá-źÑñ']+)*",
      required: true,
      minLength: 2,
      maxLength: 50,
      placeholder: "Ej: Pérez García",
      validationMessages: { patternMismatch: "Apellidos solo puede contener letras o espacios." },
    },
    birthDate: {
      label: "Fecha de Nacimiento",
      type: "date",
      max: maxBirthDate.toISOString().slice(0, 10),
      placeholder: "Ej: 1985-03-20",
      validationMessages: { rangeOverflow: `Debe ser mayor de ${MIN_GUARDIAN_AGE} años.`, rangeUnderflow: "Verifique la fecha." },
    },
    legalRole: {
      label: "Rol Legal",
      type: "select",
      required: true,
      default: "Madre",
      placeholder: "Ej: Madre",
      options: [
        { value: "Madre", label: "Madre" },
        { value: "Padre", label: "Padre" },
        { value: "Representante Legal", label: "Representante Legal" },
      ],
    },
    phone: {
      label: "Teléfono",
      type: "tel",
      pattern: "[1-9][0-9]{6}",
      placeholder: "1234567",
      validationMessages: { patternMismatch: "Número de suscriptor debe contener siete dígitos y no empezar en 0." },
      maxLength: 7,
    },
    address: {
      label: "Dirección de Domicilio",
      type: "text",
      placeholder: "Ej: Av. Bolívar, casa 12, Caracas",
      pattern: "[w,.:-°]+( [w,.:-°])*",
      minLength: 4,
      maxLength: 80,
      validationMessages: { patternMismatch: "Dirección solo puede contener letras y signos de puntuación." },
    },
    assignedStudents: {
      label: "Estudiantes Asignados",
      type: "text",
      placeholder: "Ej: Ana Pérez",
    },
  };
  if (!editor) {
    for (const field of Object.values(fields)) {
      delete field.required;
      delete field.default;
    }
    fields.birthDate.type = "text";
  }
  return fields;
}
