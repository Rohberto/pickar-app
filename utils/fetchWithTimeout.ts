/**
 * Raw `fetch()` calls (Cloudinary uploads, etc.) don't go through the
 * shared `services/api.ts` axios instance, which has a 30s timeout —
 * so they have no timeout at all. If the network hangs, a caller doing
 * `setUploading(true) ... await fetch(...) ... finally { setUploading(false) }`
 * never reaches `finally`, leaving that button's spinner stuck forever
 * (the same root cause as the App Review login-spinner bug, just scoped
 * to a single upload button instead of the whole login flow).
 *
 * Use this in place of a bare `fetch(...)` anywhere the result isn't
 * already time-bounded some other way.
 */
export const fetchWithTimeout = (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 30000
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};
