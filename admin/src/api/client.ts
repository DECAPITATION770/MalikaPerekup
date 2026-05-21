import axios from 'axios';

export const UNAUTHORIZED_EVENT = 'admin:unauthorized';

const api = axios.create({
  baseURL: '/api/v1/admin',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Don't trigger on the login endpoints themselves — those legitimately
      // 401 with bad creds and the form should handle it inline.
      const url: string = err.config?.url ?? '';
      const isAuthCall = url.includes('/auth/login') || url.includes('/auth/telegram');
      if (!isAuthCall) {
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      }
    }
    return Promise.reject(err);
  },
);

export default api;
