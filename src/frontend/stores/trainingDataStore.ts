// Training Data Management Store - Story 3.6

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { 
  TrainingDataset, 
  TrainingFile, 
  Annotation, 
  TrainingJob,
  DataQualityReport,
  BatchUploadResult,
  DatasetCategory,
  ElectricalStandard,
  ProjectType,
  ReviewStatus,
  FileProcessingStatus
} from '@/types/ai/trainingData';

interface TrainingDataState {
  // Datasets
  datasets: TrainingDataset[];
  currentDataset: TrainingDataset | null;
  selectedDatasets: string[];
  
  // Files and Annotations
  files: TrainingFile[];
  currentFile: TrainingFile | null;
  annotations: Annotation[];
  selectedAnnotations: string[];
  
  // Training Jobs
  trainingJobs: TrainingJob[];
  currentTrainingJob: TrainingJob | null;
  
  // Quality Reports
  qualityReports: DataQualityReport[];
  
  // UI State
  isUploading: boolean;
  uploadProgress: number;
  isProcessing: boolean;
  activeAnnotationTool: string | null;
  
  // Filters and Search
  searchQuery: string;
  categoryFilter: DatasetCategory | null;
  standardFilter: ElectricalStandard | null;
  statusFilter: string | null;
  
  // Actions - Datasets
  createDataset: (dataset: Omit<TrainingDataset, 'id' | 'createdAt' | 'lastModified'>) => Promise<TrainingDataset>;
  updateDataset: (id: string, updates: Partial<TrainingDataset>) => Promise<void>;
  deleteDataset: (id: string) => Promise<void>;
  loadDatasets: () => Promise<void>;
  setCurrentDataset: (dataset: TrainingDataset | null) => void;
  
  // Actions - Files
  uploadFiles: (datasetId: string, files: File[]) => Promise<BatchUploadResult>;
  loadFiles: (datasetId: string) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  setCurrentFile: (file: TrainingFile | null) => void;
  
  // Actions - Annotations
  createAnnotation: (annotation: Omit<Annotation, 'id' | 'annotatedAt'>) => Promise<Annotation>;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  loadAnnotations: (fileId: string) => Promise<void>;
  reviewAnnotation: (id: string, status: ReviewStatus, comments?: string) => Promise<void>;
  
  // Actions - Training
  startTrainingJob: (config: any) => Promise<TrainingJob>;
  cancelTrainingJob: (jobId: string) => Promise<void>;
  loadTrainingJobs: () => Promise<void>;
  
  // Actions - Quality
  generateQualityReport: (datasetId: string) => Promise<DataQualityReport>;
  loadQualityReports: () => Promise<void>;
  
  // Actions - UI
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: DatasetCategory | null) => void;
  setStandardFilter: (standard: ElectricalStandard | null) => void;
  setStatusFilter: (status: string | null) => void;
  setActiveAnnotationTool: (tool: string | null) => void;
  clearFilters: () => void;
}

export const useTrainingDataStore = create<TrainingDataState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    datasets: [],
    currentDataset: null,
    selectedDatasets: [],
    files: [],
    currentFile: null,
    annotations: [],
    selectedAnnotations: [],
    trainingJobs: [],
    currentTrainingJob: null,
    qualityReports: [],
    isUploading: false,
    uploadProgress: 0,
    isProcessing: false,
    activeAnnotationTool: null,
    searchQuery: '',
    categoryFilter: null,
    standardFilter: null,
    statusFilter: null,

    // Dataset Actions
    createDataset: async (datasetData) => {
      const newDataset: TrainingDataset = {
        ...datasetData,
        id: `dataset-${Date.now()}`,
        createdAt: new Date(),
        lastModified: new Date(),
        qualityScore: 0,
        fileCount: 0,
        totalSize: 0,
        annotations: [],
        status: 'draft'
      };

      try {
        // TODO: API call to create dataset
        console.log('Creating dataset:', newDataset);
        
        set(state => ({
          datasets: [...state.datasets, newDataset]
        }));

        return newDataset;
      } catch (error) {
        console.error('Failed to create dataset:', error);
        throw error;
      }
    },

    updateDataset: async (id, updates) => {
      try {
        // TODO: API call to update dataset
        console.log('Updating dataset:', id, updates);
        
        set(state => ({
          datasets: state.datasets.map(dataset =>
            dataset.id === id 
              ? { ...dataset, ...updates, lastModified: new Date() }
              : dataset
          ),
          currentDataset: state.currentDataset?.id === id 
            ? { ...state.currentDataset, ...updates, lastModified: new Date() }
            : state.currentDataset
        }));
      } catch (error) {
        console.error('Failed to update dataset:', error);
        throw error;
      }
    },

    deleteDataset: async (id) => {
      try {
        // TODO: API call to delete dataset
        console.log('Deleting dataset:', id);
        
        set(state => ({
          datasets: state.datasets.filter(dataset => dataset.id !== id),
          currentDataset: state.currentDataset?.id === id ? null : state.currentDataset
        }));
      } catch (error) {
        console.error('Failed to delete dataset:', error);
        throw error;
      }
    },

    loadDatasets: async () => {
      try {
        // TODO: API call to load datasets
        console.log('Loading datasets...');
        
        // Mock data for development
        const mockDatasets: TrainingDataset[] = [
          {
            id: 'dataset-1',
            name: 'NEC Standard Symbols',
            description: 'Standard electrical symbols from NEC code',
            category: DatasetCategory.SYMBOLS,
            electricalStandard: ElectricalStandard.NEC,
            projectType: ProjectType.COMMERCIAL,
            annotations: [],
            qualityScore: 95,
            fileCount: 127,
            totalSize: 45000000,
            createdBy: 'admin',
            createdAt: new Date('2024-01-15'),
            lastModified: new Date('2024-03-20'),
            status: 'active',
            tags: ['symbols', 'standard', 'nec']
          },
          {
            id: 'dataset-2',
            name: 'Industrial Components',
            description: 'Real-world industrial electrical components',
            category: DatasetCategory.COMPONENTS,
            electricalStandard: ElectricalStandard.IEC,
            projectType: ProjectType.INDUSTRIAL,
            annotations: [],
            qualityScore: 87,
            fileCount: 89,
            totalSize: 120000000,
            createdBy: 'trainer1',
            createdAt: new Date('2024-02-01'),
            lastModified: new Date('2024-05-15'),
            status: 'active',
            tags: ['components', 'industrial', 'iec']
          }
        ];

        set({ datasets: mockDatasets });
      } catch (error) {
        console.error('Failed to load datasets:', error);
        throw error;
      }
    },

    setCurrentDataset: (dataset) => {
      set({ currentDataset: dataset });
    },

    // File Actions
    uploadFiles: async (datasetId, files) => {
      set({ isUploading: true, uploadProgress: 0 });
      
      try {
        const successful: string[] = [];
        const failed: Array<{ fileName: string; error: string }> = [];
        const duplicates: string[] = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          
          try {
            // Simulate upload progress
            set({ uploadProgress: ((i + 1) / files.length) * 100 });
            
            // TODO: Actual file upload logic
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Create TrainingFile object
            const trainingFile: TrainingFile = {
              id: `file-${Date.now()}-${i}`,
              datasetId,
              originalName: file.name,
              fileName: `processed_${file.name}`,
              fileType: file.type.split('/')[1] as any,
              fileSize: file.size,
              uploadedAt: new Date(),
              uploadedBy: 'current-user',
              processingStatus: FileProcessingStatus.PROCESSING,
              annotations: [],
              metadata: {
                originalDimensions: { width: 1200, height: 800 }
              }
            };

            successful.push(file.name);
            
            // Add to files list
            set(state => ({
              files: [...state.files, trainingFile]
            }));

          } catch (error) {
            failed.push({
              fileName: file.name,
              error: error instanceof Error ? error.message : 'Upload failed'
            });
          }
        }

        const result: BatchUploadResult = {
          successful,
          failed,
          duplicates,
          totalProcessed: files.length
        };

        return result;
      } catch (error) {
        console.error('Batch upload failed:', error);
        throw error;
      } finally {
        set({ isUploading: false, uploadProgress: 0 });
      }
    },

    loadFiles: async (datasetId) => {
      try {
        // TODO: API call to load files for dataset
        console.log('Loading files for dataset:', datasetId);
        
        // Mock data
        const mockFiles: TrainingFile[] = [];
        set({ files: mockFiles });
      } catch (error) {
        console.error('Failed to load files:', error);
        throw error;
      }
    },

    deleteFile: async (fileId) => {
      try {
        // TODO: API call to delete file
        console.log('Deleting file:', fileId);
        
        set(state => ({
          files: state.files.filter(file => file.id !== fileId),
          currentFile: state.currentFile?.id === fileId ? null : state.currentFile
        }));
      } catch (error) {
        console.error('Failed to delete file:', error);
        throw error;
      }
    },

    setCurrentFile: (file) => {
      set({ currentFile: file });
    },

    // Annotation Actions
    createAnnotation: async (annotationData) => {
      const newAnnotation: Annotation = {
        ...annotationData,
        id: `annotation-${Date.now()}`,
        annotatedAt: new Date(),
        reviewStatus: ReviewStatus.PENDING,
        isGroundTruth: false
      };

      try {
        // TODO: API call to create annotation
        console.log('Creating annotation:', newAnnotation);
        
        set(state => ({
          annotations: [...state.annotations, newAnnotation]
        }));

        return newAnnotation;
      } catch (error) {
        console.error('Failed to create annotation:', error);
        throw error;
      }
    },

    updateAnnotation: async (id, updates) => {
      try {
        // TODO: API call to update annotation
        console.log('Updating annotation:', id, updates);
        
        set(state => ({
          annotations: state.annotations.map(annotation =>
            annotation.id === id ? { ...annotation, ...updates } : annotation
          )
        }));
      } catch (error) {
        console.error('Failed to update annotation:', error);
        throw error;
      }
    },

    deleteAnnotation: async (id) => {
      try {
        // TODO: API call to delete annotation
        console.log('Deleting annotation:', id);
        
        set(state => ({
          annotations: state.annotations.filter(annotation => annotation.id !== id)
        }));
      } catch (error) {
        console.error('Failed to delete annotation:', error);
        throw error;
      }
    },

    loadAnnotations: async (fileId) => {
      try {
        // TODO: API call to load annotations for file
        console.log('Loading annotations for file:', fileId);
        
        // Mock data
        const mockAnnotations: Annotation[] = [];
        set({ annotations: mockAnnotations });
      } catch (error) {
        console.error('Failed to load annotations:', error);
        throw error;
      }
    },

    reviewAnnotation: async (id, status, comments) => {
      try {
        // TODO: API call to review annotation
        console.log('Reviewing annotation:', id, status, comments);
        
        set(state => ({
          annotations: state.annotations.map(annotation =>
            annotation.id === id 
              ? { 
                  ...annotation, 
                  reviewStatus: status,
                  reviewedBy: 'current-user',
                  reviewedAt: new Date(),
                  reviewComments: comments
                }
              : annotation
          )
        }));
      } catch (error) {
        console.error('Failed to review annotation:', error);
        throw error;
      }
    },

    // Training Actions
    startTrainingJob: async (config) => {
      const newJob: TrainingJob = {
        id: `job-${Date.now()}`,
        name: config.name,
        description: config.description,
        datasets: config.datasets,
        modelType: config.modelType,
        status: 'queued',
        progress: 0,
        config: config.trainingConfig,
        startTime: new Date(),
        createdBy: 'current-user'
      };

      try {
        // TODO: API call to start training job
        console.log('Starting training job:', newJob);
        
        set(state => ({
          trainingJobs: [...state.trainingJobs, newJob]
        }));

        return newJob;
      } catch (error) {
        console.error('Failed to start training job:', error);
        throw error;
      }
    },

    cancelTrainingJob: async (jobId) => {
      try {
        // TODO: API call to cancel training job
        console.log('Cancelling training job:', jobId);
        
        set(state => ({
          trainingJobs: state.trainingJobs.map(job =>
            job.id === jobId ? { ...job, status: 'cancelled' } : job
          )
        }));
      } catch (error) {
        console.error('Failed to cancel training job:', error);
        throw error;
      }
    },

    loadTrainingJobs: async () => {
      try {
        // TODO: API call to load training jobs
        console.log('Loading training jobs...');
        
        // Mock data
        const mockJobs: TrainingJob[] = [];
        set({ trainingJobs: mockJobs });
      } catch (error) {
        console.error('Failed to load training jobs:', error);
        throw error;
      }
    },

    // Quality Actions
    generateQualityReport: async (datasetId) => {
      try {
        // TODO: API call to generate quality report
        console.log('Generating quality report for dataset:', datasetId);
        
        // Mock quality report
        const mockReport: DataQualityReport = {
          datasetId,
          overallScore: 85,
          issues: [],
          recommendations: [],
          annotationStats: {
            totalAnnotations: 0,
            approvedAnnotations: 0,
            pendingAnnotations: 0,
            rejectedAnnotations: 0,
            averageConfidence: 0,
            annotationsByType: {},
            annotatorStats: {}
          },
          generatedAt: new Date()
        };

        set(state => ({
          qualityReports: [...state.qualityReports, mockReport]
        }));

        return mockReport;
      } catch (error) {
        console.error('Failed to generate quality report:', error);
        throw error;
      }
    },

    loadQualityReports: async () => {
      try {
        // TODO: API call to load quality reports
        console.log('Loading quality reports...');
        
        set({ qualityReports: [] });
      } catch (error) {
        console.error('Failed to load quality reports:', error);
        throw error;
      }
    },

    // UI Actions
    setSearchQuery: (query) => set({ searchQuery: query }),
    setCategoryFilter: (category) => set({ categoryFilter: category }),
    setStandardFilter: (standard) => set({ standardFilter: standard }),
    setStatusFilter: (status) => set({ statusFilter: status }),
    setActiveAnnotationTool: (tool) => set({ activeAnnotationTool: tool }),
    clearFilters: () => set({
      searchQuery: '',
      categoryFilter: null,
      standardFilter: null,
      statusFilter: null
    })
  }))
);

// Selectors for computed values
export const useFilteredDatasets = () => {
  return useTrainingDataStore(state => {
    let filtered = state.datasets;

    if (state.searchQuery) {
      filtered = filtered.filter(dataset =>
        dataset.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        dataset.description.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        dataset.tags.some(tag => tag.toLowerCase().includes(state.searchQuery.toLowerCase()))
      );
    }

    if (state.categoryFilter) {
      filtered = filtered.filter(dataset => dataset.category === state.categoryFilter);
    }

    if (state.standardFilter) {
      filtered = filtered.filter(dataset => dataset.electricalStandard === state.standardFilter);
    }

    if (state.statusFilter) {
      filtered = filtered.filter(dataset => dataset.status === state.statusFilter);
    }

    return filtered;
  });
};

export const useTrainingJobsByStatus = (status?: string) => {
  return useTrainingDataStore(state => {
    if (!status) return state.trainingJobs;
    return state.trainingJobs.filter(job => job.status === status);
  });
};

export const useAnnotationsByFile = (fileId: string) => {
  return useTrainingDataStore(state => 
    state.annotations.filter(annotation => annotation.fileId === fileId)
  );
};