import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatAPI } from '../services/chat';
import { UploadedFile } from '../types/chat';

interface SessionInfo {
  sessionId: string;
  uploadedFiles: UploadedFile[];
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
  timeUntilExpiry: number; // milliseconds
}

interface UseSessionOptions {
  sessionId?: string;
  autoRefresh?: boolean;
  onSessionExpired?: () => void;
  onSessionWarning?: (timeRemaining: number) => void;
  warningThreshold?: number; // milliseconds before expiry to show warning
}

interface UseSessionReturn {
  session: SessionInfo | null;
  isLoading: boolean;
  error: string | null;
  refreshSession: () => void;
  clearSession: () => void;
  isSessionValid: boolean;
  timeUntilExpiry: number;
}

const SESSION_WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds
const SESSION_REFRESH_INTERVAL = 60 * 1000; // 1 minute

export const useSession = ({
  sessionId,
  autoRefresh = true,
  onSessionExpired,
  onSessionWarning,
  warningThreshold = SESSION_WARNING_THRESHOLD
}: UseSessionOptions = {}): UseSessionReturn => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [hasWarned, setHasWarned] = useState(false);
  const warningShownRef = useRef(false);
  const expiryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch session information
  const { 
    data: sessionData, 
    isLoading, 
    refetch: refreshSession 
  } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      
      try {
        const response = await chatAPI.getSession(sessionId);
        setError(null);
        return response;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch session';
        setError(errorMessage);
        
        // If session not found or expired, trigger callback
        if (errorMessage.includes('expired') || errorMessage.includes('not found')) {
          onSessionExpired?.();
        }
        
        throw err;
      }
    },
    enabled: !!sessionId,
    refetchInterval: autoRefresh ? SESSION_REFRESH_INTERVAL : false,
    staleTime: 30 * 1000, // Data is fresh for 30 seconds
    retry: (failureCount, error) => {
      // Don't retry if session is expired or not found
      if (error instanceof Error && 
          (error.message.includes('expired') || error.message.includes('not found'))) {
        return false;
      }
      return failureCount < 3;
    }
  });

  // Transform session data
  const session: SessionInfo | null = sessionData ? {
    sessionId: sessionData.sessionId,
    uploadedFiles: sessionData.uploadedFiles.map(file => ({
      fileId: file.fileId,
      originalName: file.originalName,
      size: file.size,
      mimeType: file.mimeType,
      uploadedAt: file.uploadedAt,
      processingStatus: file.processingStatus,
      previewUrl: file.previewUrl
    })),
    createdAt: sessionData.createdAt,
    expiresAt: sessionData.expiresAt,
    isExpired: new Date(sessionData.expiresAt) <= new Date(),
    timeUntilExpiry: Math.max(0, new Date(sessionData.expiresAt).getTime() - Date.now())
  } : null;

  // Session expiry monitoring
  useEffect(() => {
    if (!session || session.isExpired) {
      warningShownRef.current = false;
      setHasWarned(false);
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
      return;
    }

    const timeUntilExpiry = session.timeUntilExpiry;
    
    // Clear existing timer
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
    }

    // Set warning timer if approaching expiry
    if (timeUntilExpiry <= warningThreshold && !warningShownRef.current) {
      warningShownRef.current = true;
      setHasWarned(true);
      onSessionWarning?.(timeUntilExpiry);
    }

    // Set expiry timer
    if (timeUntilExpiry > 0) {
      expiryTimerRef.current = setTimeout(() => {
        onSessionExpired?.();
        queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      }, timeUntilExpiry);
    }

    return () => {
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
    };
  }, [session?.expiresAt, sessionId, warningThreshold, onSessionExpired, onSessionWarning, queryClient]);

  // Clear session data
  const clearSession = useCallback(() => {
    if (sessionId) {
      queryClient.removeQueries({ queryKey: ['session', sessionId] });
    }
    setError(null);
    setHasWarned(false);
    warningShownRef.current = false;
    
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, [sessionId, queryClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
      }
    };
  }, []);

  const isSessionValid = session && !session.isExpired;

  return {
    session,
    isLoading,
    error,
    refreshSession,
    clearSession,
    isSessionValid: Boolean(isSessionValid),
    timeUntilExpiry: session?.timeUntilExpiry || 0
  };
};