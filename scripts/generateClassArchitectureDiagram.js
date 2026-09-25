import { writeFileSync } from "node:fs";

const outputPath = process.argv[2] || "diagrama-clases-arquitectura.drawio";

const xml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const palettes = {
  controlador: { fill: "#ffe6cc", stroke: "#d79b00" },
  servicio: { fill: "#dae8fc", stroke: "#6c8ebf" },
  repositorio: { fill: "#d5e8d4", stroke: "#82b366" },
};

const layers = [
  { id: "layer_controllers", label: "CAPA DE CONTROLADORES", x: 40, y: 70, width: 2480, height: 350, type: "controlador" },
  { id: "layer_services", label: "CAPA DE SERVICIOS", x: 40, y: 460, width: 2480, height: 390, type: "servicio" },
  { id: "layer_repositories", label: "CAPA DE REPOSITORIOS", x: 40, y: 890, width: 2480, height: 430, type: "repositorio" },
];

const classes = [
  {
    id: "ctrl_user", layer: "layer_controllers", type: "controlador", name: "ControladorUsuario",
    x: 40, y: 50, width: 340, height: 230,
    attributes: ["- servicioUsuario: ServicioUsuario"],
    methods: [
      "+ listarUsuarios(solicitud, respuesta)", "+ iniciarSesion(solicitud, respuesta)",
      "+ registrar(solicitud, respuesta)", "+ actualizar(solicitud, respuesta)",
      "+ eliminar(solicitud, respuesta)", "+ cerrarSesion(solicitud, respuesta)",
    ],
  },
  {
    id: "ctrl_period", layer: "layer_controllers", type: "controlador", name: "ControladorPeriodo",
    x: 440, y: 50, width: 340, height: 280,
    attributes: ["- servicioPeriodo: ServicioPeriodo", "- servicioEstudiante: ServicioEstudiante"],
    methods: [
      "+ listarPeriodos(solicitud, respuesta)", "+ obtenerEstadisticas(solicitud, respuesta)",
      "+ obtenerSeccionesPorAño(solicitud, respuesta)", "+ obtenerEstudiantes(solicitud, respuesta)",
      "+ obtenerEstudiante(solicitud, respuesta)", "+ agregarPeriodo(solicitud, respuesta)",
      "+ cargarDatosPeriodo(solicitud, respuesta)", "+ obtenerSugerenciasSección(solicitud, respuesta)",
      "+ archivarPeriodo(solicitud, respuesta)",
    ],
  },
  {
    id: "ctrl_grade", layer: "layer_controllers", type: "controlador", name: "ControladorCalificación",
    x: 840, y: 50, width: 340, height: 150,
    attributes: ["- servicioCalificación: ServicioCalificación"],
    methods: ["+ obtenerCalificaciones(solicitud, respuesta)", "+ cargarCalificaciones(solicitud, respuesta)"],
  },
  {
    id: "ctrl_year", layer: "layer_controllers", type: "controlador", name: "ControladorAño",
    x: 1240, y: 50, width: 340, height: 130,
    attributes: ["- servicioAño: ServicioAño"],
    methods: ["+ listarAños(solicitud, respuesta)"],
  },
  {
    id: "ctrl_subject", layer: "layer_controllers", type: "controlador", name: "ControladorMateria",
    x: 1640, y: 50, width: 340, height: 130,
    attributes: ["- servicioMateria: ServicioMateria"],
    methods: ["+ listarMaterias(solicitud, respuesta)"],
  },
  {
    id: "ctrl_report", layer: "layer_controllers", type: "controlador", name: "ControladorInforme",
    x: 2040, y: 50, width: 340, height: 150,
    attributes: ["- servicioInforme: ServicioInforme"],
    methods: ["+ obtenerOpcionesInforme(solicitud, respuesta)", "+ generarBoletínCalificaciones(solicitud, respuesta)"],
  },
  {
    id: "svc_user", layer: "layer_services", type: "servicio", name: "ServicioUsuario",
    x: 30, y: 50, width: 320, height: 210,
    attributes: ["- repositorioUsuario: RepositorioUsuario"],
    methods: [
      "+ listarUsuarios()", "+ iniciarSesion(id, contraseña)", "+ registrar(datosUsuario)",
      "+ actualizar(id, datosUsuario)", "+ eliminar(id, idUsuarioActivo)",
    ],
  },
  {
    id: "svc_period", layer: "layer_services", type: "servicio", name: "ServicioPeriodo",
    x: 380, y: 50, width: 320, height: 310,
    attributes: [
      "- repositorioPeriodo: RepositorioPeriodo", "- repositorioAño: RepositorioAño",
      "- repositorioEstudiante: RepositorioEstudiante", "- repositorioMateria: RepositorioMateria",
    ],
    methods: [
      "+ validarPeriodo(periodo)", "+ listarPeriodos()", "+ obtenerDatosFiltros(idPeriodo, opciones)",
      "+ obtenerEstadísticas(id)", "+ puedeAgregarPeriodo(periodos)", "+ validarNuevoPeriodo(periodo)",
      "+ agregarPeriodo(periodo)", "+ cargarDatosPeriodo(idPeriodo, estudiantes, materias)",
      "+ archivarPeriodo(idPeriodo, reemplazar)",
    ],
  },
  {
    id: "svc_student", layer: "layer_services", type: "servicio", name: "ServicioEstudiante",
    x: 730, y: 50, width: 320, height: 250,
    attributes: [
      "- repositorioPeriodo: RepositorioPeriodo", "- repositorioAño: RepositorioAño",
      "- repositorioEstudiante: RepositorioEstudiante", "- servicioPeriodo: ServicioPeriodo",
    ],
    methods: [
      "+ validarPeriodo(periodo)", "+ obtenerSeccionesPorAño(idPeriodo)",
      "+ obtenerEstudiantesPorPeriodo(idPeriodo, filtros)", "+ obtenerEstudiantePorId(idPeriodo, idEstudiante)",
      "- construirSugerenciasSección(estudiantes, años)", "+ obtenerSugerenciasSección()",
    ],
  },
  {
    id: "svc_grade", layer: "layer_services", type: "servicio", name: "ServicioCalificación",
    x: 1080, y: 50, width: 320, height: 280,
    attributes: [
      "- repositorioMateria: RepositorioMateria", "- repositorioPeriodo: RepositorioPeriodo",
      "- repositorioAño: RepositorioAño", "- repositorioEstudiante: RepositorioEstudiante",
      "- servicioPeriodo: ServicioPeriodo",
    ],
    methods: [
      "- calcularEstadoEstudiante(materias)", "- obtenerMateriasPorAño(idPeriodo)",
      "- obtenerEstudiantesConMetadatos(idPeriodo)", "- crearMapaAñoMateria(idPeriodo)",
      "- procesarFilasCalificaciones(estudiantes, calificaciones, materias)",
      "+ obtenerCalificaciones(idPeriodo, filtros)", "+ cargarCalificaciones(idPeriodo, calificaciones)",
    ],
  },
  {
    id: "svc_year", layer: "layer_services", type: "servicio", name: "ServicioAño",
    x: 1430, y: 50, width: 320, height: 150,
    attributes: ["- repositorioAño: RepositorioAño"],
    methods: ["+ listarAños()", "+ obtenerAñoPorId(id)"],
  },
  {
    id: "svc_subject", layer: "layer_services", type: "servicio", name: "ServicioMateria",
    x: 1780, y: 50, width: 320, height: 150,
    attributes: ["- repositorioMateria: RepositorioMateria"],
    methods: ["+ listarMaterias()", "+ obtenerMateriaPorId(id)"],
  },
  {
    id: "svc_report", layer: "layer_services", type: "servicio", name: "ServicioInforme",
    x: 2130, y: 50, width: 320, height: 190,
    attributes: ["- servicioCalificación: ServicioCalificación"],
    methods: [
      "+ obtenerOpcionesInforme()", "- formatearFechaInforme(fecha)",
      "- construirBoletínCalificaciones(registro, lapsos, materias, años, fecha)",
      "+ generarBoletínCalificaciones(idPeriodo, búsqueda, lapsos)",
    ],
  },
  {
    id: "repo_user", layer: "layer_repositories", type: "repositorio", name: "RepositorioUsuario",
    x: 50, y: 50, width: 400, height: 230,
    attributes: ["- bd: BaseDeDatos"],
    methods: [
      "+ buscarPorId(id)", "+ listarTodos()", "+ listarNivelesUsuario()",
      "+ crear(usuario)", "+ actualizar(id, datosUsuario)", "+ eliminar(id)",
    ],
  },
  {
    id: "repo_period", layer: "layer_repositories", type: "repositorio", name: "RepositorioPeriodo",
    x: 530, y: 50, width: 400, height: 270,
    attributes: ["- bd: BaseDeDatos"],
    methods: [
      "+ buscarPorId(id)", "+ listarTodos()", "+ crear(periodo)", "+ actualizar(id, datosPeriodo)",
      "+ eliminar(id)", "+ contarEstudiantes(id)", "+ contarCalificaciones(id)",
      "+ asignarAño(idAño, idPeriodo)", "+ listarAñosAsignados(id)",
    ],
  },
  {
    id: "repo_student", layer: "layer_repositories", type: "repositorio", name: "RepositorioEstudiante",
    x: 1010, y: 50, width: 400, height: 350,
    attributes: ["- bd: BaseDeDatos"],
    methods: [
      "+ buscarPorId(id)", "+ listarTodos()", "+ listarPorSección(idSección)",
      "- crearFiltroPorPeriodo(idPeriodo, filtros)", "+ listarPorPeriodo(idPeriodo, opciones)",
      "+ crear(estudiante)", "+ actualizar(id, datosEstudiante)", "+ actualizarEstadoPorPeriodo(idPeriodo, estado)",
      "+ eliminar(id)", "+ asignarRepresentante(idEstudiante, idRepresentante)",
      "+ listarRepresentantes(idEstudiante)", "+ asignarASección(idEstudiante, idSección, estado)",
      "+ actualizarEstadoSección(idEstudiante, idSección, estado)", "+ listarSecciones(idEstudiante)",
      "+ buscarSecciónPorPeriodo(idEstudiante, idPeriodo)",
    ],
  },
  {
    id: "repo_year", layer: "layer_repositories", type: "repositorio", name: "RepositorioAño",
    x: 1490, y: 50, width: 400, height: 310,
    attributes: ["- bd: BaseDeDatos"],
    methods: [
      "+ buscarPorId(id)", "+ listarTodos()", "+ crear(año)", "+ actualizar(id, datosAño)",
      "+ eliminar(id)", "+ asignarSección(datosSección)", "+ listarSeccionesAsignadas(idAñoPeriodo)",
      "+ listarSeccionesPorPeriodo(idPeriodo)", "+ buscarSecciónPorNombre(nombre, idAñoPeriodo)",
      "+ asignarMateria(idMateria, idAñoPeriodo)", "+ listarMateriasAsignadas(idAñoPeriodo)",
    ],
  },
  {
    id: "repo_subject", layer: "layer_repositories", type: "repositorio", name: "RepositorioMateria",
    x: 1970, y: 50, width: 400, height: 310,
    attributes: ["- bd: BaseDeDatos"],
    methods: [
      "+ buscarPorId(id)", "+ listarTodos()", "+ listarPorPeriodo(idPeriodo)",
      "+ listarCalificacionesPorEstudiantes(idPeriodo, ids)", "+ crear(materia)",
      "+ actualizar(id, datosMateria)", "+ eliminar(id)", "+ asignarCalificación(calificación)",
      "+ listarCalificacionesPorEstudiante(idAñoMateria, idEstudiante)",
      "+ obtenerPromedio(idAñoMateria, idEstudiante)",
    ],
  },
];

const dependencies = [
  ["ctrl_user", "svc_user"], ["ctrl_period", "svc_period"], ["ctrl_period", "svc_student"],
  ["ctrl_grade", "svc_grade"], ["ctrl_year", "svc_year"], ["ctrl_subject", "svc_subject"],
  ["ctrl_report", "svc_report"],
  ["svc_user", "repo_user"],
  ["svc_period", "repo_period"], ["svc_period", "repo_year"],
  ["svc_period", "repo_student"], ["svc_period", "repo_subject"],
  ["svc_student", "repo_period"], ["svc_student", "repo_year"], ["svc_student", "repo_student"],
  ["svc_student", "svc_period"],
  ["svc_grade", "repo_subject"], ["svc_grade", "repo_period"],
  ["svc_grade", "repo_year"], ["svc_grade", "repo_student"], ["svc_grade", "svc_period"],
  ["svc_year", "repo_year"], ["svc_subject", "repo_subject"], ["svc_report", "svc_grade"],
];

const cells = [];
cells.push(`    <mxCell id="0"/>`);
cells.push(`    <mxCell id="1" parent="0"/>`);
cells.push(`    <mxCell id="title" value="${xml("Diagrama de clases de la arquitectura de la API CENAC")}" style="text;html=1;align=center;verticalAlign=middle;fontSize=24;fontStyle=1;fontColor=#1f2937;" vertex="1" parent="1"><mxGeometry x="600" y="10" width="1360" height="40" as="geometry"/></mxCell>`);

for (const layer of layers) {
  const color = palettes[layer.type];
  cells.push(`    <mxCell id="${layer.id}" value="${xml(layer.label)}" style="swimlane;startSize=34;html=1;container=1;pointerEvents=0;collapsible=0;rounded=0;fontStyle=1;fontSize=16;horizontal=1;fillColor=#ffffff;swimlaneFillColor=${color.fill};strokeColor=${color.stroke};strokeWidth=2;" vertex="1" parent="1"><mxGeometry x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" as="geometry"/></mxCell>`);
}

for (const item of classes) {
  const color = palettes[item.type];
  const title = `«${item.type}»<br><b>${item.name}</b>`;
  cells.push(`    <mxCell id="${item.id}" value="${xml(title)}" style="swimlane;fontStyle=0;align=center;startSize=52;html=1;container=1;collapsible=0;rounded=0;whiteSpace=wrap;fillColor=${color.fill};swimlaneFillColor=${color.fill};strokeColor=${color.stroke};strokeWidth=2;fontSize=13;" vertex="1" parent="${item.layer}"><mxGeometry x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" as="geometry"/></mxCell>`);
  const attributesHeight = Math.max(35, item.attributes.length * 16 + 8);
  const separatorY = 52 + attributesHeight + 1;
  const methodsY = separatorY + 2;
  cells.push(`    <mxCell id="${item.id}_attrs" value="${xml(item.attributes.join("<br>"))}" style="text;html=1;align=left;verticalAlign=top;spacingLeft=8;spacingTop=4;whiteSpace=wrap;fontSize=11;strokeColor=none;fillColor=none;" vertex="1" parent="${item.id}"><mxGeometry x="0" y="52" width="${item.width}" height="${attributesHeight}" as="geometry"/></mxCell>`);
  cells.push(`    <mxCell id="${item.id}_separator" value="" style="line;strokeWidth=1;fillColor=none;strokeColor=${color.stroke};" vertex="1" parent="${item.id}"><mxGeometry x="0" y="${separatorY}" width="${item.width}" height="1" as="geometry"/></mxCell>`);
  cells.push(`    <mxCell id="${item.id}_methods" value="${xml(item.methods.join("<br>"))}" style="text;html=1;align=left;verticalAlign=top;spacingLeft=8;spacingTop=5;whiteSpace=wrap;fontSize=11;strokeColor=none;fillColor=none;" vertex="1" parent="${item.id}"><mxGeometry x="0" y="${methodsY}" width="${item.width}" height="${item.height - methodsY}" as="geometry"/></mxCell>`);
}

dependencies.forEach(([source, target], index) => {
  cells.push(`    <mxCell id="dep_${index + 1}" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;dashPattern=6 4;strokeColor=#64748b;strokeWidth=1.5;endArrow=open;endFill=0;endSize=9;" edge="1" parent="1" source="${source}" target="${target}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
});

cells.push(`    <mxCell id="legend" value="${xml("LEYENDA")}" style="swimlane;startSize=28;html=1;container=1;collapsible=0;rounded=0;fontStyle=1;fillColor=#ffffff;strokeColor=#64748b;" vertex="1" parent="1"><mxGeometry x="40" y="1350" width="520" height="110" as="geometry"/></mxCell>`);
[
  ["controlador", "Controlador", 15], ["servicio", "Servicio", 175], ["repositorio", "Repositorio", 315],
].forEach(([type, label, x], index) => {
  const color = palettes[type];
  cells.push(`    <mxCell id="legend_swatch_${index}" value="" style="rounded=0;html=1;fillColor=${color.fill};strokeColor=${color.stroke};" vertex="1" parent="legend"><mxGeometry x="${x}" y="42" width="28" height="18" as="geometry"/></mxCell>`);
  cells.push(`    <mxCell id="legend_label_${index}" value="${label}" style="text;html=1;align=left;verticalAlign=middle;fontSize=11;" vertex="1" parent="legend"><mxGeometry x="${x + 35}" y="38" width="100" height="26" as="geometry"/></mxCell>`);
});
cells.push(`    <mxCell id="dependency_note" value="${xml("Las flechas discontinuas representan dependencias «usa» y apuntan hacia la clase utilizada.")}" style="text;html=1;align=left;verticalAlign=middle;fontSize=12;fontStyle=2;fontColor=#475569;" vertex="1" parent="1"><mxGeometry x="610" y="1370" width="900" height="50" as="geometry"/></mxCell>`);

const document = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="drawio" modified="2026-09-13T00:00:00.000Z" agent="Codex drawio-skill" version="26.0.0">
  <diagram id="class-architecture" name="Arquitectura por clases">
    <mxGraphModel dx="2600" dy="1500" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="2700" pageHeight="1550" math="0" shadow="0">
      <root>
${cells.join("\n")}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;

writeFileSync(outputPath, document, "utf8");
console.log(`Diagrama generado en ${outputPath}`);
