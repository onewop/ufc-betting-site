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
const DEV_EMAILS = [
  "toscott4321@gmail.com",
];

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
 * Returns true for real Pro subscribers AND dev/owner accounts.
 */
export const isPro = (user) =>
  user?.subscription_status === "pro" || isDevUser(user?.email);
