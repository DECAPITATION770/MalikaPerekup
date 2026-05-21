import axios from 'axios';

export const UNAUTHORIZED_EVENT = 'tenant:unauthorized';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tenant_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
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
