import axios, { type AxiosError } from 'axios';
import type { User } from '../types';

// Only a flag, never the token: sessionStorage is cleared when the tab closes,
// which is what ends a login made without "Remember me".
const TAB_SESSION_KEY = 'tabSession';

type ApiErrorResponse = {
  message?: string;
};

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const api = axios.create({
  // baseURL: import.meta.env.VITE_API_URL ?? 'https://shreejiworkflow.onrender.com/api',
  
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api',
  withCredentials: true,
});

export function logoutToLogin() {
  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}

export function markTabSession() {
  sessionStorage.setItem(TAB_SESSION_KEY, '1');
}

export async function logout() {
  sessionStorage.removeItem(TAB_SESSION_KEY);
  await api.post('/auth/logout').catch(() => undefined);
}

export async function getSessionUser(): Promise<User | null> {
  try {
    const { data } = await api.get<{ user: User; rememberMe: boolean }>('/auth/me');
    if (data.rememberMe || sessionStorage.getItem(TAB_SESSION_KEY)) return data.user;
    return null;
  } catch {
    return null;
  }
}

export async function checkSession() {
  try {
    await api.get('/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) logoutToLogin();
  }
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    const status = error.response?.status;
    const isAuthRequest = error.config?.url?.startsWith('/auth/') ?? false;
    if (status === 401 && !isAuthRequest) {
      logoutToLogin();
    }

    const message = error.response?.data?.message ?? 'The request could not be completed.';
    return Promise.reject(new ApiError(message, status));
  },
);

export default api;
