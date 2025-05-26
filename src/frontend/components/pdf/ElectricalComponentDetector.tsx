import React, { useEffect, useState, useCallback } from 'react';
import { ElectricalComponent, ComponentType, DetectionConfig, Point, BoundingBox } from '../../types/electrical';

interface ElectricalComponentDetectorProps {
  imageData: ImageData | null;
  detectionConfig: DetectionConfig;
  onComponentsDetected: (components: ElectricalComponent[]) => void;
  onDetectionProgress: (progress: number) => void;
  enableAutoDetection?: boolean;
  customPatterns?: ComponentPattern[];
}

interface ComponentPattern {
  type: ComponentType;
  name: string;
  template: ImageData;
  threshold: number;
  minSize: { width: number; height: number };
  maxSize: { width: number; height: number };
}

interface DetectionResult {
  type: ComponentType;
  confidence: number;
  boundingBox: BoundingBox;
  centerPoint: Point;
  properties: Record<string, any>;
}

export const ElectricalComponentDetector: React.FC<ElectricalComponentDetectorProps> = ({
  imageData,
  detectionConfig,
  onComponentsDetected,
  onDetectionProgress,
  enableAutoDetection = true,
  customPatterns = []
}) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedComponents, setDetectedComponents] = useState<ElectricalComponent[]>([]);

  const defaultPatterns: ComponentPattern[] = [
    {
      type: 'outlet',
      name: 'Standard Outlet',
      template: new ImageData(20, 10),
      threshold: 0.8,
      minSize: { width: 15, height: 8 },
      maxSize: { width: 30, height: 15 }
    },
    {
      type: 'switch',
      name: 'Light Switch',
      template: new ImageData(15, 15),
      threshold: 0.75,
      minSize: { width: 10, height: 10 },
      maxSize: { width: 25, height: 25 }
    },
    {
      type: 'light_fixture',
      name: 'Light Fixture',
      template: new ImageData(25, 25),
      threshold: 0.7,
      minSize: { width: 20, height: 20 },
      maxSize: { width: 40, height: 40 }
    },
    {
      type: 'panel',
      name: 'Electrical Panel',
      template: new ImageData(50, 80),
      threshold: 0.85,
      minSize: { width: 40, height: 60 },
      maxSize: { width: 100, height: 150 }
    },
    {
      type: 'junction_box',
      name: 'Junction Box',
      template: new ImageData(20, 20),
      threshold: 0.8,
      minSize: { width: 15, height: 15 },
      maxSize: { width: 35, height: 35 }
    }
  ];

  const normalizeImageData = useCallback((data: ImageData): number[] => {
    const normalized = new Array(data.width * data.height);
    for (let i = 0; i < data.data.length; i += 4) {
      const gray = (data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3;
      normalized[i / 4] = gray / 255;
    }
    return normalized;
  }, []);

  const templateMatch = useCallback((
    image: number[],
    imageWidth: number,
    imageHeight: number,
    template: number[],
    templateWidth: number,
    templateHeight: number,
    threshold: number
  ): Point[] => {
    const matches: Point[] = [];
    
    for (let y = 0; y <= imageHeight - templateHeight; y++) {
      for (let x = 0; x <= imageWidth - templateWidth; x++) {
        let correlation = 0;
        let templateMean = 0;
        let imageMean = 0;
        
        for (let ty = 0; ty < templateHeight; ty++) {
          for (let tx = 0; tx < templateWidth; tx++) {
            const imageIdx = (y + ty) * imageWidth + (x + tx);
            const templateIdx = ty * templateWidth + tx;
            templateMean += template[templateIdx];
            imageMean += image[imageIdx];
          }
        }
        
        templateMean /= (templateWidth * templateHeight);
        imageMean /= (templateWidth * templateHeight);
        
        let numerator = 0;
        let templateDenom = 0;
        let imageDenom = 0;
        
        for (let ty = 0; ty < templateHeight; ty++) {
          for (let tx = 0; tx < templateWidth; tx++) {
            const imageIdx = (y + ty) * imageWidth + (x + tx);
            const templateIdx = ty * templateWidth + tx;
            
            const templateDiff = template[templateIdx] - templateMean;
            const imageDiff = image[imageIdx] - imageMean;
            
            numerator += templateDiff * imageDiff;
            templateDenom += templateDiff * templateDiff;
            imageDenom += imageDiff * imageDiff;
          }
        }
        
        if (templateDenom > 0 && imageDenom > 0) {
          correlation = numerator / Math.sqrt(templateDenom * imageDenom);
          
          if (correlation > threshold) {
            matches.push({ x, y });
          }
        }
      }
    }
    
    return matches;
  }, []);

  const nonMaximumSuppression = useCallback((
    detections: DetectionResult[],
    overlapThreshold: number = 0.5
  ): DetectionResult[] => {
    const sorted = detections.sort((a, b) => b.confidence - a.confidence);
    const kept: DetectionResult[] = [];
    
    for (const detection of sorted) {
      let shouldKeep = true;
      
      for (const keptDetection of kept) {
        const intersection = Math.max(0, 
          Math.min(detection.boundingBox.x + detection.boundingBox.width, 
                   keptDetection.boundingBox.x + keptDetection.boundingBox.width) -
          Math.max(detection.boundingBox.x, keptDetection.boundingBox.x)
        ) * Math.max(0,
          Math.min(detection.boundingBox.y + detection.boundingBox.height,
                   keptDetection.boundingBox.y + keptDetection.boundingBox.height) -
          Math.max(detection.boundingBox.y, keptDetection.boundingBox.y)
        );
        
        const union = detection.boundingBox.width * detection.boundingBox.height +
                     keptDetection.boundingBox.width * keptDetection.boundingBox.height -
                     intersection;
        
        if (intersection / union > overlapThreshold) {
          shouldKeep = false;
          break;
        }
      }
      
      if (shouldKeep) {
        kept.push(detection);
      }
    }
    
    return kept;
  }, []);

  const detectComponents = useCallback(async (): Promise<ElectricalComponent[]> => {
    if (!imageData) return [];
    
    setIsDetecting(true);
    onDetectionProgress(0);
    
    const normalizedImage = normalizeImageData(imageData);
    const patterns = [...defaultPatterns, ...customPatterns];
    const allDetections: DetectionResult[] = [];
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const normalizedTemplate = normalizeImageData(pattern.template);
      
      const matches = templateMatch(
        normalizedImage,
        imageData.width,
        imageData.height,
        normalizedTemplate,
        pattern.template.width,
        pattern.template.height,
        pattern.threshold
      );
      
      matches.forEach(match => {
        const boundingBox: BoundingBox = {
          x: match.x,
          y: match.y,
          width: pattern.template.width,
          height: pattern.template.height
        };
        
        if (boundingBox.width >= pattern.minSize.width &&
            boundingBox.height >= pattern.minSize.height &&
            boundingBox.width <= pattern.maxSize.width &&
            boundingBox.height <= pattern.maxSize.height) {
          
          allDetections.push({
            type: pattern.type,
            confidence: pattern.threshold,
            boundingBox,
            centerPoint: {
              x: match.x + pattern.template.width / 2,
              y: match.y + pattern.template.height / 2
            },
            properties: {
              patternName: pattern.name,
              detectionMethod: 'template_matching'
            }
          });
        }
      });
      
      onDetectionProgress((i + 1) / patterns.length * 100);
      
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    const filteredDetections = nonMaximumSuppression(allDetections);
    
    const components: ElectricalComponent[] = filteredDetections.map((detection, index) => ({
      id: `component_${detection.type}_${index}`,
      type: detection.type,
      boundingBox: detection.boundingBox,
      centerPoint: detection.centerPoint,
      confidence: detection.confidence,
      properties: {
        ...detection.properties,
        detectedAt: new Date().toISOString(),
        configUsed: detectionConfig.name
      },
      metadata: {
        source: 'auto_detection',
        version: '1.0',
        processingTime: Date.now()
      }
    }));
    
    setIsDetecting(false);
    onDetectionProgress(100);
    
    return components;
  }, [imageData, detectionConfig, customPatterns, normalizeImageData, templateMatch, nonMaximumSuppression, onDetectionProgress]);

  useEffect(() => {
    if (enableAutoDetection && imageData && !isDetecting) {
      detectComponents().then(components => {
        setDetectedComponents(components);
        onComponentsDetected(components);
      });
    }
  }, [imageData, enableAutoDetection, detectComponents, onComponentsDetected, isDetecting]);

  const handleManualDetection = useCallback(async () => {
    const components = await detectComponents();
    setDetectedComponents(components);
    onComponentsDetected(components);
  }, [detectComponents, onComponentsDetected]);

  return (
    <div className="electrical-component-detector">
      {!enableAutoDetection && (
        <button
          onClick={handleManualDetection}
          disabled={isDetecting || !imageData}
          className="detection-trigger-btn"
        >
          {isDetecting ? 'Detecting Components...' : 'Detect Components'}
        </button>
      )}
      
      {isDetecting && (
        <div className="detection-status">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '0%' }} />
          </div>
          <span className="status-text">Analyzing electrical components...</span>
        </div>
      )}
      
      <div className="detection-summary">
        <span className="component-count">
          {detectedComponents.length} components detected
        </span>
        <div className="component-breakdown">
          {Object.entries(
            detectedComponents.reduce((acc, comp) => {
              acc[comp.type] = (acc[comp.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          ).map(([type, count]) => (
            <span key={type} className="component-type-count">
              {type}: {count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};