import axios from 'axios';
import { clearAuthSession, getAuthSession } from './auth.js';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const session = getAuthSession();
  if (session?.token) config.headers.Authorization = `Bearer ${session.token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRoute = /\/auth\/(login|register)$/.test(error.config?.url || '');
    if (error.response?.status === 401 && !isAuthRoute) {
      clearAuthSession();
      window.dispatchEvent(new Event('thandal:session-expired'));
    }
    return Promise.reject(error);
  },
);

export async function apiRequest(path, options = {}) {
  const { body, ...config } = options;
  try {
    const response = await apiClient.request({ url: path, ...config, data: config.data ?? body });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || error.message || 'Request failed.', { cause: error });
  }
}
