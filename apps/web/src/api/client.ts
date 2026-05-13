import axios, { type AxiosInstance } from 'axios';

const TOKEN_KEY = 'physio.token';

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export function createApiClient(baseURL = '/api'): AxiosInstance {
  const instance = axios.create({ baseURL });
  instance.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  });
  instance.interceptors.response.use(
    (r) => r,
    (error) => {
      if (error.response?.status === 401) {
        clearToken();
      }
      return Promise.reject(error);
    },
  );
  return instance;
}

export const apiClient = createApiClient();
