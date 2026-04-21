import { apiUrl, paths, page } from "./config.js";
import { apiFetch, parseJson } from "./api.js";
import { isAdmin } from "./auth.js";
import { guardProtectedPage } from "./boot.js";
import { bindLogout } from "./nav.js";
import { initThemeUi } from "./theme.js";
import {
  fetchArticle,
  isMeaningfulHtmlContent,
  pickCreatedByFullName,
  pickHtml,
  pickHtmlArabic,
  pickTitle,
  pickTitleArabic,
} from "./article-service.js";

let quillInstance = null;
let quillArInstance = null;

/** @type {{ roles?: string[] } | null} */
let editorUser = null;

/** @type {string | null} */
let editId = null;

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link", "image"],
  ["clean"],
];

function getQueryId() {
  return new URLSearchParams(window.location.search).get("id");
}

/**
 * Normalize upload API payloads (camelCase / PascalCase / nested / path-only).
 * @param {unknown} data
 * @returns {string} Absolute URL for the image, or "" if missing.
 */
function resolveUploadedImageUrl(data) {
  if (!data || typeof data !== "object") return "";
  const d = /** @type {Record<string, unknown>} */ (data);
  const nested = d.data ?? d.Data;
  const src =
    (typeof nested === "object" && nested !== null
      ? /** @type {Record<string, unknown>} */ (nested)
      : d);
  const pathOnly = [
    src.url,
    src.Url,
    src.path,
    src.Path,
    src.fileUrl,
    src.FileUrl,
    src.imageUrl,
    src.ImageUrl,
    src.location,
    src.Location,
  ].find((v) => typeof v === "string" && v.trim());
  if (!pathOnly) return "";
  const t = pathOnly.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  return apiUrl(t.startsWith("/") ? t : `/${t}`);
}

/**
 * SHA-256 hex of file bytes. Empty string if unavailable (no SubtleCrypto).
 * Used to skip duplicate uploads when the same image is inserted in EN + AR.
 * @param {File} file
 * @returns {Promise<string>}
 */
async function sha256HexOfFile(file) {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return "";
    const buf = await file.arrayBuffer();
    const digest = await subtle.digest("SHA-256", buf);
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}

/** In-memory dedup for this editor session: content hash → URL (in-flight or settled). */
const imageUrlByContentHash = new Map();

/**
 * POST file to image API; returns resolved absolute image URL or throws.
 * @param {File} file
 */
async function uploadImageToServer(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch(paths.imageUpload, {
    method: "POST",
    body: form,
    headers: {},
  });
  const data = await parseJson(res);
  if (!res.ok) {
    const msg =
      (data &&
        typeof data === "object" &&
        (data.message ||
          data.Message ||
          data.error ||
          data.title ||
          data.Title ||
          data.detail ||
          data.Detail)) ||
      `Image upload failed (HTTP ${res.status}).`;
    throw new Error(String(msg));
  }
  const url = resolveUploadedImageUrl(data);
  if (!url) {
    console.error("[Quill image upload] Unexpected JSON:", data);
    throw new Error(
      "Upload succeeded but the server response had no image URL."
    );
  }
  return url;
}

/**
 * Upload once per identical file (same bytes) per browser tab session.
 * @param {File} file
 */
function getOrUploadImageUrl(file) {
  return (async () => {
    const hash = await sha256HexOfFile(file);
    if (hash) {
      const cached = imageUrlByContentHash.get(hash);
      if (cached) return cached;
    }

    const pending = uploadImageToServer(file);
    if (hash) {
      imageUrlByContentHash.set(hash, pending);
      pending.catch(() => {
        imageUrlByContentHash.delete(hash);
      });
    }
    return pending;
  })();
}

function initImageHandler(quill) {
  const toolbar = quill.getModule("toolbar");
  if (!toolbar?.addHandler) return;
  toolbar.addHandler("image", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const statusEl = document.getElementById("editor-status");
      const reportUploadError = (message) => {
        console.error("[Quill image upload]", message);
        if (statusEl) {
          statusEl.textContent = message;
          statusEl.classList.remove("hidden");
        }
      };

      const insertAtCursor = (imageUrl) => {
        const range = quill.getSelection(true);
        const idx =
          range && typeof range.index === "number"
            ? range.index
            : quill.getLength();
        quill.insertEmbed(idx, "image", imageUrl, "user");
      };

      try {
        const url = await getOrUploadImageUrl(file);
        if (statusEl) {
          statusEl.classList.add("hidden");
          statusEl.textContent = "";
        }
        insertAtCursor(url);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Network or unexpected error.";
        reportUploadError(msg);
        const fallback = window.prompt(
          "Image upload failed. Paste image URL (or cancel):"
        );
        if (fallback) insertAtCursor(fallback);
      }
    };
  });
}

/**
 * @param {string} selector
 * @param {boolean} rtl
 */
function createQuill(selector, rtl) {
  if (typeof Quill === "undefined") {
    console.error("Quill not loaded");
    return null;
  }
  const quill = new Quill(selector, {
    theme: "snow",
    modules: {
      toolbar: TOOLBAR,
    },
  });
  initImageHandler(quill);
  if (rtl) {
    quill.root.setAttribute("dir", "rtl");
    quill.root.style.textAlign = "right";
  }
  return quill;
}

function initEditors() {
  quillInstance = createQuill("#editor", false);
  quillArInstance = createQuill("#editor-ar", true);
}

function bilingualPayload() {
  const titleArInput = document.getElementById("article-title-ar-input");
  const titleArabic = titleArInput?.value?.trim() ?? "";
  const htmlContentArabic = quillArInstance?.root.innerHTML ?? "";
  return { titleArabic, htmlContentArabic };
}

/** Matches reader `hasArabicBody` / API nullables for empty Arabic fields. */
function arabicFieldsForApi() {
  const { titleArabic, htmlContentArabic } = bilingualPayload();
  return {
    titleArabic: titleArabic ? titleArabic : null,
    htmlContentArabic: isMeaningfulHtmlContent(htmlContentArabic)
      ? htmlContentArabic
      : null,
  };
}

async function publish() {
  const titleInput = document.getElementById("article-title-input");
  const statusEl = document.getElementById("editor-status");
  const btn = document.getElementById("publish-btn");
  const title = titleInput?.value?.trim() ?? "";
  const admin = isAdmin(editorUser?.roles);

  if (!title) {
    if (statusEl) {
      statusEl.textContent = admin
        ? "Enter a title before publishing."
        : "Enter a title before submitting.";
      statusEl.classList.remove("hidden");
    }
    return;
  }
  if (!quillInstance) return;

  const html = quillInstance.root.innerHTML;
  const ar = arabicFieldsForApi();

  if (btn) btn.disabled = true;
  if (statusEl) {
    statusEl.classList.add("hidden");
    statusEl.textContent = "";
  }

  try {
    if (!admin) {
      const res = await apiFetch(paths.articleSubmission, {
        method: "POST",
        body: JSON.stringify({
          title,
          htmlContent: html,
          titleArabic: ar.titleArabic,
          htmlContentArabic: ar.htmlContentArabic,
        }),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        const msg =
          (data &&
            (data.message ||
              data.Message ||
              data.error ||
              data.raw)) ||
          "Could not submit for review.";
        if (statusEl) {
          statusEl.textContent = String(msg);
          statusEl.classList.remove("hidden");
        }
        return;
      }
      window.location.href = `${page("index.html")}?submitted=1`;
      return;
    }

    const path = editId
      ? paths.adminArticle(editId)
      : paths.adminArticles;
    const method = editId ? "PUT" : "POST";
    const res = await apiFetch(path, {
      method,
      body: JSON.stringify({
        title,
        htmlContent: html,
        titleArabic: ar.titleArabic,
        htmlContentArabic: ar.htmlContentArabic,
      }),
    });
    if (res.status === 204) {
      const dest = `${page("index.html")}?id=${encodeURIComponent(String(editId))}`;
      window.location.href = dest;
      return;
    }
    const data = await parseJson(res);
    if (!res.ok) {
      const msg =
        (data &&
          (data.message ||
            data.Message ||
            data.error ||
            data.raw)) ||
        "Could not save.";
      if (statusEl) {
        statusEl.textContent = String(msg);
        statusEl.classList.remove("hidden");
      }
      return;
    }
    let newId =
      editId ??
      data.id ??
      data.Id;
    if (!newId && res.status === 201) {
      const loc = res.headers.get("Location") || "";
      const m = loc.match(/\/api\/articles\/([^/?#]+)/i);
      if (m) newId = m[1];
    }
    const dest = newId
      ? `${page("index.html")}?id=${encodeURIComponent(String(newId))}`
      : page("index.html");
    window.location.href = dest;
  } catch {
    if (statusEl) {
      statusEl.textContent = "Network error.";
      statusEl.classList.remove("hidden");
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function boot() {
  initThemeUi();
  const user = await guardProtectedPage({ requireEditorAccess: true });
  if (!user) return;

  editorUser = user;
  bindLogout();
  editId = getQueryId();
  const admin = isAdmin(user.roles);

  const heroTitle = document.querySelector(".hero__title");
  const heroSub = document.querySelector(".hero__subtitle");
  const titleInput = document.getElementById("article-title-input");
  const titleArInput = document.getElementById("article-title-ar-input");
  const publishBtn = document.getElementById("publish-btn");

  if (!admin && editId) {
    window.location.replace(page("editor.html"));
    return;
  }

  if (admin) {
    if (editId) {
      if (heroTitle) heroTitle.textContent = "Edit procedure";
      if (heroSub) {
        heroSub.textContent =
          "Update the living document. Changes save for all readers.";
      }
      if (publishBtn) publishBtn.textContent = "Save changes";
    } else {
      if (heroTitle) heroTitle.textContent = "Publish article";
      if (heroSub) {
        heroSub.textContent =
          "Publish goes live immediately for all readers.";
      }
      if (publishBtn) publishBtn.textContent = "Publish";
    }
  } else {
    if (heroTitle) heroTitle.textContent = "Submit procedure";
    if (heroSub) {
      heroSub.textContent =
        "An admin will review your draft before it appears in the knowledge base.";
    }
    if (publishBtn) publishBtn.textContent = "Submit for review";
  }

  initEditors();

  if (editId && quillInstance && quillArInstance && admin) {
    const statusEl = document.getElementById("editor-status");
    const bylineEl = document.getElementById("editor-article-byline");
    const { ok, data } = await fetchArticle(editId);
    if (ok && data && titleInput) {
      titleInput.value = pickTitle(data);
      quillInstance.root.innerHTML = pickHtml(data);
      if (titleArInput) {
        titleArInput.value = pickTitleArabic(data);
      }
      quillArInstance.root.innerHTML = pickHtmlArabic(data);
      const author = pickCreatedByFullName(data);
      if (bylineEl) {
        if (author) {
          bylineEl.textContent = `Created by ${author}`;
          bylineEl.classList.remove("hidden");
        } else {
          bylineEl.textContent = "";
          bylineEl.classList.add("hidden");
        }
      }
    } else if (statusEl) {
      statusEl.textContent = "Could not load this article for editing.";
      statusEl.classList.remove("hidden");
    }
  }

  publishBtn?.addEventListener("click", publish);
}

boot();
