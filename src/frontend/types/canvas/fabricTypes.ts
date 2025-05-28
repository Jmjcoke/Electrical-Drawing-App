// Fabric.js Canvas Types for AI Drawing Canvas

import { fabric } from 'fabric';
import { ComponentDetection, BoundingBox } from '../ai/computerVision';

export interface FabricCanvasConfig {
  width: number;
  height: number;
  enableSelection: boolean;
  enableZoom: boolean;
  backgroundColor?: string;
  preserveObjectStacking?: boolean;
}

export interface CanvasInteraction {
  type: 'click' | 'hover' | 'drag' | 'zoom' | 'pan';
  x: number;
  y: number;
  target?: fabric.Object;
  event?: Event;
}

export interface DrawingDimensions {
  width: number;
  height: number;
  scale: number;
  offset: { x: number; y: number };
}

export interface VisibleRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComponentOverlay extends fabric.Group {
  componentId: string;
  detection: ComponentDetection;
  confidence: number;
  isSelected: boolean;
  isHighlighted: boolean;
}

export interface PDFRenderConfig {
  scale: number;
  rotation: number;
  viewport: PDFViewport;
  renderTextLayer: boolean;
  renderAnnotationLayer: boolean;
}

export interface PDFViewport {
  width: number;
  height: number;
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
}

export interface CanvasPerformanceMetrics {
  renderTime: number;
  objectCount: number;
  memoryUsage: number;
  fps: number;
  lastUpdate: Date;
}

export interface VirtualCanvasConfig {
  canvasSize: DrawingDimensions;
  viewportSize: { width: number; height: number };
  bufferZone: number; // Extra objects to render outside viewport
}

export interface CanvasSelection {
  objects: fabric.Object[];
  components: ComponentDetection[];
  boundingBox: BoundingBox;
}

export interface ZoomConfig {
  min: number;
  max: number;
  step: number;
  current: number;
  center: { x: number; y: number };
}

export interface PanConfig {
  enabled: boolean;
  bounds?: BoundingBox;
  momentum: boolean;
  inertia: number;
}

export interface CanvasEventHandlers {
  onComponentSelect?: (component: ComponentDetection) => void;
  onComponentHover?: (component: ComponentDetection | null) => void;
  onCanvasClick?: (point: { x: number; y: number }) => void;
  onZoomChange?: (zoom: number) => void;
  onPanChange?: (offset: { x: number; y: number }) => void;
  onSelectionChange?: (selection: CanvasSelection) => void;
}

export interface OverlayRenderOptions {
  showConfidence: boolean;
  showLabels: boolean;
  colorByType: boolean;
  animateSelection: boolean;
  fadeInDuration: number;
}

export interface CanvasObjectPool {
  rectangles: fabric.Rect[];
  texts: fabric.Text[];
  groups: fabric.Group[];
  getObject: (type: 'rectangle' | 'text' | 'group') => fabric.Object;
  returnObject: (object: fabric.Object) => void;
  clear: () => void;
}

export interface CanvasState {
  zoom: number;
  pan: { x: number; y: number };
  selection: ComponentDetection[];
  visibleComponents: ComponentDetection[];
  overlayObjects: Map<string, ComponentOverlay>;
  isLoading: boolean;
  isDirty: boolean;
}