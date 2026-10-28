import getPlaceDatabase from "../config/placeDb.js";

class PlaceRepository {
  constructor(db) {
    this.db = db;
  }

  _findAll(table, columns, conditions, params, pagination) {
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { recordsAmount } = this.db.prepare(
      `SELECT COUNT(*) AS recordsAmount FROM ${table} ${where}`
    ).get(...params);
    const query = this.db.prepare(`
      SELECT geoname_id AS id, name, ${columns} FROM ${table} ${where}
      ORDER BY name COLLATE NOCASE ASC, geoname_id ASC
      ${pagination ? "LIMIT ? OFFSET ?" : ""}
    `);
    const rows = query.all(...params, ...(pagination ? [pagination.limit, pagination.offset] : []));
    return { rows, recordsAmount };
  }

  findAllCountries({ q } = {}, pagination = null) {
    return this._findAll("country", "iso2, iso3", q ? ["LOWER(name) LIKE ?"] : [],
      q ? [`%${q}%`] : [], pagination);
  }

  findAllStates({ country, q } = {}, pagination = null) {
    return this._findAll("state", 'country_iso2 AS country, admin1_code AS "admin1Code"',
      ["country_iso2 = ? COLLATE NOCASE", ...(q ? ["LOWER(name) LIKE ?"] : [])],
      [country, ...(q ? [`%${q}%`] : [])], pagination);
  }

  findAllMunicipalities({ country, state, q } = {}, pagination = null) {
    return this._findAll("municipality",
      'country_iso2 AS country, state_geoname_id AS state, admin2_code AS "admin2Code"',
      ["country_iso2 = ? COLLATE NOCASE", "state_geoname_id = ?", ...(q ? ["LOWER(name) LIKE ?"] : [])],
      [country, state, ...(q ? [`%${q}%`] : [])], pagination);
  }
}

export default new PlaceRepository(getPlaceDatabase());
