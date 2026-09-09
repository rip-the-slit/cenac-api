import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { writeFile } from 'node:fs/promises';

const outputPath = 'Diccionario_de_Datos_CENAC.docx';
const creationDate = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date());

const tables = [
  ['user', 'Usuarios del sistema.', [
    ['id', 'INTEGER', 'Identificador único del usuario. Clave primaria autoincremental.'],
    ['name', 'TEXT', 'Nombre de usuario. Obligatorio.'],
    ['password', 'TEXT', 'Contraseña del usuario. Obligatoria.'],
    ['user_level', 'TEXT', 'Nivel de acceso. Obligatorio; valores permitidos: Administrador, Coordinador o Profesor.'],
  ], '—', 'id'],
  ['year', 'Grados o años escolares.', [
    ['id', 'INTEGER', 'Identificador único del grado. Clave primaria autoincremental.'],
    ['name', 'TEXT', 'Nombre del grado o año escolar. Obligatorio.'],
  ], 'year_period.year_id → year.id', 'id'],
  ['subject', 'Asignaturas del plan de estudios.', [
    ['id', 'INTEGER', 'Identificador único de la asignatura. Clave primaria autoincremental.'],
    ['name', 'TEXT', 'Nombre de la asignatura. Obligatorio.'],
    ['abbr', 'TEXT', 'Abreviatura de la asignatura.'],
    ['minimum_grade', 'REAL', 'Calificación mínima requerida.'],
  ], 'year_subject.subject_id → subject.id', 'id'],
  ['teacher', 'Docentes registrados.', [
    ['id', 'TEXT', 'Identificador único del docente. Clave primaria.'],
    ['first_name', 'TEXT', 'Nombre(s) del docente. Obligatorio.'],
    ['last_name', 'TEXT', 'Apellidos del docente. Obligatorio.'],
    ['degree', 'TEXT', 'Grado académico o título del docente.'],
  ], 'teacher_subject.teacher_id → teacher.id', 'id'],
  ['guardian', 'Padres, madres, tutores o responsables legales.', [
    ['id', 'TEXT', 'Identificador único del tutor. Clave primaria.'],
    ['first_name', 'TEXT', 'Nombre(s) del tutor. Obligatorio.'],
    ['last_name', 'TEXT', 'Apellidos del tutor. Obligatorio.'],
    ['birth_date', 'DATE', 'Fecha de nacimiento del tutor.'],
    ['legal_role', 'TEXT', 'Rol o parentesco legal del tutor. Obligatorio.'],
    ['phone', 'TEXT', 'Número telefónico del tutor.'],
    ['address', 'TEXT', 'Domicilio del tutor.'],
  ], 'student_guardian.guardian_id → guardian.id', 'id'],
  ['student', 'Alumnos registrados.', [
    ['id', 'TEXT', 'Identificador único del alumno. Clave primaria.'],
    ['first_name', 'TEXT', 'Nombre(s) del alumno. Obligatorio.'],
    ['last_name', 'TEXT', 'Apellidos del alumno. Obligatorio.'],
    ['birth_date', 'DATE', 'Fecha de nacimiento del alumno.'],
    ['birth_place', 'TEXT', 'Lugar de nacimiento del alumno.'],
    ['status', 'TEXT', 'Estatus del alumno; valores permitidos: active o inactive.'],
  ], 'grade.student_id → student.id; student_guardian.student_id → student.id; student_class.student_id → student.id', 'id'],
  ['period', 'Periodos escolares.', [
    ['id', 'TEXT', 'Identificador único del periodo. Clave primaria.'],
    ['status', 'TEXT', 'Estatus del periodo. Valor predeterminado: new; valores permitidos: new, active o archived.'],
    ['start_year', 'INTEGER', 'Año de inicio del periodo.'],
    ['end_year', 'INTEGER', 'Año de término del periodo.'],
    ['opening_date', 'DATE', 'Fecha de apertura del periodo.'],
    ['closing_date', 'DATE', 'Fecha de cierre del periodo.'],
  ], 'year_period.period_id → period.id', 'id'],
  ['year_period', 'Relación entre grado escolar y periodo.', [
    ['id', 'INTEGER', 'Identificador único de la relación. Clave primaria autoincremental.'],
    ['year_id', 'INTEGER', 'Grado escolar relacionado. Clave foránea a year.id.'],
    ['period_id', 'TEXT', 'Periodo escolar relacionado. Clave foránea a period.id.'],
  ], 'year_id → year.id; period_id → period.id; year_subject.year_period_id → year_period.id; class.year_period_id → year_period.id', 'id; UNIQUE(year_id, period_id)'],
  ['year_subject', 'Asignaturas impartidas en un grado y periodo.', [
    ['id', 'INTEGER', 'Identificador único de la relación. Clave primaria autoincremental.'],
    ['year_period_id', 'INTEGER', 'Grado y periodo relacionados. Clave foránea a year_period.id.'],
    ['subject_id', 'INTEGER', 'Asignatura relacionada. Clave foránea a subject.id.'],
  ], 'year_period_id → year_period.id; subject_id → subject.id; grade.year_subject_id → year_subject.id; teacher_subject.year_subject_id → year_subject.id', 'id; UNIQUE(year_period_id, subject_id)'],
  ['class', 'Grupos o clases por grado y periodo.', [
    ['id', 'INTEGER', 'Identificador único del grupo. Clave primaria autoincremental.'],
    ['name', 'TEXT', 'Nombre o sección del grupo.'],
    ['year_period_id', 'INTEGER', 'Grado y periodo al que pertenece el grupo. Clave foránea a year_period.id.'],
    ['shift', 'TEXT', 'Turno del grupo.'],
    ['location', 'TEXT', 'Ubicación o aula asignada.'],
    ['capacity', 'INTEGER', 'Cupo máximo del grupo.'],
  ], 'year_period_id → year_period.id; student_class.class_id → class.id', 'id; UNIQUE(name, year_period_id)'],
  ['grade', 'Calificaciones de alumnos por asignatura y periodo.', [
    ['id', 'INTEGER', 'Identificador único de la calificación. Clave primaria autoincremental.'],
    ['term', 'INTEGER', 'Número de periodo parcial o término de evaluación.'],
    ['strategy', 'INTEGER', 'Estrategia o modalidad de evaluación.'],
    ['value', 'REAL', 'Valor numérico de la calificación.'],
    ['student_id', 'TEXT', 'Alumno evaluado. Clave foránea a student.id.'],
    ['year_subject_id', 'INTEGER', 'Asignatura en grado y periodo. Clave foránea a year_subject.id.'],
  ], 'student_id → student.id; year_subject_id → year_subject.id', 'id; UNIQUE(term, strategy, year_subject_id, student_id)'],
  ['student_guardian', 'Relación entre alumnos y tutores.', [
    ['student_id', 'TEXT', 'Alumno relacionado. Clave primaria compuesta y clave foránea a student.id.'],
    ['guardian_id', 'TEXT', 'Tutor relacionado. Clave primaria compuesta y clave foránea a guardian.id.'],
  ], 'student_id → student.id; guardian_id → guardian.id', 'PRIMARY KEY(student_id, guardian_id)'],
  ['student_class', 'Inscripción de alumnos en grupos.', [
    ['student_id', 'TEXT', 'Alumno inscrito. Clave primaria compuesta y clave foránea a student.id.'],
    ['class_id', 'INTEGER', 'Grupo asignado. Clave primaria compuesta y clave foránea a class.id.'],
    ['status', 'TEXT', 'Resultado de la inscripción. Valor predeterminado: pending; valores permitidos: pending, passed o failed.'],
  ], 'student_id → student.id; class_id → class.id', 'PRIMARY KEY(student_id, class_id)'],
  ['teacher_subject', 'Asignación de docentes a asignaturas por grado y periodo.', [
    ['teacher_id', 'TEXT', 'Docente asignado. Clave primaria compuesta y clave foránea a teacher.id.'],
    ['year_subject_id', 'INTEGER', 'Asignatura en grado y periodo. Clave primaria compuesta y clave foránea a year_subject.id.'],
  ], 'teacher_id → teacher.id; year_subject_id → year_subject.id', 'PRIMARY KEY(teacher_id, year_subject_id)'],
];

const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
const paragraph = (text, options = {}) => new Paragraph({ spacing: { after: 0 }, ...options, children: [new TextRun({ text, font: 'Arial', size: 18, ...options.run })] });
const cell = (text, opts = {}) => new TableCell({ verticalAlign: VerticalAlign.CENTER, width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined, shading: opts.shading ? { type: ShadingType.CLEAR, fill: opts.shading } : undefined, margins: { top: 50, bottom: 50, left: 80, right: 80 }, children: [paragraph(text, { run: { bold: opts.bold } })] });

function tableSection([name, description, fields, relations, keys], isLast) {
  const header = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows: [
    new TableRow({ children: [cell('Nombre de Archivo:', { bold: true, width: 3000 }), cell(name, { width: 3000 }), cell('Fecha de generación:', { bold: true, width: 3000 }), cell(creationDate, { width: 2000 })] }),
    new TableRow({ children: [cell('Descripción:', { bold: true, width: 1800 }), cell(description, { width: 9200 })] }),
  ] });
  const fieldsTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows: [
    new TableRow({ tableHeader: true, children: ['Campo', 'Tipo de Dato', 'Descripción'].map((value, i) => cell(value, { bold: true, shading: 'E7E6E6', width: [2600, 2200, 6200][i] })) }),
    ...fields.map((field) => new TableRow({ children: [cell(field[0], { width: 2600 }), cell(field[1], { width: 2200 }), cell(field[2], { width: 6200 })] })),
  ] });
  const footer = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows: [
    new TableRow({ children: [cell('Relaciones:', { bold: true, width: 2600 }), cell('Campos Clave:', { bold: true, width: 8400 })] }),
    new TableRow({ children: [cell(relations, { width: 6000 }), cell(keys, { width: 6000 })] }),
  ] });
  return [header, fieldsTable, footer, ...(isLast ? [] : [new Paragraph({ pageBreakBefore: true })])];
}

const document = new Document({ sections: [{ properties: { page: { margin: { top: 400, right: 400, bottom: 400, left: 400 } } }, children: tables.flatMap((table, index) => tableSection(table, index === tables.length - 1)) }] });
await writeFile(outputPath, await Packer.toBuffer(document));
console.log(`Documento generado: ${outputPath}`);
