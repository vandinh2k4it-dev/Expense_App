const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

let token = localStorage.getItem('token') || '';
let onUnauthorized = () => {};

export const setToken = (t) => {
  token = t || '';
  if (t) localStorage.setItem('token', t);
  else localStorage.removeItem('token');
};
export const getToken = () => token;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function req(path, { method = 'GET', body, params } = {}) {
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)).toString()
    : '';
  let res;
  try {
    res = await fetch(`${BASE}${path}${qs}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Không kết nối được máy chủ. Nếu server free đang ngủ, hãy thử lại sau ~30 giây.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra');
  return data;
}

export const api = {
  register: (username, password, display_name, avatar) =>
    req('/api/auth/register', { method: 'POST', body: { username, password, display_name, avatar } }),
  login: (username, password) => req('/api/auth/login', { method: 'POST', body: { username, password } }),
  me: () => req('/api/me'),
  updateMe: (body) => req('/api/me', { method: 'PUT', body }),
  list: (params) => req('/api/expenses', { params }),
  create: (e) => req('/api/expenses', { method: 'POST', body: e }),
  update: (id, e) => req(`/api/expenses/${id}`, { method: 'PUT', body: e }),
  remove: (id) => req(`/api/expenses/${id}`, { method: 'DELETE' }),
  summary: (from, to) => req('/api/stats/summary', { params: { from, to } }),
  months: (year) => req('/api/stats/months', { params: { year } }),
  ping: () => req('/health'),
};
