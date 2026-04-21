import { page } from "./config.js";
import {
  verifySession,
  canPublish,
  canOpenEditor,
  isAdmin,
} from "./auth.js";

/**
 * @param {{
 *   requirePublisher?: boolean;
 *   requireEditorAccess?: boolean;
 *   requireAdmin?: boolean;
 * }} [options]
 */
export async function guardProtectedPage(options = {}) {
  const user = await verifySession();
  if (!user) {
    window.location.href = page("login.html");
    return null;
  }
  if (options.requireAdmin && !isAdmin(user.roles)) {
    window.location.href = page("index.html");
    return null;
  }
  if (options.requirePublisher && !canPublish(user.roles)) {
    window.location.href = page("index.html");
    return null;
  }
  if (options.requireEditorAccess && !canOpenEditor(user.roles)) {
    window.location.href = page("index.html");
    return null;
  }
  return user;
}
