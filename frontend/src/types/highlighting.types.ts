/**
 * TypeScript interfaces for visual highlighting system
 * Supports component highlighting, coordinate mapping, and visual overlays
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface TextRange {
  readonly start: number;
  readonly end: number;
  readonly lineNumber?: number;
}

export type HighlightType = 'component' | 'area' | 'connection' | 'annotation' | 'suggestion';

export interface ComponentHighlight {
  readonly id: string;
  readonly componentId?: string;
  readonly type: HighlightType;
  readonly coordinates: HighlightCoordinates;
  readonly style: HighlightStyle;
  readonly responseId: string;
  readonly queryId: string;
  readonly sessionId: string;
  readonly createdAt: Date;
  readonly expiresAt?: Date;
  readonly isVisible: boolean;
  readonly isPersistent: boolean;
}

export interface HighlightCoordinates {
  readonly x: number;           // Normalized coordinates (0-1)
  readonly y: number;
  readonly width?: number;      // For rectangular highlights
  readonly height?: number;
  readonly radius?: number;     // For circular highlights
  readonly points?: Point[];    // For polygon highlights
  readonly pageNumber: number;
  readonly zoomLevel: number;
  readonly viewportOffset: { x: number; y: number };
}

export interface HighlightStyle {
  readonly color: string;
  readonly opacity: number;
  readonly strokeWidth: number;
  readonly strokeStyle: 'solid' | 'dashed' | 'dotted';
  readonly fillOpacity: number;
  readonly animationType?: 'pulse' | 'glow' | 'fade' | 'none';
  readonly zIndex: number;
}

export interface HighlightReference {
  readonly highlightId: string;
  readonly responseText: string;
  readonly textPosition: TextRange;
  readonly componentMention: ComponentMention;
  readonly linkType: 'direct' | 'inferred' | 'suggested';
  readonly confidence: number;
}

export interface ComponentMention {
  readonly componentType: string;
  readonly componentDescription: string;
  readonly mentionText: string;
  readonly contextualClues: string[];
  readonly locationHints: LocationHint[];
}

export interface LocationHint {
  readonly type: 'coordinate' | 'relative' | 'descriptive';
  readonly value: string;
  readonly parsedValue?: { x?: number; y?: number; reference?: string };
  readonly confidence: number;
}

export interface HighlightSession {
  readonly sessionId: string;
  readonly highlights: ComponentHighlight[];
  readonly activeHighlights: string[];
  readonly persistentHighlights: string[];
  readonly highlightGroups: HighlightGroup[];
  readonly lastUpdated: Date;
}

export interface HighlightGroup {
  readonly id: string;
  readonly name: string;
  readonly highlightIds: string[];
  readonly color: string;
  readonly isVisible: boolean;
  readonly queryId?: string;
  readonly responseId?: string;
}

// WebSocket Event Interfaces
export interface HighlightingWebSocketEvents {
  // Client to Server
  'highlight-create': { highlight: ComponentHighlight; sessionId: string };
  'highlight-update': { highlightId: string; updates: Partial<ComponentHighlight> };
  'highlight-delete': { highlightId: string; sessionId: string };
  'highlight-visibility-toggle': { highlightIds: string[]; visible: boolean };
  
  // Server to Client
  'highlight-created': { highlight: ComponentHighlight };
  'highlight-updated': { highlightId: string; highlight: ComponentHighlight };
  'highlight-deleted': { highlightId: string };
  'highlights-synchronized': { highlights: ComponentHighlight[] };
  'highlight-suggestion': { suggestions: ComponentHighlight[] };
}

// Coordinate Mapping Types
export interface CoordinateTransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly rotation: number;
}

export interface ViewportState {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
  readonly width: number;
  readonly height: number;
}

// API Response Types
export interface HighlightApiResponse {
  readonly id: string;
  readonly success: boolean;
  readonly highlight?: ComponentHighlight;
  readonly error?: string;
}

export interface HighlightBatchResponse {
  readonly success: boolean;
  readonly results: HighlightApiResponse[];
  readonly errors: string[];
}