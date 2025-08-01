const SERVER_HOST = import.meta.env.VITE_SERVER_HOST || window.location.hostname;

// Use nginx proxy instead of direct backend connection
export const API_BASE_URL = import.meta.env.VITE_API_URL || `https://${SERVER_HOST}/api`;
