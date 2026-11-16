export const fold = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function updateFolded(db, table, id, columns, row) {
  db.prepare(`UPDATE ${table} SET ${columns.map(column => `${column}_folded = ?`).join(", ")} WHERE id = ?`)
    .run(...columns.map(column => fold(row[column])), id);
}

export const isExact = (exact, key) =>
  exact?.[key] === true || exact?.[key] === "true" ||
  (key === "dateOfBirth" && (exact?.birthDate === true || exact?.birthDate === "true"));

export function addNameFilter(addFilter, filters, key, firstName, lastName, id) {
  const exact = isExact(filters.exact, key);
  const names = [`${lastName} || ' ' || ${firstName}`, `${firstName} || ' ' || ${lastName}`];
  const clauses = exact
    ? [...names, id].map(column => `LOWER(${column}) = ?`)
    : [...names.flatMap(column => [`LOWER(${column}) LIKE ?`, `LOWER(${column}) LIKE ?`]), `LOWER(${id}) LIKE ?`];
  addFilter(filters[key], `(${clauses.join(" OR ")})`, item => exact
    ? [item, item, item]
    : [`${item}%`, `% ${item}%`, `${item}%`, `% ${item}%`, `%${item}%`]);
}
