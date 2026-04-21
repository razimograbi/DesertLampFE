import { paths } from "./config.js";
import { apiFetch, parseJson } from "./api.js";
import { unwrapList } from "./article-service.js";
import { debounce } from "./debounce.js";

function normalizeItems(payload) {
  const raw = unwrapList(payload);
  return raw
    .map((row) => ({
      id: row.id ?? row.Id,
      title: row.title ?? row.Title ?? "Untitled",
      titleArabic: row.titleArabic ?? row.TitleArabic ?? "",
    }))
    .filter((x) => x.id != null);
}

/**
 * @param {string} q
 */
export async function searchArticles(q) {
  const query = (q || "").trim();
  if (!query) return [];
  const path = paths.articlesSearch(query);
  const res = await apiFetch(path, { method: "GET" });
  if (!res.ok) return [];
  const payload = await parseJson(res);
  return normalizeItems(payload);
}

/**
 * @param {{
 *   input: HTMLInputElement;
 *   list: HTMLElement;
 *   debounceMs?: number;
 *   onSelect: (id: string | number, title: string) => void;
 * }} opts
 */
export function bindGlobalSearch(opts) {
  const { input, list, debounceMs = 300, onSelect } = opts;

  const render = (items) => {
    list.innerHTML = "";
    if (!items.length) {
      list.classList.add("search-suggest--hidden");
      return;
    }
    list.classList.remove("search-suggest--hidden");
    const ul = document.createElement("ul");
    ul.className = "search-results";
    for (const item of items) {
      const li = document.createElement("li");
      li.className = "search-results__item";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "search-results__btn search-results__btn--bilingual";
      const en = document.createElement("span");
      en.className = "search-results__title-en";
      en.textContent = item.title;
      btn.appendChild(en);
      const ar = String(item.titleArabic || "").trim();
      if (ar) {
        const arEl = document.createElement("span");
        arEl.className = "search-results__title-ar";
        arEl.setAttribute("dir", "rtl");
        arEl.setAttribute("lang", "ar");
        arEl.textContent = ar;
        btn.appendChild(arEl);
      }
      btn.addEventListener("click", () => {
        onSelect(item.id, item.title);
        list.innerHTML = "";
        list.classList.add("search-suggest--hidden");
        input.value = "";
      });
      li.appendChild(btn);
      ul.appendChild(li);
    }
    list.appendChild(ul);
  };

  const run = debounce(() => {
    searchArticles(input.value).then(render);
  }, debounceMs);

  input.addEventListener("input", () => {
    if (!input.value.trim()) {
      list.innerHTML = "";
      list.classList.add("search-suggest--hidden");
      return;
    }
    run();
  });

  document.addEventListener("click", (e) => {
    if (!list.contains(e.target) && e.target !== input) {
      list.classList.add("search-suggest--hidden");
    }
  });

  input.addEventListener("focus", () => {
    if (input.value.trim()) {
      searchArticles(input.value).then(render);
    }
  });
}
