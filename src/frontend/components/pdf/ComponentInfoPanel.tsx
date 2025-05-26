import React, { useState, useCallback } from 'react';
import { ElectricalComponent, ComponentProperty, Point } from '../../types/electrical';

interface ComponentInfoPanelProps {
  selectedComponents: ElectricalComponent[];
  onComponentUpdate: (componentId: string, updates: Partial<ElectricalComponent>) => void;
  onComponentDelete: (componentId: string) => void;
  onNavigateToComponent: (componentId: string) => void;
  isVisible: boolean;
  onToggleVisibility: () => void;
  position?: Point;
}

interface EditableProperty {
  key: string;
  value: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
  unit?: string;
}

export const ComponentInfoPanel: React.FC<ComponentInfoPanelProps> = ({
  selectedComponents,
  onComponentUpdate,
  onComponentDelete,
  onNavigateToComponent,
  isVisible,
  onToggleVisibility,
  position
}) => {
  const [editingComponent, setEditingComponent] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['properties']));

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }, []);

  const getEditableProperties = useCallback((component: ElectricalComponent): EditableProperty[] => {
    const baseProperties: EditableProperty[] = [
      { key: 'type', value: component.type, type: 'select', 
        options: ['outlet', 'switch', 'light_fixture', 'panel', 'junction_box', 'conduit', 'wire', 'motor', 'transformer'] },
      { key: 'confidence', value: component.confidence.toFixed(2), type: 'number' }
    ];

    const customProperties = Object.entries(component.properties || {}).map(([key, value]) => ({
      key,
      value: String(value),
      type: 'text' as const
    }));

    return [...baseProperties, ...customProperties];
  }, []);

  const handlePropertyChange = useCallback((
    componentId: string, 
    propertyKey: string, 
    newValue: string
  ) => {
    const component = selectedComponents.find(c => c.id === componentId);
    if (!component) return;

    let updates: Partial<ElectricalComponent> = {};

    if (propertyKey === 'type') {
      updates.type = newValue as any;
    } else if (propertyKey === 'confidence') {
      updates.confidence = parseFloat(newValue) || 0;
    } else {
      updates.properties = {
        ...component.properties,
        [propertyKey]: newValue
      };
    }

    onComponentUpdate(componentId, updates);
  }, [selectedComponents, onComponentUpdate]);

  const addCustomProperty = useCallback((componentId: string) => {
    const key = prompt('Property name:');
    if (!key) return;

    const value = prompt('Property value:');
    if (value === null) return;

    handlePropertyChange(componentId, key, value);
  }, [handlePropertyChange]);

  const removeCustomProperty = useCallback((componentId: string, propertyKey: string) => {
    const component = selectedComponents.find(c => c.id === componentId);
    if (!component) return;

    const newProperties = { ...component.properties };
    delete newProperties[propertyKey];

    onComponentUpdate(componentId, { properties: newProperties });
  }, [selectedComponents, onComponentUpdate]);

  const formatCoordinate = useCallback((point: Point): string => {
    return `(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`;
  }, []);

  const renderComponentCard = useCallback((component: ElectricalComponent) => {
    const isEditing = editingComponent === component.id;
    const editableProps = getEditableProperties(component);

    return (
      <div key={component.id} className="component-card">
        <div className="component-header">
          <div className="component-title">
            <span className="component-id">{component.id}</span>
            <span className={`component-type type-${component.type}`}>
              {component.type.replace('_', ' ')}
            </span>
          </div>
          <div className="component-actions">
            <button
              onClick={() => onNavigateToComponent(component.id)}
              className="nav-btn"
              title="Navigate to component"
            >
              📍
            </button>
            <button
              onClick={() => setEditingComponent(isEditing ? null : component.id)}
              className="edit-btn"
              title={isEditing ? 'Stop editing' : 'Edit component'}
            >
              {isEditing ? '✓' : '✏️'}
            </button>
            <button
              onClick={() => onComponentDelete(component.id)}
              className="delete-btn"
              title="Delete component"
            >
              🗑️
            </button>
          </div>
        </div>

        <div className="component-details">
          <div className="section-header" onClick={() => toggleSection('properties')}>
            <span>Properties</span>
            <span className="toggle-icon">
              {expandedSections.has('properties') ? '▼' : '▶'}
            </span>
          </div>
          
          {expandedSections.has('properties') && (
            <div className="properties-section">
              {editableProps.map(prop => (
                <div key={prop.key} className="property-row">
                  <label className="property-label">{prop.key}:</label>
                  {isEditing ? (
                    <div className="property-input-group">
                      {prop.type === 'select' ? (
                        <select
                          value={prop.value}
                          onChange={(e) => handlePropertyChange(component.id, prop.key, e.target.value)}
                          className="property-select"
                        >
                          {prop.options?.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={prop.type}
                          value={prop.value}
                          onChange={(e) => handlePropertyChange(component.id, prop.key, e.target.value)}
                          className="property-input"
                        />
                      )}
                      {prop.unit && <span className="property-unit">{prop.unit}</span>}
                      {!['type', 'confidence'].includes(prop.key) && (
                        <button
                          onClick={() => removeCustomProperty(component.id, prop.key)}
                          className="remove-property-btn"
                          title="Remove property"
                        >
                          ❌
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="property-value">
                      {prop.value} {prop.unit}
                    </span>
                  )}
                </div>
              ))}
              
              {isEditing && (
                <button
                  onClick={() => addCustomProperty(component.id)}
                  className="add-property-btn"
                >
                  + Add Property
                </button>
              )}
            </div>
          )}

          <div className="section-header" onClick={() => toggleSection('geometry')}>
            <span>Geometry</span>
            <span className="toggle-icon">
              {expandedSections.has('geometry') ? '▼' : '▶'}
            </span>
          </div>
          
          {expandedSections.has('geometry') && (
            <div className="geometry-section">
              <div className="geometry-row">
                <span className="geometry-label">Center:</span>
                <span className="geometry-value">
                  {formatCoordinate(component.centerPoint)}
                </span>
              </div>
              <div className="geometry-row">
                <span className="geometry-label">Bounding Box:</span>
                <span className="geometry-value">
                  {component.boundingBox.width.toFixed(1)} × {component.boundingBox.height.toFixed(1)}
                </span>
              </div>
              <div className="geometry-row">
                <span className="geometry-label">Position:</span>
                <span className="geometry-value">
                  {formatCoordinate({ x: component.boundingBox.x, y: component.boundingBox.y })}
                </span>
              </div>
            </div>
          )}

          {component.metadata && (
            <>
              <div className="section-header" onClick={() => toggleSection('metadata')}>
                <span>Metadata</span>
                <span className="toggle-icon">
                  {expandedSections.has('metadata') ? '▼' : '▶'}
                </span>
              </div>
              
              {expandedSections.has('metadata') && (
                <div className="metadata-section">
                  {Object.entries(component.metadata).map(([key, value]) => (
                    <div key={key} className="metadata-row">
                      <span className="metadata-label">{key}:</span>
                      <span className="metadata-value">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }, [
    editingComponent, 
    getEditableProperties, 
    expandedSections, 
    toggleSection, 
    onNavigateToComponent, 
    onComponentDelete, 
    handlePropertyChange, 
    addCustomProperty, 
    removeCustomProperty, 
    formatCoordinate
  ]);

  if (!isVisible) {
    return (
      <button 
        onClick={onToggleVisibility}
        className="info-panel-toggle collapsed"
        title="Show component information"
      >
        ℹ️ ({selectedComponents.length})
      </button>
    );
  }

  return (
    <div 
      className="component-info-panel"
      style={position ? { 
        position: 'absolute', 
        left: position.x, 
        top: position.y 
      } : undefined}
    >
      <div className="panel-header">
        <h3 className="panel-title">
          Component Information
          {selectedComponents.length > 0 && (
            <span className="selection-count">({selectedComponents.length} selected)</span>
          )}
        </h3>
        <button 
          onClick={onToggleVisibility}
          className="panel-close-btn"
          title="Hide panel"
        >
          ✕
        </button>
      </div>

      <div className="panel-content">
        {selectedComponents.length === 0 ? (
          <div className="empty-state">
            <p>No components selected</p>
            <p className="hint">Click on a component to view its details</p>
          </div>
        ) : (
          <div className="components-list">
            {selectedComponents.map(renderComponentCard)}
          </div>
        )}
      </div>

      {selectedComponents.length > 1 && (
        <div className="bulk-actions">
          <button className="bulk-action-btn">
            Apply to All ({selectedComponents.length})
          </button>
        </div>
      )}
    </div>
  );
};