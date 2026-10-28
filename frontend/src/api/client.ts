import axios from 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    _retry?: boolean;
  }
}

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshRequest: Promise<string> | null = null;

// Auto-attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('aurabank_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const refreshToken = localStorage.getItem('aurabank_refresh_token');
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      refreshToken &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;
      try {
        if (!refreshRequest) {
          refreshRequest = axios
            .post('/api/auth/refresh', { refreshToken })
            .then(({ data }) => {
              localStorage.setItem('aurabank_token', data.accessToken);
              localStorage.setItem('aurabank_refresh_token', data.refreshToken);
              return data.accessToken as string;
            })
            .finally(() => {
              refreshRequest = null;
            });
        }
        const accessToken = await refreshRequest;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('aurabank_token');
        localStorage.removeItem('aurabank_refresh_token');
        localStorage.removeItem('aurabank_user');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('aurabank_token');
      localStorage.removeItem('aurabank_refresh_token');
      localStorage.removeItem('aurabank_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
