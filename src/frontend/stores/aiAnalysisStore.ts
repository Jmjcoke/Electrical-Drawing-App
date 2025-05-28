// AI Analysis Global State Management with Zustand

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { 
  AnalysisSession, 
  ComponentDetection, 
  AnalysisStage, 
  ConfidenceMetrics,
  AIUpdate
} from '@/types/ai/computerVision';

interface AITask {
  id: string;
  drawingId: string;
  priority: 'high' | 'medium' | 'low';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  estimatedDuration?: number;
}

interface AIAnalysisState {
  // Current analysis session
  currentAnalysis: AnalysisSession | null;
  
  // AI service results
  componentDetections: ComponentDetection[];
  cloudDetections: any[]; // TODO: Define cloud detection types
  circuitTraces: any[]; // TODO: Define circuit trace types
  hourEstimations: any[]; // TODO: Define estimation types
  
  // Processing state
  isProcessing: boolean;
  processingStage: AnalysisStage;
  processingQueue: AITask[];
  confidence: ConfidenceMetrics;
  
  // Settings
  confidenceThreshold: number;
  autoRefresh: boolean;
  realtimeUpdates: boolean;
  
  // Real-time updates
  recentUpdates: AIUpdate[];
  
  // Actions
  startAnalysis: (drawingId: string, options?: any) => Promise<void>;
  cancelAnalysis: (analysisId: string) => Promise<void>;
  updateComponentDetections: (detections: ComponentDetection[]) => void;
  updateProcessingStage: (stage: AnalysisStage, progress?: number) => void;
  addRealtimeUpdate: (update: AIUpdate) => void;
  setConfidenceThreshold: (threshold: number) => void;
  clearAnalysis: () => void;
  
  // Queue management
  addToQueue: (task: Omit<AITask, 'id' | 'createdAt'>) => void;
  removeFromQueue: (taskId: string) => void;
  clearQueue: () => void;
}

const calculateAverageConfidence = (detections: ComponentDetection[]): number => {
  if (detections.length === 0) return 0;
  const sum = detections.reduce((acc, detection) => acc + detection.confidence, 0);
  return sum / detections.length;
};

const calculateConfidenceDistribution = (detections: ComponentDetection[]) => {
  const total = detections.length;
  if (total === 0) return { high: 0, medium: 0, low: 0 };
  
  const high = detections.filter(d => d.confidence > 0.85).length;
  const medium = detections.filter(d => d.confidence >= 0.70 && d.confidence <= 0.85).length;
  const low = detections.filter(d => d.confidence < 0.70).length;
  
  return {
    high: (high / total) * 100,
    medium: (medium / total) * 100,
    low: (low / total) * 100
  };
};

export const useAIAnalysisStore = create<AIAnalysisState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    currentAnalysis: null,
    componentDetections: [],
    cloudDetections: [],
    circuitTraces: [],
    hourEstimations: [],
    isProcessing: false,
    processingStage: AnalysisStage.IDLE,
    processingQueue: [],
    confidence: {
      overall: 0,
      byService: {},
      distribution: { high: 0, medium: 0, low: 0 }
    },
    confidenceThreshold: 0.75,
    autoRefresh: true,
    realtimeUpdates: true,
    recentUpdates: [],
    
    // Actions
    startAnalysis: async (drawingId: string, options = {}) => {
      try {
        set({ 
          isProcessing: true, 
          processingStage: AnalysisStage.PREPROCESSING,
          currentAnalysis: {
            id: `analysis-${Date.now()}`,
            drawingId,
            status: 'processing',
            currentStage: AnalysisStage.PREPROCESSING,
            startTime: new Date(),
            progress: {
              overall: 0,
              byStage: {
                [AnalysisStage.IDLE]: 100,
                [AnalysisStage.PREPROCESSING]: 0,
                [AnalysisStage.COMPONENT_DETECTION]: 0,
                [AnalysisStage.CLOUD_DETECTION]: 0,
                [AnalysisStage.CIRCUIT_ANALYSIS]: 0,
                [AnalysisStage.ESTIMATION]: 0,
                [AnalysisStage.COMPLETE]: 0,
                [AnalysisStage.ERROR]: 0
              }
            }
          }
        });
        
        // Initialize analysis with AI services
        // TODO: Integrate with actual AI service client
        console.log('Starting AI analysis for drawing:', drawingId, options);
        
      } catch (error) {
        set({ 
          isProcessing: false, 
          processingStage: AnalysisStage.ERROR,
          currentAnalysis: null
        });
        throw error;
      }
    },
    
    cancelAnalysis: async (analysisId: string) => {
      const { currentAnalysis } = get();
      if (currentAnalysis?.id === analysisId) {
        set({
          isProcessing: false,
          processingStage: AnalysisStage.IDLE,
          currentAnalysis: null
        });
        // TODO: Cancel actual AI service requests
        console.log('Cancelled analysis:', analysisId);
      }
    },
    
    updateComponentDetections: (detections: ComponentDetection[]) => {
      const avgConfidence = calculateAverageConfidence(detections);
      const distribution = calculateConfidenceDistribution(detections);
      
      set({ 
        componentDetections: detections,
        confidence: {
          ...get().confidence,
          overall: avgConfidence,
          byService: {
            ...get().confidence.byService,
            computerVision: avgConfidence
          },
          distribution
        }
      });
      
      // Update processing stage if we're in component detection
      if (get().processingStage === AnalysisStage.COMPONENT_DETECTION) {
        get().updateProcessingStage(AnalysisStage.CLOUD_DETECTION, 100);
      }
    },
    
    updateProcessingStage: (stage: AnalysisStage, progress = 0) => {
      const { currentAnalysis } = get();
      if (!currentAnalysis) return;
      
      const updatedAnalysis = {
        ...currentAnalysis,
        currentStage: stage,
        progress: {
          ...currentAnalysis.progress,
          byStage: {
            ...currentAnalysis.progress.byStage,
            [stage]: progress
          }
        }
      };
      
      // Calculate overall progress
      const stages = Object.keys(updatedAnalysis.progress.byStage);
      const totalProgress = stages.reduce((sum, stageKey) => 
        sum + updatedAnalysis.progress.byStage[stageKey as AnalysisStage], 0
      );
      updatedAnalysis.progress.overall = totalProgress / stages.length;
      
      set({
        processingStage: stage,
        currentAnalysis: updatedAnalysis,
        isProcessing: stage !== AnalysisStage.COMPLETE && stage !== AnalysisStage.ERROR
      });
    },
    
    addRealtimeUpdate: (update: AIUpdate) => {
      set(state => ({
        recentUpdates: [update, ...state.recentUpdates].slice(0, 50) // Keep last 50 updates
      }));
    },
    
    setConfidenceThreshold: (threshold: number) => {
      set({ confidenceThreshold: Math.max(0.5, Math.min(0.95, threshold)) });
    },
    
    clearAnalysis: () => {
      set({
        currentAnalysis: null,
        componentDetections: [],
        cloudDetections: [],
        circuitTraces: [],
        hourEstimations: [],
        isProcessing: false,
        processingStage: AnalysisStage.IDLE,
        confidence: {
          overall: 0,
          byService: {},
          distribution: { high: 0, medium: 0, low: 0 }
        },
        recentUpdates: []
      });
    },
    
    // Queue management
    addToQueue: (taskData) => {
      const task: AITask = {
        ...taskData,
        id: `task-${Date.now()}`,
        createdAt: new Date()
      };
      
      set(state => ({
        processingQueue: [...state.processingQueue, task]
      }));
    },
    
    removeFromQueue: (taskId: string) => {
      set(state => ({
        processingQueue: state.processingQueue.filter(task => task.id !== taskId)
      }));
    },
    
    clearQueue: () => {
      set({ processingQueue: [] });
    }
  }))
);

// Selectors for computed values
export const useComponentDetectionsByConfidence = () => {
  return useAIAnalysisStore(state => {
    const { componentDetections, confidenceThreshold } = state;
    return componentDetections.filter(detection => 
      detection.confidence >= confidenceThreshold
    );
  });
};

export const useAnalysisProgress = () => {
  return useAIAnalysisStore(state => ({
    currentStage: state.processingStage,
    overallProgress: state.currentAnalysis?.progress.overall || 0,
    isProcessing: state.isProcessing,
    stageProgress: state.currentAnalysis?.progress.byStage || {}
  }));
};

export const useConfidenceMetrics = () => {
  return useAIAnalysisStore(state => state.confidence);
};