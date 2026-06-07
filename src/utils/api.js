// Tiny authed fetch wrapper. Auto-injects Bearer token from localStorage.
// Use this for every premium-gated /api/* call to avoid 401.

export async function apiFetch(url, opts = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('walletdna_token') : null
  const headers = {
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  return fetch(url, { ...opts, headers })
}

export async function apiJson(url, opts = {}) {
  const r = await apiFetch(url, opts)
  return r.json()
}
