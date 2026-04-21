import { page } from "./config.js";
import { logout } from "./auth.js";

export function bindLogout() {
  document.querySelectorAll('[data-action="logout"]').forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      logout().finally(() => {
        window.location.href = page("login.html");
      });
    });
  });
}
