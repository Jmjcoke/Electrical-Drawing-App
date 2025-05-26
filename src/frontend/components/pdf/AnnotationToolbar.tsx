import React, { useState, useCallback } from 'react';
import { AnnotationTool, AnnotationStyle, MeasurementUnit } from '../../types/annotations';

interface AnnotationToolbarProps {
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  annotationStyle: AnnotationStyle;
  onStyleChange: (style: Partial<AnnotationStyle>) => void;
  measurementUnit: MeasurementUnit;
  onMeasurementUnitChange: (unit: MeasurementUnit) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onSave: () => void;
  onLoad: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isCollaborative?: boolean;
  collaborators?: Array<{ id: string; name: string; color: string; isActive: boolean }>;
}

const toolIcons: Record<AnnotationTool, string> = {
  select: '👆',
  pan: '✋',
  text: '📝',
  rectangle: '⬜',
  circle: '⭕',
  arrow: '➡️',
  line: '📏',
  freehand: '✏️',
  highlighter: '🖍️',
  stamp: '📌',
  measurement: '📐',
  callout: '💬'
};

const toolLabels: Record<AnnotationTool, string> = {
  select: 'Select',
  pan: 'Pan',
  text: 'Text',
  rectangle: 'Rectangle',
  circle: 'Circle',
  arrow: 'Arrow',
  line: 'Line',
  freehand: 'Freehand',
  highlighter: 'Highlighter',
  stamp: 'Stamp',
  measurement: 'Measurement',
  callout: 'Callout'
};

export const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
  activeTool,
  onToolChange,
  annotationStyle,
  onStyleChange,
  measurementUnit,
  onMeasurementUnitChange,
  onUndo,
  onRedo,
  onClear,
  onSave,
  onLoad,
  canUndo,
  canRedo,
  isCollaborative = false,
  collaborators = []
}) => {
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showMeasurementPanel, setShowMeasurementPanel] = useState(false);

  const renderToolButton = useCallback((tool: AnnotationTool) => (
    <button
      key={tool}
      className={`tool-btn ${activeTool === tool ? 'active' : ''}`}
      onClick={() => onToolChange(tool)}
      title={toolLabels[tool]}
    >
      <span className="tool-icon">{toolIcons[tool]}</span>
      <span className="tool-label">{toolLabels[tool]}</span>
    </button>
  ), [activeTool, onToolChange]);

  const colorPresets = [
    '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
    '#FFA500', '#800080', '#FFC0CB', '#A52A2A', '#808080', '#000000'
  ];

  return (
    <div className="annotation-toolbar">
      <div className="toolbar-section tools-section">
        <div className="section-label">Tools</div>
        <div className="tool-group">
          {Object.keys(toolIcons).map(tool => renderToolButton(tool as AnnotationTool))}
        </div>
      </div>

      <div className="toolbar-section style-section">
        <div className="section-label">Style</div>
        <div className="style-controls">
          <button
            className={`style-btn ${showStylePanel ? 'active' : ''}`}
            onClick={() => setShowStylePanel(!showStylePanel)}
            title="Style options"
          >
            🎨 Style
          </button>
          
          {showStylePanel && (
            <div className="style-panel">
              <div className="style-row">
                <label>Color:</label>
                <div className="color-picker">
                  <input
                    type="color"
                    value={annotationStyle.strokeColor}
                    onChange={(e) => onStyleChange({ strokeColor: e.target.value })}
                    className="color-input"
                  />
                  <div className="color-presets">
                    {colorPresets.map(color => (
                      <button
                        key={color}
                        className="color-preset"
                        style={{ backgroundColor: color }}
                        onClick={() => onStyleChange({ strokeColor: color })}
                      />
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="style-row">
                <label>Fill:</label>
                <input
                  type="color"
                  value={annotationStyle.fillColor}
                  onChange={(e) => onStyleChange({ fillColor: e.target.value })}
                  className="color-input"
                />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={annotationStyle.fillOpacity}
                  onChange={(e) => onStyleChange({ fillOpacity: parseFloat(e.target.value) })}
                  className="opacity-slider"
                />
              </div>
              
              <div className="style-row">
                <label>Stroke Width:</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={annotationStyle.strokeWidth}
                  onChange={(e) => onStyleChange({ strokeWidth: parseInt(e.target.value) })}
                  className="width-slider"
                />
                <span className="width-value">{annotationStyle.strokeWidth}px</span>
              </div>
              
              <div className="style-row">
                <label>Line Style:</label>
                <select
                  value={annotationStyle.lineDash || 'solid'}
                  onChange={(e) => onStyleChange({ 
                    lineDash: e.target.value === 'solid' ? undefined : e.target.value.split(',').map(Number)
                  })}
                  className="line-style-select"
                >
                  <option value="solid">Solid</option>
                  <option value="5,5">Dashed</option>
                  <option value="2,3">Dotted</option>
                  <option value="10,5,2,5">Dash-Dot</option>
                </select>
              </div>
              
              <div className="style-row">
                <label>Font Size:</label>
                <input
                  type="number"
                  min="8"
                  max="72"
                  value={annotationStyle.fontSize}
                  onChange={(e) => onStyleChange({ fontSize: parseInt(e.target.value) })}
                  className="font-size-input"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-section measurement-section">
        <div className="section-label">Measurement</div>
        <div className="measurement-controls">
          <button
            className={`measurement-btn ${showMeasurementPanel ? 'active' : ''}`}
            onClick={() => setShowMeasurementPanel(!showMeasurementPanel)}
            title="Measurement settings"
          >
            📐 {measurementUnit}
          </button>
          
          {showMeasurementPanel && (
            <div className="measurement-panel">
              <div className="measurement-row">
                <label>Unit:</label>
                <select
                  value={measurementUnit}
                  onChange={(e) => onMeasurementUnitChange(e.target.value as MeasurementUnit)}
                  className="unit-select"
                >
                  <option value="ft">Feet</option>
                  <option value="in">Inches</option>
                  <option value="m">Meters</option>
                  <option value="cm">Centimeters</option>
                  <option value="mm">Millimeters</option>
                  <option value="px">Pixels</option>
                </select>
              </div>
              
              <div className="measurement-row">
                <label>Scale:</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="1.0"
                  className="scale-input"
                />
                <span className="scale-unit">units/px</span>
              </div>
              
              <div className="measurement-row">
                <label>Precision:</label>
                <select className="precision-select">
                  <option value="0">0 decimal places</option>
                  <option value="1">1 decimal place</option>
                  <option value="2">2 decimal places</option>
                  <option value="3">3 decimal places</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-section actions-section">
        <div className="section-label">Actions</div>
        <div className="action-controls">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="action-btn"
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="action-btn"
            title="Redo (Ctrl+Y)"
          >
            ↷ Redo
          </button>
          
          <button
            onClick={onClear}
            className="action-btn clear-btn"
            title="Clear all annotations"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      <div className="toolbar-section file-section">
        <div className="section-label">File</div>
        <div className="file-controls">
          <button onClick={onSave} className="file-btn save-btn" title="Save annotations">
            💾 Save
          </button>
          
          <button onClick={onLoad} className="file-btn load-btn" title="Load annotations">
            📁 Load
          </button>
        </div>
      </div>

      {isCollaborative && (
        <div className="toolbar-section collaboration-section">
          <div className="section-label">Collaboration</div>
          <div className="collaborators-list">
            {collaborators.map(collaborator => (
              <div
                key={collaborator.id}
                className={`collaborator ${collaborator.isActive ? 'active' : 'inactive'}`}
                title={`${collaborator.name} ${collaborator.isActive ? '(online)' : '(offline)'}`}
              >
                <div
                  className="collaborator-indicator"
                  style={{ backgroundColor: collaborator.color }}
                />
                <span className="collaborator-name">{collaborator.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="toolbar-section presets-section">
        <div className="section-label">Presets</div>
        <div className="preset-controls">
          <button
            onClick={() => onStyleChange({
              strokeColor: '#FF0000',
              strokeWidth: 3,
              fontSize: 14
            })}
            className="preset-btn"
            title="Red markup preset"
          >
            🔴 Red
          </button>
          
          <button
            onClick={() => onStyleChange({
              strokeColor: '#00FF00',
              strokeWidth: 2,
              fontSize: 12
            })}
            className="preset-btn"
            title="Green approval preset"
          >
            🟢 Approved
          </button>
          
          <button
            onClick={() => onStyleChange({
              strokeColor: '#FFA500',
              strokeWidth: 2,
              fontSize: 12,
              fillColor: '#FFFF00',
              fillOpacity: 0.3
            })}
            className="preset-btn"
            title="Yellow highlight preset"
          >
            🟡 Highlight
          </button>
          
          <button
            onClick={() => onStyleChange({
              strokeColor: '#0000FF',
              strokeWidth: 1,
              fontSize: 10
            })}
            className="preset-btn"
            title="Blue notes preset"
          >
            🔵 Notes
          </button>
        </div>
      </div>
    </div>
  );
};