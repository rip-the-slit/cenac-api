const MAX_STUDENT_AGE = 18;
const MIN_STUDENT_AGE = 12;
const MIN_GUARDIAN_AGE = 18;

export function getStudentFields({ editor = false, allPeriods = false } = {}) {
  const minBirthDate = new Date()
  minBirthDate.setMonth(minBirthDate.getMonth() - (12 * MAX_STUDENT_AGE));
  const maxBirthDate = new Date()
  maxBirthDate.setMonth(maxBirthDate.getMonth() - (12 * MIN_STUDENT_AGE));

  const fields = {
    id: { label: "Cédula", type: "text", placeholder: "Ej: V-10000001" },
    firstName: { label: "Nombres", type: "text", placeholder: "Ej: Ana María" },
    lastName: { label: "Apellidos", type: "text", placeholder: "Ej: Pérez García" },
    birthDate: {
      label: "Fecha de Nacimiento",
      type: editor ? "date" : "text",
      placeholder: "Ej: 2010-05-15",
      min: minBirthDate.toISOString().slice(0, 10),
      max: maxBirthDate.toISOString().slice(0, 10),
    },
    birthPlace: { label: "Lugar de Nacimiento", type: "text", placeholder: "Ej: Venezuela, Ej: Guárico, Ej: Municipio Leonardo Infante" },
  };
  if (editor) {
    for (const field of Object.values(fields)) field.required = true;
    fields.firstName.maxLength = 50;
    fields.firstName.minLength = 4;
    fields.lastName.maxLength = 50;
    fields.lastName.minLength = 4;
    return fields;
  }
  return {
    ...fields,
    q: { label: "Buscar estudiante", type: "text", placeholder: "Ej: Ana Pérez o V-10000001" },
    guardianQ: { label: "Representante", type: "text", placeholder: "Ej: María Pérez" },
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
    assignedGuardians: { label: "Representantes Asignados", type: "text", placeholder: "Ej: María Pérez" },
  };
}

export function getGuardianFields({ editor = true } = {}) {
  const maxBirthDate = new Date()
  maxBirthDate.setMonth(maxBirthDate.getMonth() - (12 * MIN_GUARDIAN_AGE));
  const fields = {
    id: { label: "Cédula", type: "text", required: true, placeholder: "Ej: V-20000001" },
    firstName: { label: "Nombres", type: "text", required: true, minLength: 4, maxLength: 50, placeholder: "Ej: María Elena" },
    lastName: { label: "Apellidos", type: "text", required: true, minLength: 4, maxLength: 50, placeholder: "Ej: Pérez García" },
    birthDate: { label: "Fecha de Nacimiento", type: "date", max: maxBirthDate.toISOString().slice(0, 10), placeholder: "Ej: 1985-03-20" },
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
      pattern: "^(?=(?:\\D*\\d){7,15}\\D*$)\\+?[0-9\\s().-]+$",
      placeholder: "Ej: 0412-1234567",
    },
    address: { label: "Dirección de Domicilio", type: "text", placeholder: "Ej: Av. Bolívar, casa 12, Caracas", minLength: 4, maxLength: 80 },
    assignedStudents: { label: "Estudiantes Asignados", type: "text", placeholder: "Ej: Ana Pérez" },
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
