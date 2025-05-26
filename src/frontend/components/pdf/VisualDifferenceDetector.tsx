import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DifferenceRegion, DetectionSettings, AnalysisResult } from '../../types/comparison';
import { Point, BoundingBox } from '../../types/electrical';

interface VisualDifferenceDetectorProps {
  primaryImage: ImageData | HTMLCanvasElement;
  secondaryImage: ImageData | HTMLCanvasElement;
  settings: DetectionSettings;
  onDifferencesDetected: (differences: DifferenceRegion[]) => void;
  onAnalysisComplete: (result: AnalysisResult) => void;
  isAnalyzing?: boolean;
}

interface PixelDifference {
  x: number;
  y: number;
  intensity: number;
  type: 'structural' | 'color' | 'geometry';
}

interface RegionCluster {
  points: Point[];
  bounds: BoundingBox;
  averageIntensity: number;
  pixelCount: number;
}

export const VisualDifferenceDetector: React.FC<VisualDifferenceDetectorProps> = ({
  primaryImage,
  secondaryImage,
  settings,
  onDifferencesDetected,
  onAnalysisComplete,
  isAnalyzing = false
}) => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [intermediateResults, setIntermediateResults] = useState<any[]>([]);
  const [analysisStats, setAnalysisStats] = useState<any>(null);
  
  const workerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize web worker for heavy computations
  useEffect(() => {
    // In a real implementation, this would load a separate worker file
    const workerCode = `
      self.onmessage = function(e) {
        const { type, data } = e.data;
        
        switch(type) {
          case 'detectDifferences':
            const result = performDifferenceDetection(data);
            self.postMessage({ type: 'result', data: result });
            break;
        }
      };
      
      function performDifferenceDetection(data) {
        const { primary, secondary, settings } = data;
        // Simulate heavy computation with progress updates
        const totalSteps = 100;
        const differences = [];
        
        for(let i = 0; i < totalSteps; i++) {
          // Simulate processing time
          if(i % 10 === 0) {
            self.postMessage({ 
              type: 'progress', 
              data: { 
                progress: (i / totalSteps) * 100,
                step: 'Analyzing region ' + Math.floor(i / 10)
              }
            });
          }
          
          // Mock difference detection
          if(i % 25 === 0) {
            differences.push({
              id: 'diff_' + i,
              type: ['added', 'removed', 'modified'][Math.floor(Math.random() * 3)],
              boundingBox: {
                x: Math.random() * 800,
                y: Math.random() * 600,
                width: 20 + Math.random() * 100,
                height: 20 + Math.random() * 80
              },
              confidence: 0.6 + Math.random() * 0.4,
              description: 'Detected change in electrical component',
              severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
            });
          }
        }
        
        return { differences, stats: { totalRegions: totalSteps, changedRegions: differences.length } };
      }
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    workerRef.current = new Worker(URL.createObjectURL(blob));

    workerRef.current.onmessage = (e) => {
      const { type, data } = e.data;
      
      switch(type) {
        case 'progress':
          setProgress(data.progress);
          setCurrentStep(data.step);
          break;
        case 'result':
          onDifferencesDetected(data.differences);
          onAnalysisComplete({
            differences: data.differences,
            statistics: data.stats,
            processingTime: Date.now(),
            settings: settings
          });
          setProgress(100);
          setCurrentStep('Analysis complete');
          break;
      }
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [onDifferencesDetected, onAnalysisComplete, settings]);

  const getImageData = useCallback((source: ImageData | HTMLCanvasElement): ImageData => {
    if (source instanceof ImageData) {
      return source;
    } else {
      const ctx = source.getContext('2d');
      if (!ctx) throw new Error('Cannot get context from canvas');
      return ctx.getImageData(0, 0, source.width, source.height);
    }
  }, []);

  const preprocessImage = useCallback((imageData: ImageData, options: any = {}): ImageData => {
    const { width, height, data } = imageData;
    const processed = new ImageData(width, height);
    
    // Apply preprocessing filters based on settings
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      let a = data[i + 3];

      // Convert to grayscale if needed
      if (settings.grayscaleComparison) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = g = b = gray;
      }

      // Apply noise reduction
      if (settings.noiseReduction > 0) {
        // Simple noise reduction (in real implementation, use more sophisticated algorithms)
        const threshold = settings.noiseReduction * 10;
        if (Math.abs(r - 128) < threshold) r = 128;
        if (Math.abs(g - 128) < threshold) g = 128;
        if (Math.abs(b - 128) < threshold) b = 128;
      }

      processed.data[i] = r;
      processed.data[i + 1] = g;
      processed.data[i + 2] = b;
      processed.data[i + 3] = a;
    }

    return processed;
  }, [settings]);

  const calculatePixelDifference = useCallback((
    pixel1: [number, number, number, number],
    pixel2: [number, number, number, number]
  ): number => {
    const [r1, g1, b1, a1] = pixel1;
    const [r2, g2, b2, a2] = pixel2;
    
    // Weighted RGB difference
    const rDiff = Math.abs(r1 - r2) * 0.3;
    const gDiff = Math.abs(g1 - g2) * 0.59;
    const bDiff = Math.abs(b1 - b2) * 0.11;
    const aDiff = Math.abs(a1 - a2) * 0.1;
    
    return (rDiff + gDiff + bDiff + aDiff) / 255;
  }, []);

  const detectPixelDifferences = useCallback((
    primary: ImageData,
    secondary: ImageData
  ): PixelDifference[] => {
    const differences: PixelDifference[] = [];
    const { width, height } = primary;
    
    if (primary.width !== secondary.width || primary.height !== secondary.height) {
      throw new Error('Images must have the same dimensions');
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        
        const pixel1: [number, number, number, number] = [
          primary.data[index],
          primary.data[index + 1],
          primary.data[index + 2],
          primary.data[index + 3]
        ];
        
        const pixel2: [number, number, number, number] = [
          secondary.data[index],
          secondary.data[index + 1],
          secondary.data[index + 2],
          secondary.data[index + 3]
        ];
        
        const intensity = calculatePixelDifference(pixel1, pixel2);
        
        if (intensity > settings.sensitivityThreshold) {
          differences.push({
            x,
            y,
            intensity,
            type: intensity > 0.8 ? 'structural' : intensity > 0.4 ? 'geometry' : 'color'
          });
        }
      }
    }

    return differences;
  }, [calculatePixelDifference, settings]);

  const clusterDifferences = useCallback((
    differences: PixelDifference[]
  ): RegionCluster[] => {
    const clusters: RegionCluster[] = [];
    const visited = new Set<string>();
    const minClusterSize = settings.minRegionSize || 25;
    const maxDistance = settings.clusteringDistance || 10;

    differences.forEach(diff => {
      const key = `${diff.x},${diff.y}`;
      if (visited.has(key)) return;

      const cluster: Point[] = [];
      const stack: Point[] = [{ x: diff.x, y: diff.y }];
      
      while (stack.length > 0) {
        const current = stack.pop()!;
        const currentKey = `${current.x},${current.y}`;
        
        if (visited.has(currentKey)) continue;
        visited.add(currentKey);
        cluster.push(current);

        // Find nearby differences
        differences.forEach(nearDiff => {
          const nearKey = `${nearDiff.x},${nearDiff.y}`;
          if (visited.has(nearKey)) return;
          
          const distance = Math.sqrt(
            Math.pow(nearDiff.x - current.x, 2) + 
            Math.pow(nearDiff.y - current.y, 2)
          );
          
          if (distance <= maxDistance) {
            stack.push({ x: nearDiff.x, y: nearDiff.y });
          }
        });
      }

      if (cluster.length >= minClusterSize) {
        const bounds = cluster.reduce((acc, point) => ({
          x: Math.min(acc.x, point.x),
          y: Math.min(acc.y, point.y),
          maxX: Math.max(acc.maxX, point.x),
          maxY: Math.max(acc.maxY, point.y)
        }), { x: Infinity, y: Infinity, maxX: -Infinity, maxY: -Infinity });

        const averageIntensity = cluster.reduce((sum, point) => {
          const diff = differences.find(d => d.x === point.x && d.y === point.y);
          return sum + (diff?.intensity || 0);
        }, 0) / cluster.length;

        clusters.push({
          points: cluster,
          bounds: {
            x: bounds.x,
            y: bounds.y,
            width: bounds.maxX - bounds.x,
            height: bounds.maxY - bounds.y
          },
          averageIntensity,
          pixelCount: cluster.length
        });
      }
    });

    return clusters;
  }, [settings]);

  const classifyDifferences = useCallback((
    clusters: RegionCluster[]
  ): DifferenceRegion[] => {
    return clusters.map((cluster, index) => {
      // Determine difference type based on intensity and size
      let type: 'added' | 'removed' | 'modified';
      let severity: 'low' | 'medium' | 'high';
      
      if (cluster.averageIntensity > 0.8) {
        type = cluster.pixelCount > 100 ? 'added' : 'modified';
        severity = 'high';
      } else if (cluster.averageIntensity > 0.5) {
        type = 'modified';
        severity = 'medium';
      } else {
        type = 'modified';
        severity = 'low';
      }

      // Generate description based on analysis
      let description = `${type.charAt(0).toUpperCase() + type.slice(1)} region detected`;
      if (cluster.pixelCount > 500) {
        description += ' (large area)';
      } else if (cluster.pixelCount < 50) {
        description += ' (small detail)';
      }

      return {
        id: `region_${index}_${Date.now()}`,
        type,
        boundingBox: {
          ...cluster.bounds,
          // Add padding
          x: Math.max(0, cluster.bounds.x - 5),
          y: Math.max(0, cluster.bounds.y - 5),
          width: cluster.bounds.width + 10,
          height: cluster.bounds.height + 10
        },
        confidence: Math.min(0.95, 0.5 + cluster.averageIntensity * 0.45),
        description,
        severity,
        metadata: {
          pixelCount: cluster.pixelCount,
          averageIntensity: cluster.averageIntensity,
          clusterSize: cluster.points.length
        }
      };
    });
  }, []);

  const performAnalysis = useCallback(async () => {
    if (!primaryImage || !secondaryImage) return;

    setProgress(0);
    setCurrentStep('Initializing analysis...');

    try {
      // Step 1: Preprocess images
      setCurrentStep('Preprocessing images...');
      setProgress(10);
      
      const primaryData = preprocessImage(getImageData(primaryImage));
      const secondaryData = preprocessImage(getImageData(secondaryImage));

      // Step 2: Detect pixel differences
      setCurrentStep('Detecting pixel differences...');
      setProgress(30);
      
      const pixelDiffs = detectPixelDifferences(primaryData, secondaryData);

      // Step 3: Cluster differences into regions
      setCurrentStep('Clustering difference regions...');
      setProgress(60);
      
      const clusters = clusterDifferences(pixelDiffs);

      // Step 4: Classify and analyze differences
      setCurrentStep('Classifying differences...');
      setProgress(80);
      
      const differences = classifyDifferences(clusters);

      // Step 5: Generate analysis results
      setCurrentStep('Generating analysis report...');
      setProgress(95);
      
      const analysisResult: AnalysisResult = {
        differences,
        statistics: {
          totalPixelDifferences: pixelDiffs.length,
          clusteredRegions: clusters.length,
          finalDifferences: differences.length,
          processingTime: Date.now(),
          averageConfidence: differences.reduce((sum, d) => sum + d.confidence, 0) / differences.length,
          severityBreakdown: {
            high: differences.filter(d => d.severity === 'high').length,
            medium: differences.filter(d => d.severity === 'medium').length,
            low: differences.filter(d => d.severity === 'low').length
          }
        },
        settings,
        processingTime: Date.now()
      };

      setAnalysisStats(analysisResult.statistics);
      onDifferencesDetected(differences);
      onAnalysisComplete(analysisResult);

      setCurrentStep('Analysis complete');
      setProgress(100);

    } catch (error) {
      console.error('Analysis failed:', error);
      setCurrentStep('Analysis failed');
    }
  }, [
    primaryImage,
    secondaryImage,
    settings,
    preprocessImage,
    getImageData,
    detectPixelDifferences,
    clusterDifferences,
    classifyDifferences,
    onDifferencesDetected,
    onAnalysisComplete
  ]);

  const renderDifferencePreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !primaryImage || !secondaryImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw difference visualization
    const primaryData = getImageData(primaryImage);
    const secondaryData = getImageData(secondaryImage);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Create difference overlay
    const diffData = ctx.createImageData(primaryData.width, primaryData.height);
    
    for (let i = 0; i < primaryData.data.length; i += 4) {
      const r1 = primaryData.data[i];
      const g1 = primaryData.data[i + 1];
      const b1 = primaryData.data[i + 2];
      
      const r2 = secondaryData.data[i];
      const g2 = secondaryData.data[i + 1];
      const b2 = secondaryData.data[i + 2];
      
      const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
      
      if (diff > settings.sensitivityThreshold * 255 * 3) {
        diffData.data[i] = 255;     // Red for differences
        diffData.data[i + 1] = 0;
        diffData.data[i + 2] = 0;
        diffData.data[i + 3] = 128; // Semi-transparent
      } else {
        diffData.data[i] = r1;
        diffData.data[i + 1] = g1;
        diffData.data[i + 2] = b1;
        diffData.data[i + 3] = 255;
      }
    }
    
    ctx.putImageData(diffData, 0, 0);
  }, [primaryImage, secondaryImage, settings, getImageData]);

  useEffect(() => {
    if (primaryImage && secondaryImage && isAnalyzing) {
      performAnalysis();
    }
  }, [primaryImage, secondaryImage, isAnalyzing, performAnalysis]);

  useEffect(() => {
    renderDifferencePreview();
  }, [renderDifferencePreview]);

  return (
    <div className="visual-difference-detector">
      {/* Analysis Controls */}
      <div className="analysis-controls">
        <div className="detection-settings">
          <div className="setting-group">
            <label>Sensitivity:</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.sensitivityThreshold}
              onChange={(e) => settings.sensitivityThreshold = parseFloat(e.target.value)}
            />
            <span>{(settings.sensitivityThreshold * 100).toFixed(0)}%</span>
          </div>
          
          <div className="setting-group">
            <label>Min Region Size:</label>
            <input
              type="number"
              min="1"
              max="500"
              value={settings.minRegionSize}
              onChange={(e) => settings.minRegionSize = parseInt(e.target.value)}
            />
          </div>
          
          <div className="setting-group">
            <label>
              <input
                type="checkbox"
                checked={settings.grayscaleComparison}
                onChange={(e) => settings.grayscaleComparison = e.target.checked}
              />
              Grayscale Comparison
            </label>
          </div>
        </div>

        <button
          onClick={performAnalysis}
          disabled={isAnalyzing || !primaryImage || !secondaryImage}
          className="analyze-btn"
        >
          {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
        </button>
      </div>

      {/* Progress Indicator */}
      {isAnalyzing && (
        <div className="analysis-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="progress-text">
            {currentStep} ({progress.toFixed(0)}%)
          </div>
        </div>
      )}

      {/* Difference Preview */}
      <div className="difference-preview">
        <h4>Difference Overlay</h4>
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="preview-canvas"
        />
      </div>

      {/* Analysis Statistics */}
      {analysisStats && (
        <div className="analysis-statistics">
          <h4>Analysis Results</h4>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Total Differences:</span>
              <span className="stat-value">{analysisStats.finalDifferences}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">High Severity:</span>
              <span className="stat-value severity-high">{analysisStats.severityBreakdown.high}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Medium Severity:</span>
              <span className="stat-value severity-medium">{analysisStats.severityBreakdown.medium}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Low Severity:</span>
              <span className="stat-value severity-low">{analysisStats.severityBreakdown.low}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Average Confidence:</span>
              <span className="stat-value">{(analysisStats.averageConfidence * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};