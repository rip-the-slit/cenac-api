export function normalizeQueryValue(value) {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim().toLowerCase();
  return normalized || null;
}

export function sanitizePagination({ page, limit } = {}) {
  if (limit === undefined || limit === null || limit === "") return null;

  const parsedLimit = Number(limit);
  const parsedPage = page === undefined || page === null || page === ""
    ? 1
    : Number(page);

  if (
    !Number.isInteger(parsedLimit) ||
    parsedLimit <= 0 ||
    !Number.isInteger(parsedPage) ||
    parsedPage <= 0
  ) {
    return null;
  }

  return {
    page: parsedPage,
    limit: parsedLimit,
    offset: (parsedPage - 1) * parsedLimit,
  };
}
