export const serializeCookie = (name, value, options = {}) => {
  const attributes = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
  ];

  if (options.maxAge) attributes.push(`Max-Age=${options.maxAge}`);
  if (options.domain) attributes.push(`Domain=${options.domain}`);
  if (options.path) attributes.push(`Path=${options.path}`);
  if (options.expires) attributes.push(`Expires=${options.expires.toUTCString()}`);
  if (options.httpOnly) attributes.push("HttpOnly");
  if (options.secure) attributes.push("Secure");
  if (options.sameSite) attributes.push(`SameSite=${options.sameSite}`);

  return attributes.join("; ");
};

export const parseCookie = (cookieHeader = "") =>
  cookieHeader.split(";").reduce((cookies, cookie) => {
    const separator = cookie.indexOf("=");
    if (separator === -1) return cookies;

    const name = cookie.slice(0, separator).trim();
    const value = cookie.slice(separator + 1).trim();
    if (!name) return cookies;

    cookies[decodeURIComponent(name)] = decodeURIComponent(value);
    return cookies;
  }, {});
