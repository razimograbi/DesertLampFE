import { page } from "./config.js";
import { verifySession, login } from "./auth.js";
import { initThemeUi } from "./theme.js";

async function init() {
  initThemeUi();
  const existing = await verifySession();
  if (existing) {
    window.location.href = page("index.html");
    return;
  }

  const form = document.getElementById("login-form");
  const err = document.getElementById("login-error");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (err) {
      err.textContent = "";
      err.classList.add("hidden");
    }

    const usernameEl = document.getElementById("username");
    const passwordEl = document.getElementById("password");
    const btn = form.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;

    try {
      const result = await login({
        username: usernameEl?.value?.trim() ?? "",
        password: passwordEl?.value ?? "",
      });
      if (result.ok) {
        window.location.href = page("index.html");
        return;
      }
      console.log("The result is : ", result.data);
      let msg = "Sign in failed. Check your credentials.";
      if (result.data.raw) {
        try {
          console.log("We landed here!");
          const parsed = JSON.parse(result.data.raw);
          msg = parsed.title || parsed.detail || parsed.Message || msg;
        } catch {
          msg = result.data.raw;
        }
      } else {
        msg = result.data.title || result.data.Message || result.data.error || msg;
      }
      
      if (err) {
        err.textContent = String(msg);
        err.classList.remove("hidden");
      }
    } catch {
      if (err) {
        err.textContent = "Network error. Try again.";
        err.classList.remove("hidden");
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

init();
