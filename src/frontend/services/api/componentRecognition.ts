/**
 * Component Recognition API Service
 * 
 * Provides frontend API calls to the intelligent component recognition engine
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComponentDetection {
  id: string;
  category: string;
  confidence: number;
  bounding_box: BoundingBox;
  visual_features: Record<string, any>;
  text_content?: string;
  part_number?: string;
  specifications?: any;
  similarity_score?: number;
}

export interface RecognitionRequest {
  image_data: string; // base64 encoded
  enhance_ocr: boolean;
  match_specifications: boolean;
  confidence_threshold: number;
}

export interface RecognitionResponse {
  request_id: string;
  detected_components: ComponentDetection[];
  processing_time: number;
  total_components: number;
  matched_specifications: number;
  metadata: Record<string, any>;
}

export interface SingleComponentClassification {
  category: string;
  confidence: number;
  text_content?: string;
  part_number?: string;
  specification?: any;
  similarity_score?: number;
}

export interface ModelStatus {
  classifier_loaded: boolean;
  feature_extractor_loaded: boolean;
  ocr_available: boolean;
  categories: string[];
  specs_cache_size: number;
}

export interface RecognitionStats {
  total_specifications: number;
  categories_available: Record<string, number>;
  models_loaded: {
    classifier: boolean;
    feature_extractor: boolean;
    ocr: boolean;
  };
  cache_status: {
    specs_cached: number;
    cache_age: number;
  };
}

class ComponentRecognitionAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_COMPONENT_RECOGNITION_API_URL || 'http://localhost:8004';
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get health status of the component recognition service
   */
  async getHealth(): Promise<{ status: string; service: string }> {
    return this.request('/health');
  }

  /**
   * Recognize electrical components in an image
   */
  async recognizeComponents(request: RecognitionRequest): Promise<RecognitionResponse> {
    return this.request('/recognize', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Recognize components from canvas image data
   */
  async recognizeFromCanvas(
    canvas: HTMLCanvasElement,
    options: {
      enhance_ocr?: boolean;
      match_specifications?: boolean;
      confidence_threshold?: number;
    } = {}
  ): Promise<RecognitionResponse> {
    // Convert canvas to base64
    const imageData = canvas.toDataURL('image/png').split(',')[1];
    
    const request: RecognitionRequest = {
      image_data: imageData,
      enhance_ocr: options.enhance_ocr ?? true,
      match_specifications: options.match_specifications ?? true,
      confidence_threshold: options.confidence_threshold ?? 0.5
    };

    return this.recognizeComponents(request);
  }

  /**
   * Recognize components from File object
   */
  async recognizeFromFile(
    file: File,
    options: {
      enhance_ocr?: boolean;
      match_specifications?: boolean;
      confidence_threshold?: number;
    } = {}
  ): Promise<RecognitionResponse> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          
          const request: RecognitionRequest = {
            image_data: base64Data,
            enhance_ocr: options.enhance_ocr ?? true,
            match_specifications: options.match_specifications ?? true,
            confidence_threshold: options.confidence_threshold ?? 0.5
          };

          const result = await this.recognizeComponents(request);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Classify a single component image
   */
  async classifySingleComponent(
    file: File,
    extractText: boolean = true
  ): Promise<SingleComponentClassification> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('extract_text', extractText.toString());

    const response = await fetch(`${this.baseUrl}/classify-component`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Classification failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get status of loaded ML models
   */
  async getModelStatus(): Promise<ModelStatus> {
    return this.request('/models/status');
  }

  /**
   * Get recognition engine statistics
   */
  async getStats(): Promise<RecognitionStats> {
    return this.request('/stats');
  }

  /**
   * Process component detections from PDF viewer
   */
  async processDetectedComponents(
    imageRegions: Array<{
      canvas: HTMLCanvasElement;
      boundingBox: BoundingBox;
      metadata?: any;
    }>,
    options: {
      enhance_ocr?: boolean;
      match_specifications?: boolean;
      confidence_threshold?: number;
      batch_size?: number;
    } = {}
  ): Promise<ComponentDetection[]> {
    const results: ComponentDetection[] = [];
    const batchSize = options.batch_size || 5;

    // Process in batches to avoid overwhelming the service
    for (let i = 0; i < imageRegions.length; i += batchSize) {
      const batch = imageRegions.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (region) => {
        try {
          const response = await this.recognizeFromCanvas(region.canvas, options);
          
          // Update bounding boxes to absolute coordinates if needed
          return response.detected_components.map(detection => ({
            ...detection,
            bounding_box: {
              x: region.boundingBox.x + (detection.bounding_box.x * region.boundingBox.width),
              y: region.boundingBox.y + (detection.bounding_box.y * region.boundingBox.height),
              width: detection.bounding_box.width * region.boundingBox.width,
              height: detection.bounding_box.height * region.boundingBox.height
            },
            metadata: { ...region.metadata, original_region: region.boundingBox }
          }));
        } catch (error) {
          console.warn('Failed to process image region:', error);
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
      
      // Small delay between batches
      if (i + batchSize < imageRegions.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Enhanced recognition for PDF drawings
   */
  async recognizePDFComponents(
    pdfPageCanvas: HTMLCanvasElement,
    detectedRegions?: BoundingBox[],
    options: {
      enhance_ocr?: boolean;
      match_specifications?: boolean;
      confidence_threshold?: number;
      use_existing_detections?: boolean;
    } = {}
  ): Promise<{
    components: ComponentDetection[];
    processing_summary: {
      total_regions_processed: number;
      successful_detections: number;
      specifications_matched: number;
      processing_time: number;
    };
  }> {
    const startTime = Date.now();
    
    if (options.use_existing_detections && detectedRegions) {
      // Use provided detection regions
      const imageRegions = detectedRegions.map(region => ({
        canvas: this.extractCanvasRegion(pdfPageCanvas, region),
        boundingBox: region
      }));
      
      const components = await this.processDetectedComponents(imageRegions, options);
      
      return {
        components,
        processing_summary: {
          total_regions_processed: imageRegions.length,
          successful_detections: components.length,
          specifications_matched: components.filter(c => c.specifications).length,
          processing_time: Date.now() - startTime
        }
      };
    } else {
      // Process entire page
      const response = await this.recognizeFromCanvas(pdfPageCanvas, options);
      
      return {
        components: response.detected_components,
        processing_summary: {
          total_regions_processed: 1,
          successful_detections: response.total_components,
          specifications_matched: response.matched_specifications,
          processing_time: response.processing_time * 1000 // Convert to ms
        }
      };
    }
  }

  /**
   * Extract a region from canvas as a new canvas
   */
  private extractCanvasRegion(sourceCanvas: HTMLCanvasElement, region: BoundingBox): HTMLCanvasElement {
    const regionCanvas = document.createElement('canvas');
    const ctx = regionCanvas.getContext('2d')!;
    
    const x = region.x * sourceCanvas.width;
    const y = region.y * sourceCanvas.height;
    const width = region.width * sourceCanvas.width;
    const height = region.height * sourceCanvas.height;
    
    regionCanvas.width = width;
    regionCanvas.height = height;
    
    ctx.drawImage(
      sourceCanvas,
      x, y, width, height,
      0, 0, width, height
    );
    
    return regionCanvas;
  }

  /**
   * Validate component detection results
   */
  validateDetections(detections: ComponentDetection[]): {
    valid: ComponentDetection[];
    invalid: ComponentDetection[];
    summary: {
      total: number;
      valid_count: number;
      invalid_count: number;
      avg_confidence: number;
    };
  } {
    const valid: ComponentDetection[] = [];
    const invalid: ComponentDetection[] = [];
    let totalConfidence = 0;

    detections.forEach(detection => {
      totalConfidence += detection.confidence;
      
      // Validation criteria
      const isValid = (
        detection.confidence >= 0.3 &&
        detection.bounding_box.width > 0 &&
        detection.bounding_box.height > 0 &&
        detection.category !== 'other' ||
        detection.specifications !== null
      );
      
      if (isValid) {
        valid.push(detection);
      } else {
        invalid.push(detection);
      }
    });

    return {
      valid,
      invalid,
      summary: {
        total: detections.length,
        valid_count: valid.length,
        invalid_count: invalid.length,
        avg_confidence: detections.length > 0 ? totalConfidence / detections.length : 0
      }
    };
  }

  /**
   * Get component detection for specific coordinates
   */
  async getComponentAtCoordinates(
    canvas: HTMLCanvasElement,
    x: number,
    y: number,
    regionSize: { width: number; height: number } = { width: 100, height: 100 }
  ): Promise<ComponentDetection | null> {
    // Extract region around coordinates
    const region: BoundingBox = {
      x: Math.max(0, (x - regionSize.width / 2) / canvas.width),
      y: Math.max(0, (y - regionSize.height / 2) / canvas.height),
      width: regionSize.width / canvas.width,
      height: regionSize.height / canvas.height
    };

    const regionCanvas = this.extractCanvasRegion(canvas, region);
    
    try {
      const response = await this.recognizeFromCanvas(regionCanvas, {
        enhance_ocr: true,
        match_specifications: true,
        confidence_threshold: 0.3
      });

      return response.detected_components.length > 0 ? response.detected_components[0] : null;
    } catch (error) {
      console.warn('Failed to detect component at coordinates:', error);
      return null;
    }
  }
}

// Export singleton instance
export const componentRecognitionAPI = new ComponentRecognitionAPI();
export default componentRecognitionAPI;