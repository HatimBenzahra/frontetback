import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = (buildingId?: string) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!buildingId) return;

    const SERVER_HOST = import.meta.env.VITE_SERVER_HOST || window.location.hostname;
    const isDevelopment = SERVER_HOST === 'localhost' || SERVER_HOST === '127.0.0.1' || SERVER_HOST.startsWith('192.168.');
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    
    // Use nginx proxy in production, direct port in development
    const socketUrl = isDevelopment 
      ? `https://${SERVER_HOST}:${import.meta.env.VITE_API_PORT || '3000'}`
      : `${protocol}://${SERVER_HOST}`;
    
    socketRef.current = io(socketUrl, {
      secure: protocol === 'wss',
      transports: ['websocket', 'polling'],
      forceNew: true,
      upgrade: true,
    });

    socketRef.current.emit('joinRoom', buildingId);

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leaveRoom', buildingId);
        socketRef.current.disconnect();
      }
    };
  }, [buildingId]);

  return socketRef.current;
};