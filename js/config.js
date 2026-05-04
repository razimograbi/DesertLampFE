/**
 * OpsKB — align with the .NET API in one place.
 */
export const BASE_PATH = "";

/**
 * Backend origin (see OpenAPI / Program.cs). Dev HTTPS example from API spec.
 * Set to "" only if the static site is served from the same origin as the API.
 */
export const API_BASE_URL = "https://desertlampbe-baf4dzahhmd0affv.israelcentral-01.azurewebsites.net";
// export const API_BASE_URL = "http://localhost:5104";

/** localStorage key for API JWT (internal tool). */
export const JWT_STORAGE_KEY = "opskb_jwt";

/** Persisted from login: matches API `role` ("Admin" | "Viewer"). */
export const ROLE_STORAGE_KEY = "opskb_role";

/** `"light"` | `"dark"` — default dark when absent. */
export const THEME_STORAGE_KEY = "opskb_theme";

export const paths = {
  login: "/api/auth/login",
  signup: "/api/auth/signup",
  article: (id) => `/api/articles/${encodeURIComponent(id)}`,
  articles: "/api/articles",
  /** @param {string} q */
  articlesSearch: (q) =>
    `/api/articles/search?q=${encodeURIComponent(q)}`,
  adminArticles: "/api/admin/articles",
  adminArticle: (id) =>
    `/api/admin/articles/${encodeURIComponent(id)}`,
  /** POST — body `{ title, htmlContent, titleArabic?, htmlContentArabic? }`; submitter JWT. */
  articleSubmission: "/api/articles/submissions",
  /** GET — current user's submissions (viewer JWT). */
  articleSubmissionsMine: "/api/articles/submissions/mine",
  /** GET — single submission by id (viewer JWT). */
  articleSubmissionById: (id) =>
    `/api/articles/submissions/${encodeURIComponent(id)}`,
  /** GET — admin JWT; pending review queue. */
  adminPendingArticles: "/api/admin/articles/pending",
  /** POST — admin JWT. */
  adminApproveArticle: (id) =>
    `/api/admin/articles/${encodeURIComponent(id)}/approve`,
  /** POST — admin JWT. */
  adminDeclineArticle: (id) =>
    `/api/admin/articles/${encodeURIComponent(id)}/decline`,
  imageUpload: "/api/images/upload",
};

/** Roles that may publish or edit live articles (admin API). */
export const PUBLISHER_ROLES = ["Admin"];

/**
 * Roles that may open the editor and submit drafts for review.
 * Add any JWT role name your API returns for non-admin authors.
 */
export const SUBMITTER_ROLES = ["Viewer", "User", "Author", "Member"];

/**
 * @param {string} name
 */
export function page(name) {
  const base = BASE_PATH.replace(/\/$/, "");
  return base ? `${base}/${name}` : name;
}

/**
 * @param {string} path
 */
export function apiUrl(path) {
  const base = API_BASE_URL.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}
