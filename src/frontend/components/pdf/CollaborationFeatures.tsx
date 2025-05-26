import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Point, CollaboratorCursor, AnnotationComment, MarkupSession } from '../../types/annotations';

interface CollaborationFeaturesProps {
  documentId: string;
  pageNumber: number;
  userId: string;
  userName: string;
  isEnabled: boolean;
  onCursorUpdate: (position: Point | null) => void;
  onCommentAdd: (comment: AnnotationComment) => void;
  onSessionUpdate: (session: MarkupSession) => void;
}

interface LiveCursor {
  userId: string;
  userName: string;
  position: Point;
  color: string;
  lastSeen: number;
  isActive: boolean;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: number;
  type: 'text' | 'annotation_reference' | 'system';
  annotationId?: string;
}

export const CollaborationFeatures: React.FC<CollaborationFeaturesProps> = ({
  documentId,
  pageNumber,
  userId,
  userName,
  isEnabled,
  onCursorUpdate,
  onCommentAdd,
  onSessionUpdate
}) => {
  const [liveCursors, setLiveCursors] = useState<Map<string, LiveCursor>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [activeUsers, setActiveUsers] = useState<Set<string>>(new Set());
  const [sessionInfo, setSessionInfo] = useState<MarkupSession | null>(null);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // Establish WebSocket connection for collaboration
  useEffect(() => {
    if (!isEnabled) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/collaboration/${documentId}/${pageNumber}`;
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('Connected to collaboration server');
      
      // Send initial join message
      wsRef.current?.send(JSON.stringify({
        type: 'join_session',
        userId,
        userName,
        documentId,
        pageNumber,
        timestamp: Date.now()
      }));
    };

    wsRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleCollaborationMessage(message);
      } catch (error) {
        console.error('Failed to parse collaboration message:', error);
      }
    };

    wsRef.current.onclose = () => {
      console.log('Disconnected from collaboration server');
    };

    wsRef.current.onerror = (error) => {
      console.error('Collaboration WebSocket error:', error);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'leave_session',
          userId,
          timestamp: Date.now()
        }));
        wsRef.current.close();
      }
    };
  }, [isEnabled, documentId, pageNumber, userId, userName]);

  const handleCollaborationMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'cursor_update':
        if (message.userId !== userId) {
          setLiveCursors(prev => {
            const newCursors = new Map(prev);
            newCursors.set(message.userId, {
              userId: message.userId,
              userName: message.userName,
              position: message.position,
              color: message.color,
              lastSeen: Date.now(),
              isActive: true
            });
            return newCursors;
          });
        }
        break;

      case 'cursor_leave':
        setLiveCursors(prev => {
          const newCursors = new Map(prev);
          newCursors.delete(message.userId);
          return newCursors;
        });
        break;

      case 'chat_message':
        if (message.userId !== userId) {
          setChatMessages(prev => [...prev, {
            id: message.id,
            userId: message.userId,
            userName: message.userName,
            message: message.message,
            timestamp: message.timestamp,
            type: message.messageType || 'text',
            annotationId: message.annotationId
          }]);
        }
        break;

      case 'user_joined':
        setActiveUsers(prev => new Set([...prev, message.userId]));
        setChatMessages(prev => [...prev, {
          id: `system_${Date.now()}`,
          userId: 'system',
          userName: 'System',
          message: `${message.userName} joined the session`,
          timestamp: Date.now(),
          type: 'system'
        }]);
        break;

      case 'user_left':
        setActiveUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(message.userId);
          return newSet;
        });
        setLiveCursors(prev => {
          const newCursors = new Map(prev);
          newCursors.delete(message.userId);
          return newCursors;
        });
        setChatMessages(prev => [...prev, {
          id: `system_${Date.now()}`,
          userId: 'system',
          userName: 'System',
          message: `${message.userName} left the session`,
          timestamp: Date.now(),
          type: 'system'
        }]);
        break;

      case 'session_info':
        setSessionInfo(message.session);
        onSessionUpdate(message.session);
        break;

      case 'comment_added':
        onCommentAdd(message.comment);
        break;
    }
  }, [userId, onSessionUpdate, onCommentAdd]);

  const sendCursorUpdate = useCallback((position: Point | null) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      type: 'cursor_update',
      userId,
      userName,
      position,
      color: getUserColor(userId),
      timestamp: Date.now()
    }));

    onCursorUpdate(position);

    // Clear existing timeout
    if (cursorTimeoutRef.current) {
      clearTimeout(cursorTimeoutRef.current);
    }

    // Set timeout to send cursor leave after inactivity
    cursorTimeoutRef.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'cursor_leave',
          userId,
          timestamp: Date.now()
        }));
      }
    }, 5000);
  }, [userId, userName, onCursorUpdate]);

  const sendChatMessage = useCallback((message: string, annotationId?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !message.trim()) return;

    const chatMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      userName,
      message: message.trim(),
      timestamp: Date.now(),
      type: annotationId ? 'annotation_reference' : 'text',
      annotationId
    };

    wsRef.current.send(JSON.stringify({
      type: 'chat_message',
      ...chatMessage
    }));

    setChatMessages(prev => [...prev, chatMessage]);
    setChatInput('');
  }, [userId, userName]);

  const getUserColor = useCallback((userId: string): string => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    const hash = userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  }, []);

  const formatTimestamp = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Clean up inactive cursors
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setLiveCursors(prev => {
        const newCursors = new Map();
        for (const [id, cursor] of prev) {
          if (now - cursor.lastSeen < 10000) { // Keep cursors active for 10 seconds
            newCursors.set(id, cursor);
          }
        }
        return newCursors;
      });
    }, 1000);

    return () => clearInterval(cleanup);
  }, []);

  if (!isEnabled) return null;

  return (
    <div className="collaboration-features">
      {/* Live Cursors */}
      <div className="live-cursors-container">
        {Array.from(liveCursors.values()).map(cursor => (
          <div
            key={cursor.userId}
            className="live-cursor"
            style={{
              position: 'absolute',
              left: cursor.position.x,
              top: cursor.position.y,
              pointerEvents: 'none',
              zIndex: 1000
            }}
          >
            <div
              className="cursor-pointer"
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: cursor.color,
                borderRadius: '50% 0 50% 50%',
                transform: 'rotate(-45deg)',
                border: '2px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            />
            <div
              className="cursor-label"
              style={{
                backgroundColor: cursor.color,
                color: 'white',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                marginTop: '4px',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
              }}
            >
              {cursor.userName}
            </div>
          </div>
        ))}
      </div>

      {/* Active Users Indicator */}
      <div className="active-users-indicator">
        <div className="users-count">
          <span className="online-indicator">●</span>
          {activeUsers.size + 1} online
        </div>
        <div className="users-list">
          <div className="user-item current-user">
            <div
              className="user-color"
              style={{ backgroundColor: getUserColor(userId) }}
            />
            <span className="user-name">{userName} (you)</span>
          </div>
          {Array.from(liveCursors.values()).map(cursor => (
            <div key={cursor.userId} className="user-item">
              <div
                className="user-color"
                style={{ backgroundColor: cursor.color }}
              />
              <span className="user-name">{cursor.userName}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Panel */}
      <div className={`chat-panel ${showChat ? 'expanded' : 'collapsed'}`}>
        <div className="chat-header" onClick={() => setShowChat(!showChat)}>
          <span className="chat-title">💬 Chat</span>
          {chatMessages.length > 0 && (
            <span className="message-count">{chatMessages.length}</span>
          )}
          <span className="toggle-icon">{showChat ? '▼' : '▶'}</span>
        </div>

        {showChat && (
          <div className="chat-content">
            <div className="chat-messages" ref={chatContainerRef}>
              {chatMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`chat-message ${msg.type} ${msg.userId === userId ? 'own' : 'other'}`}
                >
                  {msg.type === 'system' ? (
                    <div className="system-message">
                      <span className="message-text">{msg.message}</span>
                      <span className="message-time">{formatTimestamp(msg.timestamp)}</span>
                    </div>
                  ) : (
                    <div className="user-message">
                      <div className="message-header">
                        <span
                          className="user-indicator"
                          style={{ backgroundColor: getUserColor(msg.userId) }}
                        />
                        <span className="user-name">{msg.userName}</span>
                        <span className="message-time">{formatTimestamp(msg.timestamp)}</span>
                      </div>
                      <div className="message-text">{msg.message}</div>
                      {msg.annotationId && (
                        <div className="annotation-reference">
                          📌 Referring to annotation #{msg.annotationId.slice(-6)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="chat-input-container">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    sendChatMessage(chatInput);
                  }
                }}
                placeholder="Type a message..."
                className="chat-input"
              />
              <button
                onClick={() => sendChatMessage(chatInput)}
                disabled={!chatInput.trim()}
                className="send-button"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Session Information */}
      {sessionInfo && (
        <div className="session-info">
          <div className="session-details">
            <span className="session-id">Session: {sessionInfo.id.slice(-8)}</span>
            <span className="session-duration">
              Duration: {Math.floor((Date.now() - new Date(sessionInfo.startTime).getTime()) / 60000)}m
            </span>
          </div>
        </div>
      )}

      {/* Mouse tracking for cursor updates */}
      <div
        className="collaboration-tracker"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: -1
        }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          sendCursorUpdate({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          });
        }}
        onMouseLeave={() => sendCursorUpdate(null)}
      />
    </div>
  );
};