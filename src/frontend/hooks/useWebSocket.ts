// WebSocket Hook for Real-Time Communication - Story 5.2
// Real-time updates for progress dashboard and live collaboration

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseWebSocketOptions {
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  protocols?: string | string[];
}

interface UseWebSocketReturn {
  socket: WebSocket | null;
  isConnected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  lastMessage: MessageEvent | null;
  sendMessage: (message: string) => void;
  sendJsonMessage: (data: any) => void;
  close: () => void;
  reconnect: () => void;
}

export const useWebSocket = (
  url: string,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn => {
  const {
    onOpen,
    onClose,
    onError,
    onMessage,
    reconnectAttempts = 5,
    reconnectDelay = 1000,
    protocols
  } = options;

  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const urlRef = useRef(url);

  // Update URL ref when URL changes
  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  const createWebSocket = useCallback(() => {
    try {
      setConnectionState('connecting');
      
      // Build WebSocket URL
      const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
      const wsUrl = `${baseUrl}${urlRef.current}`;
      
      const ws = new WebSocket(wsUrl, protocols);

      ws.onopen = (event) => {
        setIsConnected(true);
        setConnectionState('connected');
        reconnectCountRef.current = 0;
        onOpen?.(event);
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setSocket(null);
        
        if (shouldReconnectRef.current && reconnectCountRef.current < reconnectAttempts) {
          setConnectionState('reconnecting');
          reconnectCountRef.current += 1;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            createWebSocket();
          }, reconnectDelay * Math.pow(2, reconnectCountRef.current - 1)); // Exponential backoff
        } else {
          setConnectionState('disconnected');
        }
        
        onClose?.(event);
      };

      ws.onerror = (event) => {
        setConnectionState('disconnected');
        onError?.(event);
      };

      ws.onmessage = (event) => {
        setLastMessage(event);
        onMessage?.(event);
      };

      setSocket(ws);
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionState('disconnected');
    }
  }, [onOpen, onClose, onError, onMessage, reconnectAttempts, reconnectDelay, protocols]);

  const sendMessage = useCallback((message: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    } else {
      console.warn('WebSocket is not connected. Message not sent:', message);
    }
  }, [socket]);

  const sendJsonMessage = useCallback((data: any) => {
    try {
      const message = JSON.stringify(data);
      sendMessage(message);
    } catch (error) {
      console.error('Failed to stringify JSON message:', error);
    }
  }, [sendMessage]);

  const close = useCallback(() => {
    shouldReconnectRef.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socket) {
      socket.close();
    }
  }, [socket]);

  const reconnect = useCallback(() => {
    shouldReconnectRef.current = true;
    reconnectCountRef.current = 0;
    
    if (socket) {
      socket.close();
    }
    
    createWebSocket();
  }, [socket, createWebSocket]);

  // Initialize WebSocket connection
  useEffect(() => {
    shouldReconnectRef.current = true;
    createWebSocket();

    return () => {
      shouldReconnectRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (socket) {
        socket.close();
      }
    };
  }, [createWebSocket]);

  return {
    socket,
    isConnected,
    connectionState,
    lastMessage,
    sendMessage,
    sendJsonMessage,
    close,
    reconnect
  };
};