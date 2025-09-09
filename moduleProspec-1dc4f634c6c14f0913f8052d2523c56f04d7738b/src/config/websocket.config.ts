// WebSocket configuration constants
export const WEBSOCKET_CONFIG = {
  // Connection settings
  RECONNECTION_ATTEMPTS: 5,
  RECONNECTION_DELAY: 1000,
  RECONNECTION_DELAY_MAX: 5000,
  CONNECTION_TIMEOUT: 20000,
  
  // Transport preferences
  TRANSPORTS: ['polling', 'websocket'] as const,
  
  // SSL settings
  REJECT_UNAUTHORIZED: false, // Accept self-signed certificates in development
  
  // Room names
  ROOMS: {
    GPS_TRACKING: 'gps-tracking',
    AUDIO_STREAMING: 'audio-streaming',
    BUILDING_PREFIX: 'building-',
  },
  
  // Event names
  EVENTS: {
    JOIN_ROOM: 'joinRoom',
    LEAVE_ROOM: 'leaveRoom',
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    CONNECT_ERROR: 'connect_error',
  }
} as const;

// Helper function to get WebSocket URL
export const getWebSocketUrl = (): string => {
  const SERVER_HOST = import.meta.env.VITE_SERVER_HOST || window.location.hostname;
  const isDevelopment = SERVER_HOST === 'localhost' || 
                       SERVER_HOST === '127.0.0.1' || 
                       SERVER_HOST.startsWith('192.168.');
  
  if (isDevelopment) {
    return `https://${SERVER_HOST}:${import.meta.env.VITE_API_PORT || '3000'}`;
  }
  
  return `https://${SERVER_HOST}`;
};

// Helper function to get auth token
export const getAuthToken = (): string | null => {
  return localStorage.getItem('access_token');
};

// Helper function to create socket options
export const createSocketOptions = () => {
  const token = getAuthToken();
  
  return {
    secure: true,
    transports: WEBSOCKET_CONFIG.TRANSPORTS,
    reconnection: true,
    reconnectionAttempts: WEBSOCKET_CONFIG.RECONNECTION_ATTEMPTS,
    reconnectionDelay: WEBSOCKET_CONFIG.RECONNECTION_DELAY,
    reconnectionDelayMax: WEBSOCKET_CONFIG.RECONNECTION_DELAY_MAX,
    timeout: WEBSOCKET_CONFIG.CONNECTION_TIMEOUT,
    forceNew: true,
    rejectUnauthorized: WEBSOCKET_CONFIG.REJECT_UNAUTHORIZED,
    auth: { token },
    query: { token }
  };
};
