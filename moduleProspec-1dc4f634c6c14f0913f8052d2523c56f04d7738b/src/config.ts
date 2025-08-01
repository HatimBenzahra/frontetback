const SERVER_HOST = import.meta.env.VITE_SERVER_HOST || window.location.hostname;
const API_PORT = import.meta.env.VITE_API_PORT || '3000';

// Use different URLs for development vs production
const isDevelopment = SERVER_HOST === 'localhost' || SERVER_HOST === '127.0.0.1' || SERVER_HOST.startsWith('192.168.');
export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (isDevelopment ? `https://${SERVER_HOST}:${API_PORT}` : `https://${SERVER_HOST}/api`);
