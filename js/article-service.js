import { apiUrl, paths } from "./config.js";
import { apiFetch, parseJson } from "./api.js";


export function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const v =
      /** @type {Record<string, unknown>} */ (payload).value ??
      /** @type {Record<string, unknown>} */ (payload).Value;
    if (Array.isArray(v)) return v;
  }
  return [];
}

/**
 * Rewrite relative image sources to API absolute URLs so images render
 * correctly when FE and API are on different origins.
 * @param {string} html
 */
function normalizeImageSrcs(html) {
  if (!html) return "";
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  for (const img of wrapper.querySelectorAll("img")) {
    const src = (img.getAttribute("src") || "").trim();
    if (!src) continue;
    if (
      src.startsWith("http://") ||
      src.startsWith("https://") ||
      src.startsWith("data:")
    ) {
      continue;
    }
    if (src.startsWith("/")) {
      img.setAttribute("src", apiUrl(src));
    }
  }
  return wrapper.innerHTML;
}

/**
 * True when HTML has visible text or embedded media (e.g. images without alt).
 * Quill empty state `<p><br></p>` is not meaningful.
 * @param {string} html
 */
export function isMeaningfulHtmlContent(html) {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  const text = (div.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200c\u200d]/g, "")
    .trim();
  if (text !== "") return true;
  return Boolean(
    div.querySelector("img, picture, video, iframe, svg, object, canvas")
  );
}

/**
 * @param {Record<string, unknown>|null} data
 */
export function pickHtml(data) {
  if (!data) return "";
  const raw = String(
    data.htmlContent ??
      data.HtmlContent ??
      data.html ??
      data.Html ??
      data.body ??
      data.Body ??
      data.content ??
      data.Content ??
      ""
  );
  return normalizeImageSrcs(raw);
}

/**
 * @param {Record<string, unknown>|null} data
 */
export function pickHtmlArabic(data) {
  if (!data) return "";
  const raw = String(
    data.htmlContentArabic ??
      data.HtmlContentArabic ??
      data.htmlArabic ??
      data.HtmlArabic ??
      ""
  );
  return normalizeImageSrcs(raw);
}

/**
 * @param {Record<string, unknown>|null} data
 */
export function pickTitle(data) {
  if (!data) return "Article";
  return String(data.title ?? data.Title ?? "Article");
}

/**
 * @param {Record<string, unknown>|null} data
 */
export function pickTitleArabic(data) {
  if (!data) return "";
  return String(data.titleArabic ?? data.TitleArabic ?? "");
}

/**
 * Creator display name from article / submission DTO (e.g. GET /api/articles/{id}).
 * @param {Record<string, unknown>|null|undefined} data
 * @returns {string}
 */
export function pickCreatedByFullName(data) {
  if (!data || typeof data !== "object") return "";
  const d = /** @type {Record<string, unknown>} */ (data);
  const raw = d.createdByFullName ?? d.CreatedByFullName;
  if (raw == null || raw === "") return "";
  return String(raw).trim();
}

/**
 * @param {Record<string, unknown>|null} data
 */
export function hasArabicBody(data) {
  if (!data) return false;
  const raw = String(
    data.htmlContentArabic ??
      data.HtmlContentArabic ??
      data.htmlArabic ??
      data.HtmlArabic ??
      ""
  );
  return isMeaningfulHtmlContent(raw);
}

/**
 * Remove Quill-style empty paragraphs (`<p><br></p>`, whitespace-only, etc.)
 * from rendered article HTML so layout stays tight.
 * @param {ParentNode | null | undefined} root
 */
export function collapseBlankParagraphsForDisplay(root) {
  if (!root) return;
  const ps = [...root.querySelectorAll("p")];
  for (const p of ps) {
    if (isMeaningfulHtmlContent(p.innerHTML)) continue;
    p.remove();
  }
}

/**
 * @param {string|number} id
 */
export async function fetchArticle(id) {
  const res = await apiFetch(paths.article(id), { method: "GET" });
  const data = await parseJson(res);
  return { ok: res.ok, data };
}
