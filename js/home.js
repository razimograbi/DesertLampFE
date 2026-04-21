import { page, paths } from "./config.js";
import { apiFetch, parseJson } from "./api.js";
import { canPublish, canOpenEditor, isAdmin } from "./auth.js";
import { guardProtectedPage } from "./boot.js";
import { bindGlobalSearch } from "./search.js";
import { bindLogout } from "./nav.js";
import { initThemeUi } from "./theme.js";
import {
  collapseBlankParagraphsForDisplay,
  fetchArticle,
  hasArabicBody,
  pickCreatedByFullName,
  pickHtml,
  pickHtmlArabic,
  pickTitle,
  pickTitleArabic,
  unwrapList,
} from "./article-service.js";

/** @type {string | number | null} */
let currentArticleId = null;

function normalizeTrending(payload) {
  const raw = unwrapList(payload);
  return raw
    .map((row) => {
      const rec = /** @type {Record<string, unknown>} */ (row);
      const vc = rec.viewCount ?? rec.ViewCount;
      const viewCount =
        typeof vc === "number" && Number.isFinite(vc)
          ? vc
          : typeof vc === "string" && vc.trim() !== ""
            ? Number(vc)
            : null;
      return {
        id: rec.id ?? rec.Id,
        title: rec.title ?? rec.Title ?? "Untitled",
        titleArabic: rec.titleArabic ?? rec.TitleArabic ?? "",
        createdByFullName: pickCreatedByFullName(rec),
        viewCount:
          viewCount != null && !Number.isNaN(viewCount) ? viewCount : null,
      };
    })
    .filter((x) => x.id != null);
}

function getIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  return id;
}

function setUrlId(id) {
  const url = new URL(window.location.href);
  if (id == null) {
    url.searchParams.delete("id");
  } else {
    url.searchParams.set("id", String(id));
  }
  window.history.pushState({ id }, "", url);
}

/**
 * @param {{ roles?: string[] }} user
 */
function updatePublisherChrome(user) {
  const canEditLive = canPublish(user.roles);
  const canCompose = canOpenEditor(user.roles);
  const newLink = document.getElementById("nav-new-article");
  const editLink = document.getElementById("nav-edit-current");
  const pendingLink = document.getElementById("nav-pending-reviews");

  if (newLink) {
    newLink.classList.toggle("hidden", !canCompose);
  }
  if (pendingLink) {
    pendingLink.classList.toggle("hidden", !isAdmin(user.roles));
  }
  if (editLink) {
    const showEdit = canEditLive && currentArticleId != null;
    editLink.classList.toggle("hidden", !showEdit);
    if (showEdit) {
      editLink.href = `${page("editor.html")}?id=${encodeURIComponent(String(currentArticleId))}`;
    }
  }
}

function showArticlePanel(show) {
  const empty = document.getElementById("article-empty");
  const panel = document.getElementById("article-panel");
  if (empty) empty.classList.toggle("hidden", show);
  if (panel) panel.classList.toggle("hidden", !show);
}

/**
 * @param {string | number} id
 */
function resetArticleByline() {
  const el = document.getElementById("article-byline");
  if (el) {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

function resetArticleArabic() {
  const titleAr = document.getElementById("article-title-ar");
  const contentAr = document.getElementById("article-content-ar");
  if (titleAr) {
    titleAr.textContent = "";
    titleAr.classList.add("hidden");
  }
  if (contentAr) contentAr.innerHTML = "";
  const section = document.getElementById("article-ar-section");
  if (section) section.classList.add("hidden");
}

async function selectArticle(id, user) {
  currentArticleId = id;
  setUrlId(id);
  updatePublisherChrome(user);

  const titleEl = document.getElementById("article-title");
  const contentEl = document.getElementById("article-content");
  const errEl = document.getElementById("article-error");

  if (errEl) {
    errEl.textContent = "";
    errEl.classList.add("hidden");
  }

  showArticlePanel(true);
  if (titleEl) titleEl.textContent = "Loading…";
  if (contentEl) contentEl.innerHTML = "";
  resetArticleByline();
  resetArticleArabic();

  try {
    const { ok, data } = await fetchArticle(id);
    if (!ok) {
      if (titleEl) titleEl.textContent = "Article";
      if (contentEl) contentEl.innerHTML = "";
      resetArticleByline();
      if (errEl) {
        errEl.textContent = "Could not load this article.";
        errEl.classList.remove("hidden");
      }
      return;
    }
    if (titleEl) titleEl.textContent = pickTitle(data);
    const byline = document.getElementById("article-byline");
    const author = pickCreatedByFullName(data);
    if (byline) {
      if (author) {
        byline.textContent = `By ${author}`;
        byline.classList.remove("hidden");
      } else {
        byline.textContent = "";
        byline.classList.add("hidden");
      }
    }
    if (contentEl) {
      contentEl.innerHTML = pickHtml(data);
      collapseBlankParagraphsForDisplay(contentEl);
    }

    const titleAr = document.getElementById("article-title-ar");
    const contentAr = document.getElementById("article-content-ar");
    const arTitle = pickTitleArabic(data).trim();
    const arHtml = pickHtmlArabic(data);
    const showArBody = hasArabicBody(data);
    const showArSection = showArBody || Boolean(arTitle);

    if (titleAr) {
      if (arTitle) {
        titleAr.textContent = arTitle;
        titleAr.classList.remove("hidden");
      } else {
        titleAr.textContent = "";
        titleAr.classList.add("hidden");
      }
    }
    if (contentAr) {
      contentAr.innerHTML = arHtml;
      collapseBlankParagraphsForDisplay(contentAr);
    }
    const section = document.getElementById("article-ar-section");
    if (section) {
      section.classList.toggle("hidden", !showArSection);
    }
  } catch {
    if (titleEl) titleEl.textContent = "Article";
    if (contentEl) contentEl.innerHTML = "";
    resetArticleByline();
    resetArticleArabic();
    if (errEl) {
      errEl.textContent = "Network error.";
      errEl.classList.remove("hidden");
    }
  }
}

function clearArticle(user) {
  currentArticleId = null;
  setUrlId(null);
  updatePublisherChrome(user);
  showArticlePanel(false);
  resetArticleByline();
  resetArticleArabic();
  const errEl = document.getElementById("article-error");
  if (errEl) {
    errEl.textContent = "";
    errEl.classList.add("hidden");
  }
}

/**
 * @param {HTMLElement} container
 */
function showTrendingLoading(container) {
  container.innerHTML = "";
  container.setAttribute("aria-busy", "true");
  const wrap = document.createElement("div");
  wrap.className = "trending-loading";
  wrap.setAttribute("role", "status");
  wrap.setAttribute("aria-live", "polite");
  const spinner = document.createElement("span");
  spinner.className = "trending-loading__spinner";
  spinner.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.className = "trending-loading__label";
  label.textContent = "Loading articles…";
  wrap.appendChild(spinner);
  wrap.appendChild(label);
  container.appendChild(wrap);
}

/**
 * @param {HTMLElement} container
 */
function finishTrendingLoad(container) {
  container.removeAttribute("aria-busy");
}

function loadTrending(container, user) {
  if (!container) return;
  showTrendingLoading(container);
  apiFetch(paths.articles, { method: "GET" })
    .then((res) => (res.ok ? parseJson(res) : Promise.resolve([])))
    .then((payload) => normalizeTrending(payload))
    .then((items) => {
      container.innerHTML = "";
      if (!items.length) {
        const empty = document.createElement("p");
        empty.className = "sidebar-muted";
        empty.textContent =
          "Top articles appear here as your team navigates procedures.";
        container.appendChild(empty);
        return;
      }
      const ul = document.createElement("ul");
      ul.className = "trending-list";
      for (const item of items) {
        const li = document.createElement("li");
        li.className = "trending-list__item";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "trending-list__btn";

        const ar = String(item.titleArabic || "").trim();
        const label = ar ? `${item.title} (${ar})` : item.title;
        btn.setAttribute("aria-label", `Open article: ${label}`);

        const row = document.createElement("span");
        row.className = "trending-list__row";

        const stack = document.createElement("span");
        stack.className = "trending-list__stack";

        const en = document.createElement("span");
        en.className = "trending-list__title-en";
        en.textContent = item.title;
        stack.appendChild(en);

        if (ar) {
          const arEl = document.createElement("span");
          arEl.className = "trending-list__title-ar";
          arEl.setAttribute("dir", "rtl");
          arEl.setAttribute("lang", "ar");
          arEl.textContent = ar;
          stack.appendChild(arEl);
        }

        const hasViews =
          item.viewCount != null && item.viewCount >= 0;
        if (item.createdByFullName || hasViews) {
          const meta = document.createElement("span");
          meta.className = "trending-list__meta";
          if (item.createdByFullName) {
            const authorEl = document.createElement("span");
            authorEl.className = "trending-list__meta-author";
            authorEl.textContent = item.createdByFullName;
            meta.appendChild(authorEl);
          }
          if (hasViews) {
            const n = /** @type {number} */ (item.viewCount);
            if (item.createdByFullName) {
              meta.appendChild(document.createTextNode(" · "));
            }
            const viewsEl = document.createElement("span");
            viewsEl.className = "trending-list__meta-views";
            viewsEl.textContent = `${n.toLocaleString()} ${n === 1 ? "view" : "views"}`;
            meta.appendChild(viewsEl);
          }
          stack.appendChild(meta);
        }

        row.appendChild(stack);

        const chevron = document.createElement("span");
        chevron.className = "trending-list__chevron";
        chevron.setAttribute("aria-hidden", "true");
        chevron.textContent = "›";
        row.appendChild(chevron);

        btn.appendChild(row);

        btn.addEventListener("click", () => selectArticle(item.id, user));
        li.appendChild(btn);
        ul.appendChild(li);
      }
      container.appendChild(ul);
    })
    .catch(() => {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "form-error";
      p.textContent = "Could not load top articles.";
      container.appendChild(p);
    })
    .finally(() => finishTrendingLoad(container));
}

function showSubmissionFlash() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("submitted") !== "1") return;
  const flash = document.getElementById("home-flash");
  if (flash) {
    flash.textContent =
      "Your procedure was submitted for review. An admin will publish it when approved.";
    flash.classList.remove("hidden");
  }
  params.delete("submitted");
  const qs = params.toString();
  const path = window.location.pathname;
  window.history.replaceState({}, "", qs ? `${path}?${qs}` : path);
}

async function boot() {
  initThemeUi();
  const user = await guardProtectedPage();
  if (!user) return;

  showSubmissionFlash();

  const emailSlot = document.getElementById("nav-user-email");
  if (emailSlot) {
    emailSlot.textContent =
      user.email || user.roles?.[0] || "Signed in";
  }

  updatePublisherChrome(user);
  bindLogout();

  const trendingRoot = document.getElementById("trending-list-root");
  loadTrending(trendingRoot, user);

  const input = document.getElementById("global-search");
  const suggest = document.getElementById("search-suggest");
  if (input && suggest) {
    bindGlobalSearch({
      input,
      list: suggest,
      debounceMs: 300,
      onSelect: (id) => selectArticle(id, user),
    });
  }

  window.addEventListener("popstate", () => {
    const id = getIdFromUrl();
    if (id) {
      selectArticle(id, user);
    } else {
      clearArticle(user);
    }
  });

  const initialId = getIdFromUrl();
  if (initialId) {
    await selectArticle(initialId, user);
  } else {
    showArticlePanel(false);
  }
}

boot();
