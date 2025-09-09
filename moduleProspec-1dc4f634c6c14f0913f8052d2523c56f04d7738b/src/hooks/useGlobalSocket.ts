import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getWebSocketUrl, createSocketOptions, WEBSOCKET_CONFIG } from '@/config/websocket.config';

// Global socket instance to avoid multiple connections
let globalSocket: Socket | null = null;
let connectionPromise: Promise<Socket> | null = null;
let connectionListeners: Set<(socket: Socket | null) => void> = new Set();

export const useGlobalSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(globalSocket);
  const [isConnected, setIsConnected] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    const updateSocket = (newSocket: Socket | null) => {
      if (mountedRef.current) {
        setSocket(newSocket);
        setIsConnected(newSocket?.connected || false);
      }
    };

    connectionListeners.add(updateSocket);

    // If we already have a socket, use it
    if (globalSocket) {
      updateSocket(globalSocket);
      return;
    }

    // If we're already connecting, wait for it
    if (connectionPromise) {
      connectionPromise.then(updateSocket);
      return;
    }

    // Create new connection
    const connectSocket = async (): Promise<Socket> => {
      const socketUrl = getWebSocketUrl();
      const socketOptions = createSocketOptions();
      
      const newSocket = io(socketUrl, socketOptions);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, WEBSOCKET_CONFIG.CONNECTION_TIMEOUT);

        newSocket.on('connect', () => {
          clearTimeout(timeout);
          console.log('🔌 Global WebSocket connected');
          globalSocket = newSocket;
          connectionListeners.forEach(listener => listener(newSocket));
          resolve(newSocket);
        });

        newSocket.on('connect_error', (error) => {
          clearTimeout(timeout);
          console.error('🔌 Global WebSocket connection error:', error);
          reject(error);
        });

        newSocket.on('disconnect', (reason) => {
          console.log('🔌 Global WebSocket disconnected:', reason);
          connectionListeners.forEach(listener => listener(null));
        });
      });
    };

    connectionPromise = connectSocket()
      .then(socket => {
        connectionPromise = null;
        return socket;
      })
      .catch(error => {
        console.error('Failed to connect global socket:', error);
        connectionPromise = null;
        return null;
      });

    return () => {
      mountedRef.current = false;
      connectionListeners.delete(updateSocket);
    };
  }, []);

  return { socket, isConnected };
};

// Utility function to join/leave rooms
export const useSocketRoom = (roomName: string | null) => {
  const { socket, isConnected } = useGlobalSocket();

  useEffect(() => {
    if (!socket || !isConnected || !roomName) return;

    console.log(`🔌 Joining room: ${roomName}`);
    socket.emit(WEBSOCKET_CONFIG.EVENTS.JOIN_ROOM, roomName);

    return () => {
      if (socket && isConnected) {
        console.log(`🔌 Leaving room: ${roomName}`);
        socket.emit(WEBSOCKET_CONFIG.EVENTS.LEAVE_ROOM, roomName);
      }
    };
  }, [socket, isConnected, roomName]);

  return { socket, isConnected };
};

// Cleanup function for app shutdown
export const disconnectGlobalSocket = () => {
  if (globalSocket) {
    globalSocket.removeAllListeners();
    globalSocket.disconnect();
    globalSocket = null;
  }
  connectionListeners.clear();
  connectionPromise = null;
};
