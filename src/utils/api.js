// Centralized authed fetch wrapper.
// - Auto-injects Bearer token from localStorage
// - On 401 (expired/invalid session): clears local auth, redirects to /login
//   Premium endpoints return 403 — those are NOT logged out (just denied access)

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export async function apiFetch(url, opts = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('walletdna_token') : null;
  const headers = {
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, { ...opts, headers });

  if (res.status === 401 && token) {
    localStorage.removeItem('walletdna_token');
    if (onUnauthorized) onUnauthorized();
    else if (typeof window !== 'undefined') window.location.href = '/login';
  }
  return res;
}

export async function apiJson(url, opts = {}) {
  const r = await apiFetch(url, opts);
  return r.json();
}
