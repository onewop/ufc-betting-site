/**
 * devAccess.js — Developer / owner bypass for Pro-gated features.
 *
 * HOW TO USE:
 *   import { isPro } from "../utils/devAccess";
 *   const userIsPro = isPro(currentUser);
 *
 * HOW TO DISABLE:
 *   Set DEV_EMAILS to an empty array: []
 *   Or flip DEV_BYPASS_ENABLED to false.
 */

// ─── Toggle — set false (or clear DEV_EMAILS) to fully disable the bypass ───
const DEV_BYPASS_ENABLED = true;

// ─── Emails granted automatic Pro access ────────────────────────────────────
const DEV_EMAILS = ["toscott4321@gmail.com"];

/**
 * Returns true if the email belongs to a dev/owner account.
 * Case-insensitive comparison.
 */
export const isDevUser = (email) => {
  if (!DEV_BYPASS_ENABLED) return false;
  if (!email) return false;
  return DEV_EMAILS.includes(email.toLowerCase().trim());
};

/**
 * Drop-in replacement for  currentUser?.subscription_status === "pro".
 * Returns true for:
 *   - Real Pro subscribers (subscription_status === "pro")
 *   - Active free trial users (subscription_status === "trial" and not yet expired)
 *   - Dev / owner accounts
 */
export const isPro = (user) => {
  if (!user) return false;
  if (isDevUser(user.email)) return true;
  if (user.subscription_status === "pro") return true;
  if (user.subscription_status === "trial") {
    // Check expiry if available; default to allowing access if field is missing
    if (!user.trial_expires_at) return true;
    return new Date(user.trial_expires_at) > new Date();
  }
  return false;
};
