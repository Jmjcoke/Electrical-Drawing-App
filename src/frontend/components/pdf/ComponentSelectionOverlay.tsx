import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ElectricalComponent, SelectionState, Point, BoundingBox } from '../../types/electrical';

interface ComponentSelectionOverlayProps {
  width: number;
  height: number;
  scale: number;
  components: ElectricalComponent[];
  selectedComponents: string[];
  onComponentSelect: (componentId: string, multiSelect?: boolean) => void;
  onSelectionClear: () => void;
  selectionMode: 'single' | 'multiple' | 'area';
  highlightColor?: string;
  selectionColor?: string;
}

export const ComponentSelectionOverlay: React.FC<ComponentSelectionOverlayProps> = ({
  width,
  height,
  scale,
  components,
  selectedComponents,
  onComponentSelect,
  onSelectionClear,
  selectionMode,
  highlightColor = '#4CAF50',
  selectionColor = '#2196F3'
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [selectionBox, setSelectionBox] = useState<BoundingBox | null>(null);

  const getMousePosition = useCallback((event: React.MouseEvent): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };

    const rect = svg.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale
    };
  }, [scale]);

  const isPointInBoundingBox = useCallback((point: Point, bbox: BoundingBox): boolean => {
    return point.x >= bbox.x && 
           point.x <= bbox.x + bbox.width && 
           point.y >= bbox.y && 
           point.y <= bbox.y + bbox.height;
  }, []);

  const getComponentAt = useCallback((point: Point): ElectricalComponent | null => {
    for (let i = components.length - 1; i >= 0; i--) {
      const component = components[i];
      if (isPointInBoundingBox(point, component.boundingBox)) {
        return component;
      }
    }
    return null;
  }, [components, isPointInBoundingBox]);

  const getComponentsInArea = useCallback((area: BoundingBox): ElectricalComponent[] => {
    return components.filter(component => {
      const bbox = component.boundingBox;
      return !(bbox.x + bbox.width < area.x || 
               bbox.x > area.x + area.width || 
               bbox.y + bbox.height < area.y || 
               bbox.y > area.y + area.height);
    });
  }, [components]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    const point = getMousePosition(event);
    const component = getComponentAt(point);

    if (selectionMode === 'area') {
      setIsDragging(true);
      setDragStart(point);
      setSelectionBox({ x: point.x, y: point.y, width: 0, height: 0 });
    } else if (component) {
      const multiSelect = selectionMode === 'multiple' && (event.ctrlKey || event.metaKey);
      onComponentSelect(component.id, multiSelect);
    } else {
      onSelectionClear();
    }
  }, [getMousePosition, getComponentAt, selectionMode, onComponentSelect, onSelectionClear]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const point = getMousePosition(event);

    if (isDragging && dragStart && selectionMode === 'area') {
      const box: BoundingBox = {
        x: Math.min(dragStart.x, point.x),
        y: Math.min(dragStart.y, point.y),
        width: Math.abs(point.x - dragStart.x),
        height: Math.abs(point.y - dragStart.y)
      };
      setSelectionBox(box);
    } else {
      const component = getComponentAt(point);
      setHoveredComponent(component?.id || null);
    }
  }, [getMousePosition, isDragging, dragStart, selectionMode, getComponentAt]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && selectionBox) {
      const componentsInArea = getComponentsInArea(selectionBox);
      componentsInArea.forEach(component => {
        onComponentSelect(component.id, true);
      });
    }
    
    setIsDragging(false);
    setDragStart(null);
    setSelectionBox(null);
  }, [isDragging, selectionBox, getComponentsInArea, onComponentSelect]);

  const renderComponent = useCallback((component: ElectricalComponent) => {
    const { boundingBox } = component;
    const isSelected = selectedComponents.includes(component.id);
    const isHovered = hoveredComponent === component.id;
    
    let strokeColor = 'transparent';
    let fillOpacity = 0;
    
    if (isSelected) {
      strokeColor = selectionColor;
      fillOpacity = 0.1;
    } else if (isHovered) {
      strokeColor = highlightColor;
      fillOpacity = 0.05;
    }

    return (
      <g key={component.id}>
        <rect
          x={boundingBox.x}
          y={boundingBox.y}
          width={boundingBox.width}
          height={boundingBox.height}
          fill={strokeColor}
          fillOpacity={fillOpacity}
          stroke={strokeColor}
          strokeWidth={2 / scale}
          strokeDasharray={isSelected ? '5,3' : undefined}
          pointerEvents="none"
        />
        
        {isSelected && (
          <>
            <circle
              cx={boundingBox.x}
              cy={boundingBox.y}
              r={4 / scale}
              fill={selectionColor}
              pointerEvents="none"
            />
            <circle
              cx={boundingBox.x + boundingBox.width}
              cy={boundingBox.y}
              r={4 / scale}
              fill={selectionColor}
              pointerEvents="none"
            />
            <circle
              cx={boundingBox.x}
              cy={boundingBox.y + boundingBox.height}
              r={4 / scale}
              fill={selectionColor}
              pointerEvents="none"
            />
            <circle
              cx={boundingBox.x + boundingBox.width}
              cy={boundingBox.y + boundingBox.height}
              r={4 / scale}
              fill={selectionColor}
              pointerEvents="none"
            />
          </>
        )}
        
        {(isSelected || isHovered) && (
          <text
            x={boundingBox.x + boundingBox.width / 2}
            y={boundingBox.y - 5 / scale}
            textAnchor="middle"
            fontSize={12 / scale}
            fill={strokeColor}
            pointerEvents="none"
            fontWeight="bold"
          >
            {component.type} ({component.id})
          </text>
        )}
      </g>
    );
  }, [selectedComponents, hoveredComponent, highlightColor, selectionColor, scale]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'all',
        cursor: selectionMode === 'area' ? 'crosshair' : 'pointer'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setHoveredComponent(null);
        if (isDragging) {
          handleMouseUp();
        }
      }}
    >
      {components.map(renderComponent)}
      
      {selectionBox && (
        <rect
          x={selectionBox.x}
          y={selectionBox.y}
          width={selectionBox.width}
          height={selectionBox.height}
          fill="rgba(33, 150, 243, 0.1)"
          stroke="#2196F3"
          strokeWidth={1 / scale}
          strokeDasharray="3,2"
          pointerEvents="none"
        />
      )}
    </svg>
  );
};