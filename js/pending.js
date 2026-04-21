import { paths } from "./config.js";
import { apiFetch, parseJson } from "./api.js";
import { pickCreatedByFullName, unwrapList } from "./article-service.js";
import { guardProtectedPage } from "./boot.js";
import { bindLogout } from "./nav.js";
import { initThemeUi } from "./theme.js";

/**
 * @param {unknown} payload
 */
function normalizePending(payload) {
  const raw = unwrapList(payload);
  return raw
    .map((row) => ({
      id: row.id ?? row.Id,
      title: row.title ?? row.Title ?? "Untitled",
      titleArabic: row.titleArabic ?? row.TitleArabic ?? "",
      createdAt: row.createdAt ?? row.CreatedAt,
      createdByFullName: pickCreatedByFullName(
        /** @type {Record<string, unknown>} */ (row)
      ),
    }))
    .filter((x) => x.id != null);
}

/**
 * @param {string | number | undefined} createdAt
 */
function formatWhen(createdAt) {
  if (createdAt == null || createdAt === "") return "—";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return String(createdAt);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function loadPending(root, statusEl) {
  if (statusEl) {
    statusEl.classList.add("hidden");
    statusEl.textContent = "";
  }
  if (!root) return;
  root.innerHTML = `<p class="text-muted">Loading…</p>`;

  try {
    const res = await apiFetch(paths.adminPendingArticles, { method: "GET" });
    const data = await parseJson(res);
    if (!res.ok) {
      const msg =
        (data &&
          (data.message || data.Message || data.error || data.raw)) ||
        "Could not load pending list.";
      root.innerHTML = "";
      if (statusEl) {
        statusEl.textContent = String(msg);
        statusEl.classList.remove("hidden");
      }
      return;
    }

    const items = normalizePending(data);
    root.innerHTML = "";

    if (!items.length) {
      const p = document.createElement("p");
      p.className = "sidebar-muted";
      p.textContent = "No submissions are waiting for review.";
      root.appendChild(p);
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "pending-list";

    for (const item of items) {
      const li = document.createElement("li");
      li.className = "pending-list__item card";

      const main = document.createElement("div");
      main.className = "pending-list__main";

      const title = document.createElement("p");
      title.className = "pending-list__title";
      title.textContent = item.title;

      main.appendChild(title);

      const ar = String(item.titleArabic || "").trim();
      if (ar) {
        const titleAr = document.createElement("p");
        titleAr.className = "pending-list__title-ar";
        titleAr.setAttribute("dir", "rtl");
        titleAr.setAttribute("lang", "ar");
        titleAr.textContent = ar;
        main.appendChild(titleAr);
      }

      const meta = document.createElement("p");
      meta.className = "pending-list__meta text-muted";
      const when = `Submitted ${formatWhen(item.createdAt)}`;
      meta.textContent = item.createdByFullName
        ? `${when} · ${item.createdByFullName}`
        : when;

      main.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "pending-list__actions";

      const approveBtn = document.createElement("button");
      approveBtn.type = "button";
      approveBtn.className = "btn btn--primary";
      approveBtn.textContent = "Approve";

      const declineBtn = document.createElement("button");
      declineBtn.type = "button";
      declineBtn.className = "btn btn--secondary";
      declineBtn.textContent = "Decline";

      approveBtn.addEventListener("click", () =>
        actOnSubmission(item.id, "approve", root, statusEl)
      );
      declineBtn.addEventListener("click", () => {
        if (!window.confirm("Decline this submission? It will not be published.")) {
          return;
        }
        actOnSubmission(item.id, "decline", root, statusEl);
      });

      actions.appendChild(approveBtn);
      actions.appendChild(declineBtn);

      li.appendChild(main);
      li.appendChild(actions);
      ul.appendChild(li);
    }

    root.appendChild(ul);
  } catch {
    root.innerHTML = "";
    if (statusEl) {
      statusEl.textContent = "Network error.";
      statusEl.classList.remove("hidden");
    }
  }
}

/**
 * @param {string | number} id
 * @param {"approve" | "decline"} action
 */
async function actOnSubmission(id, action, root, statusEl) {
  const path =
    action === "approve"
      ? paths.adminApproveArticle(id)
      : paths.adminDeclineArticle(id);
  try {
    const res = await apiFetch(path, { method: "POST" });
    if (!res.ok) {
      const data = await parseJson(res);
      const msg =
        (data &&
          (data.message || data.Message || data.error || data.raw)) ||
        `Could not ${action}.`;
      if (statusEl) {
        statusEl.textContent = String(msg);
        statusEl.classList.remove("hidden");
      }
      return;
    }
    await loadPending(root, statusEl);
  } catch {
    if (statusEl) {
      statusEl.textContent = "Network error.";
      statusEl.classList.remove("hidden");
    }
  }
}

async function boot() {
  initThemeUi();
  const user = await guardProtectedPage({ requireAdmin: true });
  if (!user) return;

  bindLogout();
  const root = document.getElementById("pending-list-root");
  const statusEl = document.getElementById("pending-status");
  await loadPending(root, statusEl);
}

boot();
