// src/utils/axios-config.ts
import axios from 'axios';

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

  // Intercepteur pour les réponses - gère l'expiration du token
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error.response?.status;
      const url: string = error.config?.url || '';

      // Ne pas rediriger sur les endpoints d'authentification
      if (status === 401) {
        if (url.includes('/auth/login') || url.includes('/auth/setup-password') || url.includes('/auth/forgot-password')) {
          return Promise.reject(error);
        }
        
        // Token expiré ou invalide - nettoyer et rediriger
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        
        // Rediriger vers login seulement si pas déjà sur la page de login
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }

      return Promise.reject(error);
    }
  );
};

export default setupAxiosInterceptors;