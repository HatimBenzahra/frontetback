import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = (buildingId?: string) => {
  const socketRef = useRef<Socket | null>(null);
  const [instance, setInstance] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const SERVER_HOST = import.meta.env.VITE_SERVER_HOST || window.location.hostname;
    const isDevelopment = SERVER_HOST === 'localhost' || SERVER_HOST === '127.0.0.1' || SERVER_HOST.startsWith('192.168.');

    // Utiliser HTTP/HTTPS selon le protocole de la page actuelle ou forcer HTTPS si spécifié
    const protocol = window.location.protocol === 'https:' || import.meta.env.VITE_FORCE_HTTPS === 'true' ? 'https' : 'http';
    const socketUrl = isDevelopment
      ? `${protocol}://${SERVER_HOST}:${import.meta.env.VITE_API_PORT || '3000'}`
      : `${protocol}://${SERVER_HOST}`;

    // Get auth token from localStorage
    const token = localStorage.getItem('access_token');
    
    // Only create new socket if we don't have one or if it's disconnected
    if (!socketRef.current || socketRef.current.disconnected) {
      // Disconnect any previous instance before creating a new one
      if (socketRef.current) {
        try { 
          socketRef.current.removeAllListeners();
          socketRef.current.disconnect(); 
        } catch (e) {
          console.warn('Error disconnecting previous socket:', e);
        }
      }

      socketRef.current = io(socketUrl, {
        secure: protocol === 'https',
        transports: ['polling', 'websocket'], // Start with polling for better compatibility
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        forceNew: true,
        rejectUnauthorized: false, // Accept self-signed certificates in development
        upgrade: true,
        rememberUpgrade: false,
        auth: {
          token: token
        },
        query: {
          token: token
        }
      });

      // Add connection event listeners
      socketRef.current.on('connect', () => {
        console.log('🔌 WebSocket connected');
        setIsConnected(true);
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('🔌 WebSocket disconnected:', reason);
        setIsConnected(false);
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('🔌 WebSocket connection error:', error);
        setIsConnected(false);
      });

      setInstance(socketRef.current);
    }

    // Join room if buildingId is provided and socket is connected
    if (buildingId && socketRef.current && isConnected) {
      socketRef.current.emit('joinRoom', buildingId);
    }

    return () => {
      // Only disconnect if this is the last component using the socket
      // For now, we'll keep the socket alive and just leave the room
      if (buildingId && socketRef.current && isConnected) {
        socketRef.current.emit('leaveRoom', buildingId);
      }
    };
  }, [buildingId, isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        try {
          socketRef.current.removeAllListeners();
          socketRef.current.disconnect();
        } catch (e) {
          console.warn('Error cleaning up socket:', e);
        }
        socketRef.current = null;
        setInstance(null);
        setIsConnected(false);
      }
    };
  }, []);

  return instance;
};
