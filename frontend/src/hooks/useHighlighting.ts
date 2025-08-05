/**
 * Custom hook for highlight state management and operations
 * Provides state management, API integration, and real-time updates
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  ComponentHighlight,
  HighlightGroup,
  HighlightSession,
  ViewportState
} from '../types/highlighting.types';
import { getHighlightingService } from '../services/highlighting.service';
import { validateCoordinates } from '../utils/coordinate-mapper';

interface UseHighlightingOptions {
  readonly sessionId: string;
  readonly initialViewport: ViewportState;
  readonly maxHighlights?: number;
  readonly autoSync?: boolean;
}

interface UseHighlightingReturn {
  // State
  readonly highlights: ComponentHighlight[];
  readonly highlightGroups: HighlightGroup[];
  readonly activeHighlights: string[];
  readonly selectedHighlight: string | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  
  // Actions
  readonly createHighlight: (highlight: Omit<ComponentHighlight, 'id' | 'createdAt'>) => Promise<boolean>;
  readonly updateHighlight: (id: string, updates: Partial<ComponentHighlight>) => Promise<boolean>;
  readonly deleteHighlight: (id: string) => Promise<boolean>;
  readonly toggleHighlightVisibility: (ids: string[], visible: boolean) => Promise<boolean>;
  readonly selectHighlight: (id: string | null) => void;
  readonly clearAllHighlights: () => Promise<boolean>;
  
  // Group operations
  readonly createGroup: (group: Omit<HighlightGroup, 'id'>) => Promise<boolean>;
  readonly toggleGroupVisibility: (groupId: string, visible: boolean) => Promise<boolean>;
  
  // Utility functions
  readonly getHighlightById: (id: string) => ComponentHighlight | undefined;
  readonly getVisibleHighlights: () => ComponentHighlight[];
  readonly getHighlightsByType: (type: string) => ComponentHighlight[];
}

export function useHighlighting({
  sessionId,
  initialViewport,
  maxHighlights = 100,
  autoSync = true
}: UseHighlightingOptions): UseHighlightingReturn {
  // State management
  const [highlights, setHighlights] = useState<ComponentHighlight[]>([]);
  const [highlightGroups, setHighlightGroups] = useState<HighlightGroup[]>([]);
  const [activeHighlights, setActiveHighlights] = useState<string[]>([]);
  const [selectedHighlight, setSelectedHighlight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Service instance
  const highlightingService = useMemo(() => {
    try {
      return getHighlightingService({
        apiBaseUrl: process.env.REACT_APP_API_URL || '/api',
        websocketUrl: process.env.REACT_APP_WS_URL,
        maxHighlights
      });
    } catch (err) {
      console.error('Failed to initialize highlighting service:', err);
      setError('Failed to initialize highlighting service');
      return null;
    }
  }, [maxHighlights]);

  // Initialize WebSocket connection and load initial data
  useEffect(() => {
    if (!highlightingService || !autoSync) return;

    let mounted = true;

    const initializeService = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        // Initialize WebSocket
        await highlightingService.initializeWebSocket(sessionId);

        // Load initial highlights and groups
        const [initialHighlights, initialGroups] = await Promise.all([
          highlightingService.getHighlights(sessionId),
          highlightingService.getHighlightGroups(sessionId)
        ]);

        if (mounted) {
          setHighlights(initialHighlights.filter(h => validateCoordinates(h.coordinates)));
          setHighlightGroups(initialGroups);
          setActiveHighlights(initialHighlights.filter(h => h.isVisible).map(h => h.id));
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize highlighting');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeService();

    return () => {
      mounted = false;
      highlightingService.disconnect();
    };
  }, [highlightingService, sessionId, autoSync]);

  // WebSocket event handlers
  useEffect(() => {
    if (!highlightingService) return;

    const handleHighlightCreated = (data: { highlight: ComponentHighlight }): void => {
      if (validateCoordinates(data.highlight.coordinates)) {
        setHighlights(prev => {
          const existing = prev.find(h => h.id === data.highlight.id);
          if (existing) return prev;
          
          // Enforce max highlights limit
          const newHighlights = [...prev, data.highlight];
          return newHighlights.slice(-maxHighlights);
        });
        
        if (data.highlight.isVisible) {
          setActiveHighlights(prev => [...new Set([...prev, data.highlight.id])]);
        }
      }
    };

    const handleHighlightUpdated = (data: { highlightId: string; highlight: ComponentHighlight }): void => {
      setHighlights(prev => prev.map(h => h.id === data.highlightId ? data.highlight : h));
      
      setActiveHighlights(prev => {
        const filtered = prev.filter(id => id !== data.highlightId);
        return data.highlight.isVisible ? [...filtered, data.highlightId] : filtered;
      });
    };

    const handleHighlightDeleted = (data: { highlightId: string }): void => {
      setHighlights(prev => prev.filter(h => h.id !== data.highlightId));
      setActiveHighlights(prev => prev.filter(id => id !== data.highlightId));
      
      if (selectedHighlight === data.highlightId) {
        setSelectedHighlight(null);
      }
    };

    const handleVisibilityToggled = (data: { highlightIds: string[]; visible: boolean }): void => {
      setActiveHighlights(prev => {
        const filtered = prev.filter(id => !data.highlightIds.includes(id));
        return data.visible ? [...filtered, ...data.highlightIds] : filtered;
      });
    };

    const handleHighlightsSynchronized = (data: { highlights: ComponentHighlight[] }): void => {
      const validHighlights = data.highlights.filter(h => validateCoordinates(h.coordinates));
      setHighlights(validHighlights);
      setActiveHighlights(validHighlights.filter(h => h.isVisible).map(h => h.id));
    };

    // Subscribe to WebSocket events
    highlightingService.on('highlight-created', handleHighlightCreated);
    highlightingService.on('highlight-updated', handleHighlightUpdated);
    highlightingService.on('highlight-deleted', handleHighlightDeleted);
    highlightingService.on('highlight-visibility-toggle', handleVisibilityToggled);
    highlightingService.on('highlights-synchronized', handleHighlightsSynchronized);

    return () => {
      highlightingService.off('highlight-created', handleHighlightCreated);
      highlightingService.off('highlight-updated', handleHighlightUpdated);
      highlightingService.off('highlight-deleted', handleHighlightDeleted);
      highlightingService.off('highlight-visibility-toggle', handleVisibilityToggled);
      highlightingService.off('highlights-synchronized', handleHighlightsSynchronized);
    };
  }, [highlightingService, selectedHighlight, maxHighlights]);

  // Action implementations
  const createHighlight = useCallback(async (
    highlight: Omit<ComponentHighlight, 'id' | 'createdAt'>
  ): Promise<boolean> => {
    if (!highlightingService) {
      setError('Highlighting service not available');
      return false;
    }

    if (!validateCoordinates(highlight.coordinates)) {
      setError('Invalid highlight coordinates');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await highlightingService.createHighlight(sessionId, highlight);
      return result.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create highlight');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [highlightingService, sessionId]);

  const updateHighlight = useCallback(async (
    id: string,
    updates: Partial<ComponentHighlight>
  ): Promise<boolean> => {
    if (!highlightingService) {
      setError('Highlighting service not available');
      return false;
    }

    if (updates.coordinates && !validateCoordinates(updates.coordinates)) {
      setError('Invalid highlight coordinates');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await highlightingService.updateHighlight(sessionId, id, updates);
      return result.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update highlight');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [highlightingService, sessionId]);

  const deleteHighlight = useCallback(async (id: string): Promise<boolean> => {
    if (!highlightingService) {
      setError('Highlighting service not available');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await highlightingService.deleteHighlight(sessionId, id);
      return result.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete highlight');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [highlightingService, sessionId]);

  const toggleHighlightVisibility = useCallback(async (
    ids: string[],
    visible: boolean
  ): Promise<boolean> => {
    if (!highlightingService) {
      setError('Highlighting service not available');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await highlightingService.toggleHighlightVisibility(sessionId, ids, visible);
      return result.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle visibility');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [highlightingService, sessionId]);

  const selectHighlight = useCallback((id: string | null): void => {
    setSelectedHighlight(id);
  }, []);

  const clearAllHighlights = useCallback(async (): Promise<boolean> => {
    if (!highlightingService) {
      setError('Highlighting service not available');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const deletePromises = highlights.map(h => 
        highlightingService.deleteHighlight(sessionId, h.id)
      );
      
      const results = await Promise.all(deletePromises);
      const allSucceeded = results.every(r => r.success);
      
      if (allSucceeded) {
        setHighlights([]);
        setActiveHighlights([]);
        setSelectedHighlight(null);
      }
      
      return allSucceeded;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear highlights');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [highlightingService, sessionId, highlights]);

  const createGroup = useCallback(async (
    group: Omit<HighlightGroup, 'id'>
  ): Promise<boolean> => {
    if (!highlightingService) {
      setError('Highlighting service not available');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await highlightingService.createHighlightGroup(sessionId, group);
      
      if (result) {
        setHighlightGroups(prev => [...prev, result]);
        return true;
      }
      
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [highlightingService, sessionId]);

  const toggleGroupVisibility = useCallback(async (
    groupId: string,
    visible: boolean
  ): Promise<boolean> => {
    const group = highlightGroups.find(g => g.id === groupId);
    if (!group) return false;

    return await toggleHighlightVisibility(group.highlightIds, visible);
  }, [highlightGroups, toggleHighlightVisibility]);

  // Utility functions
  const getHighlightById = useCallback((id: string): ComponentHighlight | undefined => {
    return highlights.find(h => h.id === id);
  }, [highlights]);

  const getVisibleHighlights = useCallback((): ComponentHighlight[] => {
    return highlights.filter(h => h.isVisible && activeHighlights.includes(h.id));
  }, [highlights, activeHighlights]);

  const getHighlightsByType = useCallback((type: string): ComponentHighlight[] => {
    return highlights.filter(h => h.type === type);
  }, [highlights]);

  return {
    // State
    highlights,
    highlightGroups,
    activeHighlights,
    selectedHighlight,
    isLoading,
    error,
    
    // Actions
    createHighlight,
    updateHighlight,
    deleteHighlight,
    toggleHighlightVisibility,
    selectHighlight,
    clearAllHighlights,
    
    // Group operations
    createGroup,
    toggleGroupVisibility,
    
    // Utility functions
    getHighlightById,
    getVisibleHighlights,
    getHighlightsByType
  };
}