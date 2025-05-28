// Hook for AI Analysis Real-time Updates - Story 3.2

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAIAnalysisStore } from '@/stores/aiAnalysisStore';
import { aiWebSocketManager, AIAnalysisCallbacks, WebSocketStatus } from '@/services/websocket/aiWebSocketClient';
import { AIUpdate, AnalysisStage } from '@/types/ai/computerVision';

interface UseAIAnalysisUpdatesProps {
  analysisId?: string;
  enabled?: boolean;
  autoConnect?: boolean;
}

interface UseAIAnalysisUpdatesReturn {
  connectionStatus: WebSocketStatus;
  updates: AIUpdate[];
  isConnected: boolean;
  latency: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  clearUpdates: () => void;
}

export const useAIAnalysisUpdates = ({
  analysisId,
  enabled = true,
  autoConnect = true
}: UseAIAnalysisUpdatesProps = {}): UseAIAnalysisUpdatesReturn => {
  // Store integration
  const {
    updateComponentDetections,
    updateProcessingStage,
    addRealtimeUpdate,
    currentAnalysis
  } = useAIAnalysisStore();

  // Local state
  const [connectionStatus, setConnectionStatus] = useState<WebSocketStatus>('disconnected');
  const [updates, setUpdates] = useState<AIUpdate[]>([]);
  const subscriptionRef = useRef<any>(null);

  // Get current analysis ID
  const activeAnalysisId = analysisId || currentAnalysis?.id;

  // Connection management
  const connect = useCallback(async () => {
    try {
      await aiWebSocketManager.connect();
    } catch (error) {
      console.error('Failed to connect to AI WebSocket:', error);
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (subscriptionRef.current) {
      aiWebSocketManager.unsubscribe(subscriptionRef.current.id);
      subscriptionRef.current = null;
    }
    aiWebSocketManager.disconnect();
  }, []);

  const reconnect = useCallback(async () => {
    try {
      await aiWebSocketManager.reconnect();
    } catch (error) {
      console.error('Failed to reconnect to AI WebSocket:', error);
      throw error;
    }
  }, []);

  const clearUpdates = useCallback(() => {
    setUpdates([]);
  }, []);

  // Analysis subscription callbacks
  const analysisCallbacks: AIAnalysisCallbacks = {
    onComponentDetected: (detectionData) => {
      console.log('Component detected:', detectionData);
      
      // Update store with new detections
      if (detectionData.components) {
        updateComponentDetections(detectionData.components);
      }

      // Add to real-time updates
      const update: AIUpdate = {
        type: 'component-detected' as any,
        analysisId: activeAnalysisId!,
        timestamp: new Date(),
        data: detectionData
      };
      
      addRealtimeUpdate(update);
      setUpdates(prev => [update, ...prev].slice(0, 100)); // Keep last 100 updates
    },

    onCloudDetected: (cloudData) => {
      console.log('Cloud detected:', cloudData);
      
      const update: AIUpdate = {
        type: 'cloud-detected' as any,
        analysisId: activeAnalysisId!,
        timestamp: new Date(),
        data: cloudData
      };
      
      addRealtimeUpdate(update);
      setUpdates(prev => [update, ...prev].slice(0, 100));
    },

    onCircuitTraced: (circuitData) => {
      console.log('Circuit traced:', circuitData);
      
      const update: AIUpdate = {
        type: 'circuit-traced' as any,
        analysisId: activeAnalysisId!,
        timestamp: new Date(),
        data: circuitData
      };
      
      addRealtimeUpdate(update);
      setUpdates(prev => [update, ...prev].slice(0, 100));
    },

    onEstimationUpdated: (estimationData) => {
      console.log('Estimation updated:', estimationData);
      
      const update: AIUpdate = {
        type: 'estimation-updated' as any,
        analysisId: activeAnalysisId!,
        timestamp: new Date(),
        data: estimationData
      };
      
      addRealtimeUpdate(update);
      setUpdates(prev => [update, ...prev].slice(0, 100));
    },

    onStageProgress: (stage, progress) => {
      console.log('Stage progress:', stage, progress);
      
      // Map string stage to AnalysisStage enum
      const analysisStage = stage as AnalysisStage;
      updateProcessingStage(analysisStage, progress);
    },

    onComplete: (result) => {
      console.log('Analysis complete:', result);
      
      updateProcessingStage(AnalysisStage.COMPLETE, 100);
      
      const update: AIUpdate = {
        type: 'analysis-complete' as any,
        analysisId: activeAnalysisId!,
        timestamp: new Date(),
        data: result
      };
      
      addRealtimeUpdate(update);
      setUpdates(prev => [update, ...prev].slice(0, 100));
    },

    onError: (error) => {
      console.error('AI analysis error:', error);
      
      updateProcessingStage(AnalysisStage.ERROR, 0);
      
      const update: AIUpdate = {
        type: 'error-occurred' as any,
        analysisId: activeAnalysisId!,
        timestamp: new Date(),
        data: null,
        error
      };
      
      addRealtimeUpdate(update);
      setUpdates(prev => [update, ...prev].slice(0, 100));
    },

    onConnectionStatusChange: (status) => {
      setConnectionStatus(status);
    }
  };

  // Setup subscription when analysis ID changes
  useEffect(() => {
    if (!enabled || !activeAnalysisId) return;

    const setupSubscription = async () => {
      try {
        // Ensure connection is established
        if (aiWebSocketManager.getConnectionStatus() !== 'connected') {
          if (autoConnect) {
            await connect();
          } else {
            return;
          }
        }

        // Subscribe to analysis updates
        const subscription = aiWebSocketManager.subscribeToAnalysis(
          activeAnalysisId,
          analysisCallbacks
        );

        subscriptionRef.current = subscription;
        console.log('Subscribed to AI analysis updates:', activeAnalysisId);

      } catch (error) {
        console.error('Failed to setup AI analysis subscription:', error);
      }
    };

    setupSubscription();

    // Cleanup function
    return () => {
      if (subscriptionRef.current) {
        aiWebSocketManager.unsubscribe(subscriptionRef.current.id);
        subscriptionRef.current = null;
      }
    };
  }, [activeAnalysisId, enabled, autoConnect]);

  // Connection status monitoring
  useEffect(() => {
    const unsubscribe = aiWebSocketManager.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    // Set initial status
    setConnectionStatus(aiWebSocketManager.getConnectionStatus());

    return unsubscribe;
  }, []);

  // Get connection quality metrics
  const connectionQuality = aiWebSocketManager.getConnectionQuality();

  return {
    connectionStatus,
    updates,
    isConnected: connectionStatus === 'connected',
    latency: connectionQuality.latency,
    connect,
    disconnect,
    reconnect,
    clearUpdates
  };
};

// Specialized hook for processing queue management
export const useAIProcessingQueue = () => {
  const { processingQueue, addToQueue, removeFromQueue, clearQueue } = useAIAnalysisStore();

  const addAnalysisToQueue = useCallback((drawingId: string, priority: 'high' | 'medium' | 'low' = 'medium') => {
    addToQueue({
      drawingId,
      priority,
      status: 'queued'
    });
  }, [addToQueue]);

  const cancelQueueItem = useCallback((taskId: string) => {
    removeFromQueue(taskId);
  }, [removeFromQueue]);

  const getQueuePosition = useCallback((taskId: string) => {
    const index = processingQueue.findIndex(task => task.id === taskId);
    return index === -1 ? null : index + 1;
  }, [processingQueue]);

  const getEstimatedWaitTime = useCallback((taskId: string) => {
    const position = getQueuePosition(taskId);
    if (!position) return null;

    // Rough estimation: 2 minutes per analysis on average
    const averageAnalysisTime = 2 * 60 * 1000; // 2 minutes in milliseconds
    return (position - 1) * averageAnalysisTime;
  }, [getQueuePosition]);

  return {
    queue: processingQueue,
    addToQueue: addAnalysisToQueue,
    cancelItem: cancelQueueItem,
    clearQueue,
    getPosition: getQueuePosition,
    getEstimatedWaitTime
  };
};

// Hook for AI service health monitoring
export const useAIServiceHealth = () => {
  const [serviceHealth, setServiceHealth] = useState({
    computerVision: 'unknown' as 'healthy' | 'degraded' | 'unavailable' | 'unknown',
    cloudDetection: 'unknown' as 'healthy' | 'degraded' | 'unavailable' | 'unknown',
    circuitTracing: 'unknown' as 'healthy' | 'degraded' | 'unavailable' | 'unknown',
    componentIntelligence: 'unknown' as 'healthy' | 'degraded' | 'unavailable' | 'unknown',
    estimationEngine: 'unknown' as 'healthy' | 'degraded' | 'unavailable' | 'unknown'
  });

  const [lastHealthCheck, setLastHealthCheck] = useState<Date | null>(null);

  const checkServiceHealth = useCallback(async () => {
    const healthEndpoints = {
      computerVision: '/api/v1/cv/health',
      cloudDetection: '/api/v1/cloud/health',
      circuitTracing: '/api/v1/circuit/health',
      componentIntelligence: '/api/v1/components/health',
      estimationEngine: '/api/v1/estimation/health'
    };

    const newHealthStatus = { ...serviceHealth };

    for (const [service, endpoint] of Object.entries(healthEndpoints)) {
      try {
        const response = await fetch(endpoint, { 
          method: 'GET',
          timeout: 5000 
        } as any);
        
        if (response.ok) {
          const healthData = await response.json();
          newHealthStatus[service as keyof typeof newHealthStatus] = healthData.status || 'healthy';
        } else {
          newHealthStatus[service as keyof typeof newHealthStatus] = 'degraded';
        }
      } catch (error) {
        console.error(`Health check failed for ${service}:`, error);
        newHealthStatus[service as keyof typeof newHealthStatus] = 'unavailable';
      }
    }

    setServiceHealth(newHealthStatus);
    setLastHealthCheck(new Date());
  }, []);

  // Periodic health checks
  useEffect(() => {
    checkServiceHealth();
    
    const interval = setInterval(checkServiceHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [checkServiceHealth]);

  const overallHealth = Object.values(serviceHealth).every(status => status === 'healthy') 
    ? 'healthy' 
    : Object.values(serviceHealth).some(status => status === 'healthy')
    ? 'degraded'
    : 'unavailable';

  return {
    serviceHealth,
    overallHealth,
    lastHealthCheck,
    checkHealth: checkServiceHealth
  };
};