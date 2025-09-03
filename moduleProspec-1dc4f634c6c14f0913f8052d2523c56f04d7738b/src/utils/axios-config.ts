// src/utils/axios-config.ts
import axios from 'axios';
import { cookieUtils } from './cookies';
import { API_BASE_URL } from '../config';

// Configuration globale d'axios pour inclure automatiquement le token d'authentification
const setupAxiosInterceptors = () => {
  // Intercepteur pour les requêtes - ajoute le token Bearer automatiquement
  axios.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Intercepteur pour les réponses - gère l'expiration du token avec refresh logic
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error.response?.status;
      const url: string = error.config?.url || '';
      const originalRequest = error.config;

      // Do not redirect on auth endpoints so the UI can show errors
      if (status === 401) {
        if (url.includes('/auth/login') || url.includes('/auth/setup-password') || url.includes('/auth/refresh-token')) {
          return Promise.reject(error);
        }

        // Avoid infinite loops
        if (originalRequest._retry) {
          // Cleanup and redirect to login
          localStorage.removeItem('access_token');
          cookieUtils.deleteCookie('refresh_token');
          localStorage.removeItem('user');
          
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }

        // Try to refresh the token
        try {
          originalRequest._retry = true;
          const refreshToken = cookieUtils.getCookie('refresh_token');
          
          if (!refreshToken) {
            // No refresh token, cleanup and redirect
            localStorage.removeItem('access_token');
            cookieUtils.deleteCookie('refresh_token');
            localStorage.removeItem('user');
            
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
            return Promise.reject(error);
          }

          // Call refresh endpoint
          const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { 
            refresh_token: refreshToken 
          });

          // Store new tokens
          localStorage.setItem('access_token', refreshResponse.data.access_token);
          cookieUtils.setCookie('refresh_token', refreshResponse.data.refresh_token, 30);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.access_token}`;
          return axios(originalRequest);
        } catch (refreshError) {
          // Refresh failed, cleanup and redirect
          localStorage.removeItem('access_token');
          cookieUtils.deleteCookie('refresh_token');
          localStorage.removeItem('user');
          
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );
};

export default setupAxiosInterceptors;