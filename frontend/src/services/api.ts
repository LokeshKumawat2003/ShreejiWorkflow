import axios, { type AxiosError } from 'axios';

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
  baseURL: import.meta.env.VITE_API_URL ?? 'https://shreejiworkflow.onrender.com/api',
});

export function getAccessToken() {
  return localStorage.getItem('accessToken') ?? sessionStorage.getItem('accessToken');
}

export function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload)) as { exp?: number };
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isAccessTokenExpired() {
  const token = getAccessToken();
  if (!token) return true;
  const expiry = getTokenExpiry(token);
  return expiry !== null && Date.now() >= expiry;
}

export function logoutToLogin() {
  clearAccessToken();
  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

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

export function setAccessToken(token: string, rememberMe: boolean) {
  const storage = rememberMe ? localStorage : sessionStorage;
  const otherStorage = rememberMe ? sessionStorage : localStorage;

  otherStorage.removeItem('accessToken');
  storage.setItem('accessToken', token);
}

export function clearAccessToken() {
  localStorage.removeItem('accessToken');
  sessionStorage.removeItem('accessToken');
}

export default api;