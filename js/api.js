import { apiUrl } from "./config.js";
import { getStoredJwt } from "./jwt-storage.js";

/**
 * @param {string} path
 * @param {RequestInit & { skipAuth?: boolean }} [init]
 */
export function apiFetch(path, init) {
  const { skipAuth, ...rest } = init ?? {};
  const merged = {
    headers: {},
    ...rest,
  };
  const headers = {
    Accept: "application/json",
    ...merged.headers,
  };
  const token = !skipAuth && getStoredJwt();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (
    merged.body &&
    typeof merged.body === "string" &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }
  merged.headers = headers;

  const url = apiUrl(path);
  return fetch(url, merged);
}

/**
 * @param {Response} res
 */
export async function parseJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("json")) {
    return res.json();
  }
  const text = await res.text();
  return text ? { raw: text } : {};
}
