import { JWT_STORAGE_KEY, ROLE_STORAGE_KEY } from "./config.js";

/**
 * @param {Record<string, unknown>|null|undefined} data
 * @returns {string|null}
 */
export function extractJwtFromBody(data) {
  if (!data || typeof data !== "object") return null;
  const fromObj = (o) => {
    if (!o || typeof o !== "object") return null;
    const candidates = [
      o.accessToken,
      o.AccessToken,
      o.access_token,
      o.token,
      o.Token,
      o.jwt,
      o.Jwt,
      o.JWT,
    ];
    for (const v of candidates) {
      if (typeof v === "string" && v.length > 0) return v;
    }
    return null;
  };
  const nested = data.data ?? data.Data;
  return (
    fromObj(data) ??
    fromObj(typeof nested === "object" && nested ? nested : null) ??
    null
  );
}

export function getStoredJwt() {
  try {
    return localStorage.getItem(JWT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * @param {string} token
 */
export function setStoredJwt(token) {
  try {
    localStorage.setItem(JWT_STORAGE_KEY, token);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * @param {string} role
 */
export function setStoredRole(role) {
  try {
    if (role) localStorage.setItem(ROLE_STORAGE_KEY, role);
    else localStorage.removeItem(ROLE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function getStoredRole() {
  try {
    return localStorage.getItem(ROLE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearStoredJwt() {
  try {
    localStorage.removeItem(JWT_STORAGE_KEY);
    localStorage.removeItem(ROLE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
