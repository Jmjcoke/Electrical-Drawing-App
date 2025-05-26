import { useState, useCallback, useEffect } from 'react';
import { ElectricalComponent, SelectionState, Point, BoundingBox } from '../types/electrical';

interface UseComponentSelectionProps {
  components: ElectricalComponent[];
  onSelectionChange?: (selectedComponents: ElectricalComponent[]) => void;
  maxSelections?: number;
  enableMultiSelect?: boolean;
}

interface UseComponentSelectionReturn {
  selectedComponents: ElectricalComponent[];
  selectedComponentIds: string[];
  selectionState: SelectionState;
  selectComponent: (componentId: string, multiSelect?: boolean) => void;
  selectComponents: (componentIds: string[]) => void;
  clearSelection: () => void;
  selectAll: () => void;
  selectByType: (componentType: string) => void;
  selectInArea: (area: BoundingBox) => void;
  isSelected: (componentId: string) => boolean;
  getSelectionBounds: () => BoundingBox | null;
  duplicateSelection: () => void;
  deleteSelection: () => void;
  toggleSelection: (componentId: string) => void;
  selectionStats: {
    count: number;
    types: Record<string, number>;
    totalArea: number;
    averageConfidence: number;
  };
}

export const useComponentSelection = ({
  components,
  onSelectionChange,
  maxSelections,
  enableMultiSelect = true
}: UseComponentSelectionProps): UseComponentSelectionReturn => {
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  const [selectionHistory, setSelectionHistory] = useState<string[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const selectedComponents = components.filter(component => 
    selectedComponentIds.includes(component.id)
  );

  const selectionState: SelectionState = {
    selectedIds: selectedComponentIds,
    lastSelectedId: selectedComponentIds[selectedComponentIds.length - 1] || null,
    selectionCount: selectedComponentIds.length,
    multiSelectEnabled: enableMultiSelect
  };

  const addToHistory = useCallback((newSelection: string[]) => {
    setSelectionHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push([...newSelection]);
      return newHistory.slice(-50); // Keep last 50 selections
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const selectComponent = useCallback((componentId: string, multiSelect = false) => {
    if (!components.find(c => c.id === componentId)) return;

    setSelectedComponentIds(prev => {
      let newSelection: string[];

      if (!enableMultiSelect || !multiSelect) {
        newSelection = [componentId];
      } else {
        if (prev.includes(componentId)) {
          newSelection = prev.filter(id => id !== componentId);
        } else {
          if (maxSelections && prev.length >= maxSelections) {
            newSelection = [...prev.slice(1), componentId];
          } else {
            newSelection = [...prev, componentId];
          }
        }
      }

      addToHistory(newSelection);
      return newSelection;
    });
  }, [components, enableMultiSelect, maxSelections, addToHistory]);

  const selectComponents = useCallback((componentIds: string[]) => {
    const validIds = componentIds.filter(id => 
      components.find(c => c.id === id)
    );

    const finalSelection = maxSelections 
      ? validIds.slice(-maxSelections)
      : validIds;

    setSelectedComponentIds(finalSelection);
    addToHistory(finalSelection);
  }, [components, maxSelections, addToHistory]);

  const clearSelection = useCallback(() => {
    setSelectedComponentIds([]);
    addToHistory([]);
  }, [addToHistory]);

  const selectAll = useCallback(() => {
    const allIds = components.map(c => c.id);
    const finalSelection = maxSelections 
      ? allIds.slice(-maxSelections)
      : allIds;

    setSelectedComponentIds(finalSelection);
    addToHistory(finalSelection);
  }, [components, maxSelections, addToHistory]);

  const selectByType = useCallback((componentType: string) => {
    const typeComponents = components
      .filter(c => c.type === componentType)
      .map(c => c.id);
    
    const finalSelection = maxSelections 
      ? typeComponents.slice(-maxSelections)
      : typeComponents;

    setSelectedComponentIds(finalSelection);
    addToHistory(finalSelection);
  }, [components, maxSelections, addToHistory]);

  const selectInArea = useCallback((area: BoundingBox) => {
    const areaComponents = components.filter(component => {
      const bbox = component.boundingBox;
      return !(bbox.x + bbox.width < area.x || 
               bbox.x > area.x + area.width || 
               bbox.y + bbox.height < area.y || 
               bbox.y > area.y + area.height);
    }).map(c => c.id);

    setSelectedComponentIds(prev => {
      if (!enableMultiSelect) {
        return areaComponents.slice(-1);
      }

      const combined = [...new Set([...prev, ...areaComponents])];
      const finalSelection = maxSelections 
        ? combined.slice(-maxSelections)
        : combined;

      addToHistory(finalSelection);
      return finalSelection;
    });
  }, [components, enableMultiSelect, maxSelections, addToHistory]);

  const isSelected = useCallback((componentId: string): boolean => {
    return selectedComponentIds.includes(componentId);
  }, [selectedComponentIds]);

  const getSelectionBounds = useCallback((): BoundingBox | null => {
    if (selectedComponents.length === 0) return null;

    const bounds = selectedComponents.reduce((acc, component) => {
      const bbox = component.boundingBox;
      return {
        minX: Math.min(acc.minX, bbox.x),
        minY: Math.min(acc.minY, bbox.y),
        maxX: Math.max(acc.maxX, bbox.x + bbox.width),
        maxY: Math.max(acc.maxY, bbox.y + bbox.height)
      };
    }, {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    });

    return {
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY
    };
  }, [selectedComponents]);

  const duplicateSelection = useCallback(() => {
    // This would typically trigger a duplicate action in the parent component
    // For now, we'll just maintain the selection
    return selectedComponents;
  }, [selectedComponents]);

  const deleteSelection = useCallback(() => {
    // This would typically trigger a delete action in the parent component
    clearSelection();
  }, [clearSelection]);

  const toggleSelection = useCallback((componentId: string) => {
    selectComponent(componentId, true);
  }, [selectComponent]);

  const selectionStats = {
    count: selectedComponents.length,
    types: selectedComponents.reduce((acc, component) => {
      acc[component.type] = (acc[component.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    totalArea: selectedComponents.reduce((acc, component) => {
      return acc + (component.boundingBox.width * component.boundingBox.height);
    }, 0),
    averageConfidence: selectedComponents.length > 0 
      ? selectedComponents.reduce((acc, component) => acc + component.confidence, 0) / selectedComponents.length
      : 0
  };

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange?.(selectedComponents);
  }, [selectedComponents, onSelectionChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'a':
            event.preventDefault();
            selectAll();
            break;
          case 'd':
            event.preventDefault();
            clearSelection();
            break;
          case 'z':
            if (event.shiftKey) {
              // Redo
              if (historyIndex < selectionHistory.length - 1) {
                setHistoryIndex(prev => prev + 1);
                setSelectedComponentIds(selectionHistory[historyIndex + 1]);
              }
            } else {
              // Undo
              if (historyIndex > 0) {
                setHistoryIndex(prev => prev - 1);
                setSelectedComponentIds(selectionHistory[historyIndex - 1]);
              }
            }
            event.preventDefault();
            break;
        }
      }

      if (event.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectAll, clearSelection, selectionHistory, historyIndex]);

  return {
    selectedComponents,
    selectedComponentIds,
    selectionState,
    selectComponent,
    selectComponents,
    clearSelection,
    selectAll,
    selectByType,
    selectInArea,
    isSelected,
    getSelectionBounds,
    duplicateSelection,
    deleteSelection,
    toggleSelection,
    selectionStats
  };
};