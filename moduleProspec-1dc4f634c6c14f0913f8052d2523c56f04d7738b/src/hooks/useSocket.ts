import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = (buildingId?: string) => {
  const socketRef = useRef<Socket | null>(null);
  const [instance, setInstance] = useState<Socket | null>(null);

  useEffect(() => {
    const SERVER_HOST = import.meta.env.VITE_SERVER_HOST || window.location.hostname;
    const isDevelopment = SERVER_HOST === 'localhost' || SERVER_HOST === '127.0.0.1' || SERVER_HOST.startsWith('192.168.');
    const httpProtocol = window.location.protocol; // 'http:' or 'https:'

    // Use nginx proxy in production, direct port in development
    const socketUrl = isDevelopment
      ? `${httpProtocol}//${SERVER_HOST}:${import.meta.env.VITE_API_PORT || '3000'}`
      : `${httpProtocol}//${SERVER_HOST}`;
    
    // Disconnect any previous instance before creating a new one
    if (socketRef.current) {
      try { socketRef.current.disconnect(); } catch {}
    }

    socketRef.current = io(socketUrl, {
      secure: httpProtocol === 'https:',
      transports: ['websocket', 'polling'],
      forceNew: true,
      upgrade: true,
    });
    setInstance(socketRef.current);

    if (buildingId) {
      socketRef.current.emit('joinRoom', buildingId);
    }

    return () => {
      if (socketRef.current) {
        if (buildingId) {
          socketRef.current.emit('leaveRoom', buildingId);
        }
        socketRef.current.disconnect();
      }
      setInstance(null);
    };
  }, [buildingId]);

  return instance;
};
