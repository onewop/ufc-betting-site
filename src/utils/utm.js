/**
 * utm.js — Capture UTM parameters from the URL and persist them in localStorage.
 *
 * Call captureUTM() once on app mount (App.jsx).
 * When a user signs up or converts, call getStoredUTM() to retrieve the original
 * source so you know which video/campaign drove the signup.
 *
 * Example URL:
 *   https://cagevault.com/?utm_source=youtube&utm_medium=video&utm_campaign=islam_preview_apr26
 */

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
];

const STORAGE_KEY = "cv_utm";

/**
 * Read UTM params from the current URL and save them to localStorage.
 * Only overwrites a previously stored value if new UTM params are present —
 * this preserves first-touch attribution across multiple visits.
 */
export function captureUTM() {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = {};
    let hasAny = false;

    UTM_KEYS.forEach((key) => {
      const val = params.get(key);
      if (val) {
        utm[key] = val;
        hasAny = true;
      }
    });

    if (hasAny) {
      utm.captured_at = new Date().toISOString();
      utm.landing_page = window.location.pathname;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
    }
  } catch {
    // localStorage may be blocked in private browsing — fail silently
  }
}

/**
 * Retrieve the stored UTM object, or null if none was ever captured.
 *
 * @returns {{ utm_source?: string, utm_medium?: string, utm_campaign?: string,
 *             utm_term?: string, utm_content?: string,
 *             captured_at: string, landing_page: string } | null}
 */
export function getStoredUTM() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Clear stored UTM data (e.g. after a confirmed conversion).
 */
export function clearUTM() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
