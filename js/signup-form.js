import { page } from "./config.js";
import { verifySession, signup } from "./auth.js";
import { initThemeUi } from "./theme.js";

const USERNAME_MIN = 3;
const USERNAME_MAX = 20;
const PASSWORD_MIN = 2;
const PASSWORD_MAX = 20;

function validateInput(username, password) {
  if (!username) return "Username is required.";
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return `Username must be between ${USERNAME_MIN} and ${USERNAME_MAX} characters.`;
  }
  if (!password) return "Password is required.";
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return `Password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters.`;
  }
  return "";
}

async function init() {
  initThemeUi();
  const existing = await verifySession();
  if (existing) {
    window.location.href = page("index.html");
    return;
  }

  const form = document.getElementById("signup-form");
  const err = document.getElementById("signup-error");
  const adminBtn = document.getElementById("signup-admin-btn");
  const usernameEl = document.getElementById("username");
  const passwordEl = document.getElementById("password");
  if (!form) return;

  const setError = (msg) => {
    if (!err) return;
    err.textContent = msg;
    err.classList.remove("hidden");
  };

  const clearError = () => {
    if (!err) return;
    err.textContent = "";
    err.classList.add("hidden");
  };

  const submitSignup = async (useAdminFlow) => {
    clearError();
    const username = usernameEl?.value?.trim() ?? "";
    const password = passwordEl?.value ?? "";
    const validationMsg = validateInput(username, password);
    if (validationMsg) {
      setError(validationMsg);
      return;
    }

    let adminPassword;
    if (useAdminFlow) {
      const entered = window.prompt("Enter the admin registration password:");
      if (entered == null) return;
      adminPassword = entered;
    }

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    if (adminBtn) adminBtn.disabled = true;
    try {
      const result = await signup({
        username,
        password,
        ...(useAdminFlow ? { adminPassword } : {}),
      });
      if (result.ok) {
        window.location.href = page("index.html");
        return;
      }
      const msg =
        (result.data &&
          (result.data.message ||
            result.data.Message ||
            result.data.error ||
            result.data.raw)) ||
        "Could not create account.";
      setError(String(msg));
    } catch {
      setError("Network error. Try again.");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (adminBtn) adminBtn.disabled = false;
    }
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void submitSignup(false);
  });

  adminBtn?.addEventListener("click", () => {
    void submitSignup(true);
  });
}

void init();
