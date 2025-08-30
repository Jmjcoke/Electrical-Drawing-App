/**
 * Component Database Types
 * 
 * TypeScript definitions for electrical component database operations
 */

export interface ComponentLibraryEntry {
  id: string;
  manufacturer: string;
  partNumber: string;
  description: string;
  category: string;
  subcategory: string;
  properties: Record<string, any>;
  ratings: Record<string, any>;
  crossReferences: string[];
  specifications?: Record<string, any>;
  datasheet?: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComponentSearchRequest {
  query: string;
  category?: string;
  manufacturer?: string;
  filters?: Record<string, any>;
  limit?: number;
  offset?: number;
}

export interface ComponentSearchResponse {
  components: ComponentLibraryEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface ComponentLibraryCreateRequest {
  manufacturer: string;
  partNumber: string;
  description: string;
  category: string;
  subcategory: string;
  properties: Record<string, any>;
  ratings: Record<string, any>;
  specifications?: Record<string, any>;
  datasheet?: string;
  image?: string;
}

export interface ComponentLibraryUpdateRequest {
  manufacturer?: string;
  partNumber?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  properties?: Record<string, any>;
  ratings?: Record<string, any>;
  specifications?: Record<string, any>;
  datasheet?: string;
  image?: string;
}

export interface ComponentLookupRequest {
  partNumber?: string;
  manufacturer?: string;
  description?: string;
  visualFeatures?: string[];
}

export interface ComponentLookupResponse {
  matches: ComponentLibraryEntry[];
  confidence: number;
  suggestions: ComponentLibraryEntry[];
}

export interface ComponentIdentificationBatchRequest {
  components: ComponentLookupRequest[];
  sessionId: string;
  documentId?: string;
}

export interface ComponentIdentificationBatchResponse {
  results: ComponentLookupResponse[];
  batchId: string;
  sessionId: string;
}

export interface ComponentPropertyRange {
  property: string;
  min: number;
  max: number;
  unit: string;
  values: (string | number)[];
}

export interface ComponentSuggestionRequest {
  requirements: Record<string, any>;
  context?: string;
  application?: string;
}

export interface ComponentSuggestionResponse {
  suggestions: ComponentLibraryEntry[];
  reasoning: string;
  alternatives: ComponentLibraryEntry[];
}

export interface ComponentStatistics {
  totalComponents: number;
  categories: Record<string, number>;
  manufacturers: Record<string, number>;
  recentlyAdded: ComponentLibraryEntry[];
  popularSearches: string[];
}

export interface ComponentIdentificationStatistics {
  totalIdentifications: number;
  successRate: number;
  averageConfidence: number;
  topCategories: Record<string, number>;
  recentIdentifications: number;
}