import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Annotation, AnnotationTool, AnnotationStyle, MeasurementUnit, MarkupSession } from '../../types/annotations';

interface MarkupManagerProps {
  documentId: string;
  pageNumber: number;
  userId: string;
  userName: string;
  onAnnotationsChange: (annotations: Annotation[]) => void;
  isCollaborative?: boolean;
  readOnly?: boolean;
  initialAnnotations?: Annotation[];
}

interface AnnotationHistory {
  action: 'add' | 'update' | 'delete';
  annotation: Annotation;
  previousState?: Annotation;
  timestamp: number;
}

export const MarkupManager: React.FC<MarkupManagerProps> = ({
  documentId,
  pageNumber,
  userId,
  userName,
  onAnnotationsChange,
  isCollaborative = false,
  readOnly = false,
  initialAnnotations = []
}) => {
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [history, setHistory] = useState<AnnotationHistory[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [collaborators, setCollaborators] = useState<Map<string, { name: string; color: string; lastSeen: Date }>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Color assignment for collaborators
  const collaboratorColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  const assignCollaboratorColor = useCallback((id: string): string => {
    const existingCollaborators = Array.from(collaborators.keys());
    const colorIndex = existingCollaborators.indexOf(id);
    if (colorIndex !== -1) {
      return collaboratorColors[colorIndex % collaboratorColors.length];
    }
    return collaboratorColors[existingCollaborators.length % collaboratorColors.length];
  }, [collaborators]);

  // WebSocket connection for real-time collaboration
  useEffect(() => {
    if (!isCollaborative) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/markup/${documentId}/${pageNumber}`;
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('Connected to markup collaboration server');
      // Send join message
      wsRef.current?.send(JSON.stringify({
        type: 'join',
        userId,
        userName,
        documentId,
        pageNumber
      }));
    };

    wsRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    wsRef.current.onclose = () => {
      console.log('Disconnected from markup collaboration server');
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isCollaborative, documentId, pageNumber, userId, userName]);

  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'annotation_added':
        if (message.userId !== userId) {
          setAnnotations(prev => [...prev, message.annotation]);
        }
        break;
      
      case 'annotation_updated':
        if (message.userId !== userId) {
          setAnnotations(prev => 
            prev.map(ann => ann.id === message.annotation.id ? message.annotation : ann)
          );
        }
        break;
      
      case 'annotation_deleted':
        if (message.userId !== userId) {
          setAnnotations(prev => prev.filter(ann => ann.id !== message.annotationId));
        }
        break;
      
      case 'user_joined':
        setCollaborators(prev => {
          const newMap = new Map(prev);
          newMap.set(message.userId, {
            name: message.userName,
            color: assignCollaboratorColor(message.userId),
            lastSeen: new Date()
          });
          return newMap;
        });
        break;
      
      case 'user_left':
        setCollaborators(prev => {
          const newMap = new Map(prev);
          newMap.delete(message.userId);
          return newMap;
        });
        break;
      
      case 'cursor_position':
        // Handle real-time cursor positions from other users
        break;
    }
  }, [userId, assignCollaboratorColor]);

  const broadcastChange = useCallback((type: string, data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type,
        userId,
        userName,
        documentId,
        pageNumber,
        ...data
      }));
    }
  }, [userId, userName, documentId, pageNumber]);

  const addToHistory = useCallback((action: 'add' | 'update' | 'delete', annotation: Annotation, previousState?: Annotation) => {
    const historyEntry: AnnotationHistory = {
      action,
      annotation,
      previousState,
      timestamp: Date.now()
    };

    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(historyEntry);
      return newHistory.slice(-100); // Keep last 100 actions
    });
    
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const handleAnnotationAdd = useCallback((annotation: Annotation) => {
    if (readOnly) return;

    // Add author information
    const annotationWithAuthor = {
      ...annotation,
      authorId: userId,
      authorName: userName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setAnnotations(prev => {
      const newAnnotations = [...prev, annotationWithAuthor];
      onAnnotationsChange(newAnnotations);
      return newAnnotations;
    });

    addToHistory('add', annotationWithAuthor);
    broadcastChange('annotation_added', { annotation: annotationWithAuthor });
    scheduleAutoSave();
  }, [readOnly, userId, userName, onAnnotationsChange, addToHistory, broadcastChange]);

  const handleAnnotationUpdate = useCallback((id: string, updates: Partial<Annotation>) => {
    if (readOnly) return;

    setAnnotations(prev => {
      const updatedAnnotations = prev.map(ann => {
        if (ann.id === id) {
          const previousState = { ...ann };
          const updatedAnnotation = {
            ...ann,
            ...updates,
            updatedAt: new Date().toISOString(),
            updatedBy: userId
          };
          
          addToHistory('update', updatedAnnotation, previousState);
          broadcastChange('annotation_updated', { annotation: updatedAnnotation });
          
          return updatedAnnotation;
        }
        return ann;
      });
      
      onAnnotationsChange(updatedAnnotations);
      return updatedAnnotations;
    });

    scheduleAutoSave();
  }, [readOnly, userId, onAnnotationsChange, addToHistory, broadcastChange]);

  const handleAnnotationDelete = useCallback((id: string) => {
    if (readOnly) return;

    setAnnotations(prev => {
      const annotationToDelete = prev.find(ann => ann.id === id);
      if (!annotationToDelete) return prev;

      const newAnnotations = prev.filter(ann => ann.id !== id);
      
      addToHistory('delete', annotationToDelete);
      broadcastChange('annotation_deleted', { annotationId: id });
      onAnnotationsChange(newAnnotations);
      
      return newAnnotations;
    });

    scheduleAutoSave();
  }, [readOnly, onAnnotationsChange, addToHistory, broadcastChange]);

  const undo = useCallback(() => {
    if (historyIndex < 0 || readOnly) return;

    const action = history[historyIndex];
    
    setAnnotations(prev => {
      let newAnnotations;
      
      switch (action.action) {
        case 'add':
          newAnnotations = prev.filter(ann => ann.id !== action.annotation.id);
          break;
        case 'delete':
          newAnnotations = [...prev, action.annotation];
          break;
        case 'update':
          if (action.previousState) {
            newAnnotations = prev.map(ann => 
              ann.id === action.annotation.id ? action.previousState! : ann
            );
          } else {
            newAnnotations = prev;
          }
          break;
        default:
          newAnnotations = prev;
      }
      
      onAnnotationsChange(newAnnotations);
      return newAnnotations;
    });

    setHistoryIndex(prev => prev - 1);
  }, [historyIndex, history, readOnly, onAnnotationsChange]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1 || readOnly) return;

    const action = history[historyIndex + 1];
    
    setAnnotations(prev => {
      let newAnnotations;
      
      switch (action.action) {
        case 'add':
          newAnnotations = [...prev, action.annotation];
          break;
        case 'delete':
          newAnnotations = prev.filter(ann => ann.id !== action.annotation.id);
          break;
        case 'update':
          newAnnotations = prev.map(ann => 
            ann.id === action.annotation.id ? action.annotation : ann
          );
          break;
        default:
          newAnnotations = prev;
      }
      
      onAnnotationsChange(newAnnotations);
      return newAnnotations;
    });

    setHistoryIndex(prev => prev + 1);
  }, [historyIndex, history, readOnly, onAnnotationsChange]);

  const clearAllAnnotations = useCallback(() => {
    if (readOnly) return;

    const confirmed = window.confirm('Are you sure you want to clear all annotations?');
    if (!confirmed) return;

    annotations.forEach(annotation => {
      addToHistory('delete', annotation);
      broadcastChange('annotation_deleted', { annotationId: annotation.id });
    });

    setAnnotations([]);
    onAnnotationsChange([]);
    scheduleAutoSave();
  }, [readOnly, annotations, addToHistory, broadcastChange, onAnnotationsChange]);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      saveAnnotations();
    }, 2000); // Auto-save after 2 seconds of inactivity
  }, []);

  const saveAnnotations = useCallback(async () => {
    if (readOnly) return;

    setIsAutoSaving(true);
    
    try {
      const response = await fetch(`/api/documents/${documentId}/pages/${pageNumber}/annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          annotations,
          userId,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        setLastSaved(new Date());
      } else {
        console.error('Failed to save annotations');
      }
    } catch (error) {
      console.error('Error saving annotations:', error);
    } finally {
      setIsAutoSaving(false);
    }
  }, [readOnly, annotations, documentId, pageNumber, userId]);

  const loadAnnotations = useCallback(async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}/pages/${pageNumber}/annotations`);
      
      if (response.ok) {
        const data = await response.json();
        setAnnotations(data.annotations || []);
        onAnnotationsChange(data.annotations || []);
      }
    } catch (error) {
      console.error('Error loading annotations:', error);
    }
  }, [documentId, pageNumber, onAnnotationsChange]);

  const exportAnnotations = useCallback((format: 'json' | 'pdf') => {
    const exportData = {
      documentId,
      pageNumber,
      annotations,
      exportedAt: new Date().toISOString(),
      exportedBy: { userId, userName }
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `annotations_${documentId}_page${pageNumber}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [documentId, pageNumber, annotations, userId, userName]);

  const getStats = useCallback(() => {
    const typeStats = annotations.reduce((acc, ann) => {
      acc[ann.type] = (acc[ann.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const authorStats = annotations.reduce((acc, ann) => {
      const author = ann.authorName || 'Unknown';
      acc[author] = (acc[author] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: annotations.length,
      byType: typeStats,
      byAuthor: authorStats,
      lastModified: annotations.length > 0 ? 
        Math.max(...annotations.map(ann => new Date(ann.updatedAt || ann.createdAt).getTime())) : null
    };
  }, [annotations]);

  // Auto-save on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        saveAnnotations();
      }
    };
  }, [saveAnnotations]);

  return {
    annotations,
    onAnnotationAdd: handleAnnotationAdd,
    onAnnotationUpdate: handleAnnotationUpdate,
    onAnnotationDelete: handleAnnotationDelete,
    undo,
    redo,
    canUndo: historyIndex >= 0,
    canRedo: historyIndex < history.length - 1,
    clearAll: clearAllAnnotations,
    save: saveAnnotations,
    load: loadAnnotations,
    export: exportAnnotations,
    isAutoSaving,
    lastSaved,
    collaborators: Array.from(collaborators.entries()).map(([id, info]) => ({
      id,
      name: info.name,
      color: info.color,
      isActive: Date.now() - info.lastSeen.getTime() < 30000 // Active if seen in last 30 seconds
    })),
    stats: getStats()
  };
};