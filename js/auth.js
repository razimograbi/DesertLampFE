import { paths, PUBLISHER_ROLES, SUBMITTER_ROLES } from "./config.js";
import { apiFetch, parseJson } from "./api.js";
import {
  clearStoredJwt,
  extractJwtFromBody,
  getStoredJwt,
  getStoredRole,
  setStoredJwt,
  setStoredRole,
} from "./jwt-storage.js";

/**
 * @param {string[]|undefined} roles
 */
export function canPublish(roles) {
  if (!roles?.length) return false;
  return roles.some((r) => PUBLISHER_ROLES.includes(r));
}

/**
 * @param {string[]|undefined} roles
 */
export function canSubmitForReview(roles) {
  if (!roles?.length) return false;
  return roles.some((r) => SUBMITTER_ROLES.includes(r));
}

/**
 * @param {string[]|undefined} roles
 */
export function canOpenEditor(roles) {
  return canPublish(roles) || canSubmitForReview(roles);
}

/**
 * @param {string[]|undefined} roles
 */
export function isAdmin(roles) {
  return roles?.some((r) => r === "Admin") ?? false;
}

/**
 * @param {Record<string, unknown>} data
 */
export function normalizeUser(data) {
  if (!data) return null;
  const raw = data.roles ?? data.Roles ?? data.role ?? data.Role;
  let roles = [];
  if (Array.isArray(raw)) {
    roles = raw.map(String);
  } else if (typeof raw === "string" && raw) {
    roles = raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return {
    userId: data.userId ?? data.UserId ?? data.sub,
    email: data.email ?? data.Email,
    roles,
  };
}

/**
 * Validates the stored JWT by calling a protected reader endpoint (no /verify on API).
 */
export async function verifySession() {
  if (!getStoredJwt()) return null;
  try {
    const res = await apiFetch(paths.articles, { method: "GET" });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) clearStoredJwt();
      return null;
    }
    const role = getStoredRole();
    const roles = role ? [role] : [];
    return normalizeUser({ roles });
  } catch {
    return null;
  }
}

/**
 * @param {{ username: string, password: string }} body
 */
export async function login(body) {
  const res = await apiFetch(paths.login, {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
  const data = await parseJson(res);
  console.log("The data is : ", data);
  let hasJwt = false;
  if (res.ok) {
    clearStoredJwt();
    const jwt = extractJwtFromBody(data);
    if (jwt) {
      setStoredJwt(jwt);
      hasJwt = true;
    }
    const roleRaw = data && (data.role ?? data.Role);
    if (roleRaw != null && String(roleRaw).trim() !== "") {
      setStoredRole(String(roleRaw));
    }
  }
  return { ok: res.ok && hasJwt, status: res.status, data };
}

/**
 * @param {{ username: string, password: string, adminPassword?: string }} body
 */
export async function signup(body) {
  const res = await apiFetch(paths.signup, {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
  const data = await parseJson(res);
  console.log(`the res is ${res}`);
  console.log(`the data is ${data}`);
  let hasJwt = false;
  if (res.ok) {
    clearStoredJwt();
    const jwt = extractJwtFromBody(data);
    if (jwt) {
      setStoredJwt(jwt);
      hasJwt = true;
    }
    const roleRaw = data && (data.role ?? data.Role);
    if (roleRaw != null && String(roleRaw).trim() !== "") {
      setStoredRole(String(roleRaw));
    }
  }
  return { ok: res.ok && hasJwt, status: res.status, data };
}

export async function logout() {
  clearStoredJwt();
  return true;
}
