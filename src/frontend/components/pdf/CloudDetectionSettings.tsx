import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Copy,
  Download,
  Upload,
  Eye,
  Sliders,
  Monitor,
  Palette,
  Target,
  Layers
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Slider } from '../ui/Slider';
import { Switch } from '../ui/Switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Separator } from '../ui/Separator';
import { Alert, AlertDescription } from '../ui/Alert';
import { cn } from '../../lib/utils';

interface DetectionProfile {
  id: string;
  name: string;
  description: string;
  cadSystem: 'autocad' | 'microstation' | 'solidworks' | 'generic';
  sensitivity: number;
  confidenceThreshold: number;
  colorThresholds: {
    red: number;
    green: number;
    blue: number;
    alpha: number;
  };
  shapeParameters: {
    minArea: number;
    maxArea: number;
    aspectRatioTolerance: number;
    edgeSmoothing: number;
  };
  textureFilters: {
    gaussianBlur: number;
    contrastEnhancement: number;
    edgeDetection: boolean;
    noiseReduction: number;
  };
  visualizationMode: 'standard' | 'heatmap' | 'outline' | 'contour' | 'pattern_specific';
  isDefault: boolean;
  isSystemPreset: boolean;
  createdBy?: string;
  lastModified: string;
}

interface CloudDetectionSettingsProps {
  currentProfile?: DetectionProfile;
  onProfileChange?: (profile: DetectionProfile) => void;
  onSave?: (profile: DetectionProfile) => Promise<void>;
  onTest?: (profile: DetectionProfile) => Promise<void>;
  readOnly?: boolean;
  className?: string;
}

const DEFAULT_PROFILES: DetectionProfile[] = [
  {
    id: 'autocad-standard',
    name: 'AutoCAD Standard',
    description: 'Optimized for AutoCAD electrical drawings with standard cloud patterns',
    cadSystem: 'autocad',
    sensitivity: 0.75,
    confidenceThreshold: 0.6,
    colorThresholds: { red: 0.8, green: 0.3, blue: 0.3, alpha: 0.7 },
    shapeParameters: { minArea: 150, maxArea: 25000, aspectRatioTolerance: 0.3, edgeSmoothing: 2 },
    textureFilters: { gaussianBlur: 1.5, contrastEnhancement: 1.2, edgeDetection: true, noiseReduction: 0.8 },
    visualizationMode: 'standard',
    isDefault: true,
    isSystemPreset: true,
    lastModified: new Date().toISOString()
  },
  {
    id: 'microstation-standard',
    name: 'MicroStation Standard',
    description: 'Optimized for MicroStation drawings with typical revision clouds',
    cadSystem: 'microstation',
    sensitivity: 0.7,
    confidenceThreshold: 0.65,
    colorThresholds: { red: 0.9, green: 0.2, blue: 0.2, alpha: 0.8 },
    shapeParameters: { minArea: 200, maxArea: 30000, aspectRatioTolerance: 0.4, edgeSmoothing: 1.8 },
    textureFilters: { gaussianBlur: 1.2, contrastEnhancement: 1.3, edgeDetection: true, noiseReduction: 0.7 },
    visualizationMode: 'outline',
    isDefault: false,
    isSystemPreset: true,
    lastModified: new Date().toISOString()
  },
  {
    id: 'solidworks-standard',
    name: 'SolidWorks Standard',
    description: 'Configured for SolidWorks electrical schematics and cloud annotations',
    cadSystem: 'solidworks',
    sensitivity: 0.8,
    confidenceThreshold: 0.7,
    colorThresholds: { red: 0.7, green: 0.4, blue: 0.4, alpha: 0.6 },
    shapeParameters: { minArea: 100, maxArea: 20000, aspectRatioTolerance: 0.5, edgeSmoothing: 2.2 },
    textureFilters: { gaussianBlur: 1.8, contrastEnhancement: 1.1, edgeDetection: false, noiseReduction: 0.9 },
    visualizationMode: 'pattern_specific',
    isDefault: false,
    isSystemPreset: true,
    lastModified: new Date().toISOString()
  },
  {
    id: 'generic-high-sensitivity',
    name: 'Generic High Sensitivity',
    description: 'High sensitivity preset for detecting faint or partially visible clouds',
    cadSystem: 'generic',
    sensitivity: 0.9,
    confidenceThreshold: 0.4,
    colorThresholds: { red: 0.6, green: 0.6, blue: 0.6, alpha: 0.5 },
    shapeParameters: { minArea: 80, maxArea: 40000, aspectRatioTolerance: 0.6, edgeSmoothing: 3 },
    textureFilters: { gaussianBlur: 2.0, contrastEnhancement: 1.4, edgeDetection: true, noiseReduction: 1.2 },
    visualizationMode: 'heatmap',
    isDefault: false,
    isSystemPreset: true,
    lastModified: new Date().toISOString()
  }
];

export const CloudDetectionSettings: React.FC<CloudDetectionSettingsProps> = ({
  currentProfile,
  onProfileChange,
  onSave,
  onTest,
  readOnly = false,
  className
}) => {
  const [profiles, setProfiles] = useState<DetectionProfile[]>(DEFAULT_PROFILES);
  const [selectedProfile, setSelectedProfile] = useState<DetectionProfile>(
    currentProfile || DEFAULT_PROFILES[0]
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editingProfile, setEditingProfile] = useState<DetectionProfile>(selectedProfile);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentProfile) {
      setSelectedProfile(currentProfile);
      setEditingProfile(currentProfile);
    }
  }, [currentProfile]);

  useEffect(() => {
    const hasChanges = JSON.stringify(editingProfile) !== JSON.stringify(selectedProfile);
    setHasUnsavedChanges(hasChanges);
  }, [editingProfile, selectedProfile]);

  const handleProfileSelect = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      setSelectedProfile(profile);
      setEditingProfile({ ...profile });
      setIsEditing(false);
      onProfileChange?.(profile);
    }
  };

  const handleParameterChange = (section: keyof DetectionProfile, key: string, value: any) => {
    setEditingProfile(prev => {
      if (typeof prev[section] === 'object' && prev[section] !== null) {
        return {
          ...prev,
          [section]: {
            ...prev[section] as any,
            [key]: value
          }
        };
      } else {
        return {
          ...prev,
          [section]: value
        };
      }
    });
  };

  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const profileToSave = {
        ...editingProfile,
        lastModified: new Date().toISOString()
      };

      await onSave(profileToSave);
      
      // Update local state
      setSelectedProfile(profileToSave);
      setProfiles(prev => {
        const index = prev.findIndex(p => p.id === profileToSave.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = profileToSave;
          return updated;
        } else {
          return [...prev, profileToSave];
        }
      });

      setHasUnsavedChanges(false);
      setIsEditing(false);
      setSaveMessage('Profile saved successfully');
      
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);

    } catch (error) {
      setSaveMessage(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!onTest) return;

    setIsTesting(true);
    try {
      await onTest(editingProfile);
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const handleReset = () => {
    setEditingProfile({ ...selectedProfile });
    setHasUnsavedChanges(false);
  };

  const handleCreateNew = () => {
    const newProfile: DetectionProfile = {
      id: `custom-${Date.now()}`,
      name: 'Custom Profile',
      description: 'Custom detection configuration',
      cadSystem: 'generic',
      sensitivity: 0.7,
      confidenceThreshold: 0.6,
      colorThresholds: { red: 0.8, green: 0.3, blue: 0.3, alpha: 0.7 },
      shapeParameters: { minArea: 150, maxArea: 25000, aspectRatioTolerance: 0.3, edgeSmoothing: 2 },
      textureFilters: { gaussianBlur: 1.5, contrastEnhancement: 1.2, edgeDetection: true, noiseReduction: 0.8 },
      visualizationMode: 'standard',
      isDefault: false,
      isSystemPreset: false,
      lastModified: new Date().toISOString()
    };

    setEditingProfile(newProfile);
    setIsEditing(true);
  };

  const handleDuplicate = () => {
    const duplicatedProfile: DetectionProfile = {
      ...editingProfile,
      id: `${editingProfile.id}-copy-${Date.now()}`,
      name: `${editingProfile.name} (Copy)`,
      isDefault: false,
      isSystemPreset: false,
      lastModified: new Date().toISOString()
    };

    setEditingProfile(duplicatedProfile);
    setIsEditing(true);
  };

  const handleDelete = () => {
    if (editingProfile.isSystemPreset) return;
    
    setProfiles(prev => prev.filter(p => p.id !== editingProfile.id));
    
    // Switch to default profile
    const defaultProfile = profiles.find(p => p.isDefault) || profiles[0];
    setSelectedProfile(defaultProfile);
    setEditingProfile({ ...defaultProfile });
    setIsEditing(false);
  };

  const exportProfile = () => {
    const exportData = {
      profile: editingProfile,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloud-detection-profile-${editingProfile.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getCadSystemColor = (system: string) => {
    switch (system) {
      case 'autocad': return 'bg-blue-100 text-blue-800';
      case 'microstation': return 'bg-green-100 text-green-800';
      case 'solidworks': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Detection Configuration</span>
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-amber-600">
                  Unsaved Changes
                </Badge>
              )}
              
              {!readOnly && (
                <>
                  <Button variant="outline" size="sm" onClick={handleCreateNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Profile
                  </Button>
                  
                  <Button variant="outline" size="sm" onClick={exportProfile}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Profile Selection */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Configuration Profile</label>
              <Select value={selectedProfile.id} onValueChange={handleProfileSelect}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map(profile => (
                    <SelectItem key={profile.id} value={profile.id}>
                      <div className="flex items-center space-x-2">
                        <span>{profile.name}</span>
                        <Badge className={cn('text-xs', getCadSystemColor(profile.cadSystem))}>
                          {profile.cadSystem.toUpperCase()}
                        </Badge>
                        {profile.isDefault && (
                          <Badge variant="outline" className="text-xs">Default</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Profile Info */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{editingProfile.name}</h4>
                <div className="flex items-center space-x-2">
                  <Badge className={getCadSystemColor(editingProfile.cadSystem)}>
                    {editingProfile.cadSystem.toUpperCase()}
                  </Badge>
                  {editingProfile.isSystemPreset && (
                    <Badge variant="outline" className="text-xs">System Preset</Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600">{editingProfile.description}</p>
              <p className="text-xs text-gray-500 mt-1">
                Last modified: {new Date(editingProfile.lastModified).toLocaleString()}
              </p>
            </div>

            {/* Action Buttons */}
            {!readOnly && (
              <div className="flex items-center space-x-2">
                <Button
                  variant={isEditing ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {isEditing ? 'Editing' : 'Edit Profile'}
                </Button>

                <Button variant="outline" size="sm" onClick={handleDuplicate}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </Button>

                {!editingProfile.isSystemPreset && (
                  <Button variant="destructive" size="sm" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}

                {hasUnsavedChanges && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset
                    </Button>

                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Profile
                        </>
                      )}
                    </Button>
                  </>
                )}

                {onTest && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleTest}
                    disabled={isTesting}
                  >
                    {isTesting ? 'Testing...' : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Test Configuration
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Message */}
      {saveMessage && (
        <Alert variant={saveMessage.includes('Failed') ? 'destructive' : 'default'}>
          <AlertDescription>{saveMessage}</AlertDescription>
        </Alert>
      )}

      {/* Configuration Parameters */}
      {isEditing && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Sliders className="h-4 w-4" />
                <span>Basic Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Profile Name */}
              <div>
                <label className="text-sm font-medium mb-2 block">Profile Name</label>
                <input
                  type="text"
                  value={editingProfile.name}
                  onChange={(e) => handleParameterChange('name', '', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="Enter profile name"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <textarea
                  value={editingProfile.description}
                  onChange={(e) => handleParameterChange('description', '', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  rows={2}
                  placeholder="Enter profile description"
                />
              </div>

              {/* CAD System */}
              <div>
                <label className="text-sm font-medium mb-2 block">CAD System</label>
                <Select 
                  value={editingProfile.cadSystem} 
                  onValueChange={(value) => handleParameterChange('cadSystem', '', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="autocad">AutoCAD</SelectItem>
                    <SelectItem value="microstation">MicroStation</SelectItem>
                    <SelectItem value="solidworks">SolidWorks</SelectItem>
                    <SelectItem value="generic">Generic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Detection Sensitivity */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Detection Sensitivity: {Math.round(editingProfile.sensitivity * 100)}%
                </label>
                <Slider
                  value={[editingProfile.sensitivity]}
                  onValueChange={([value]) => handleParameterChange('sensitivity', '', value)}
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Higher sensitivity detects more clouds but may include false positives
                </p>
              </div>

              {/* Confidence Threshold */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Confidence Threshold: {Math.round(editingProfile.confidenceThreshold * 100)}%
                </label>
                <Slider
                  value={[editingProfile.confidenceThreshold]}
                  onValueChange={([value]) => handleParameterChange('confidenceThreshold', '', value)}
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimum confidence required to report a cloud detection
                </p>
              </div>

              {/* Visualization Mode */}
              <div>
                <label className="text-sm font-medium mb-2 block">Visualization Mode</label>
                <Select 
                  value={editingProfile.visualizationMode} 
                  onValueChange={(value) => handleParameterChange('visualizationMode', '', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Overlay</SelectItem>
                    <SelectItem value="heatmap">Confidence Heatmap</SelectItem>
                    <SelectItem value="outline">Outline Only</SelectItem>
                    <SelectItem value="contour">Contour Detection</SelectItem>
                    <SelectItem value="pattern_specific">Pattern Specific</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Settings */}
          <div className="space-y-6">
            {/* Color Thresholds */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Palette className="h-4 w-4" />
                  <span>Color Detection</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(editingProfile.colorThresholds).map(([key, value]) => (
                  <div key={key}>
                    <label className="text-sm font-medium mb-1 block capitalize">
                      {key} Threshold: {Math.round(value * 100)}%
                    </label>
                    <Slider
                      value={[value]}
                      onValueChange={([newValue]) => handleParameterChange('colorThresholds', key, newValue)}
                      min={0}
                      max={1}
                      step={0.05}
                      className="w-full"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Shape Parameters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-4 w-4" />
                  <span>Shape Detection</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Minimum Area: {editingProfile.shapeParameters.minArea} pixels
                  </label>
                  <Slider
                    value={[editingProfile.shapeParameters.minArea]}
                    onValueChange={([value]) => handleParameterChange('shapeParameters', 'minArea', value)}
                    min={50}
                    max={1000}
                    step={10}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Maximum Area: {editingProfile.shapeParameters.maxArea} pixels
                  </label>
                  <Slider
                    value={[editingProfile.shapeParameters.maxArea]}
                    onValueChange={([value]) => handleParameterChange('shapeParameters', 'maxArea', value)}
                    min={5000}
                    max={100000}
                    step={1000}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Aspect Ratio Tolerance: {editingProfile.shapeParameters.aspectRatioTolerance.toFixed(1)}
                  </label>
                  <Slider
                    value={[editingProfile.shapeParameters.aspectRatioTolerance]}
                    onValueChange={([value]) => handleParameterChange('shapeParameters', 'aspectRatioTolerance', value)}
                    min={0.1}
                    max={1.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Edge Smoothing: {editingProfile.shapeParameters.edgeSmoothing.toFixed(1)}
                  </label>
                  <Slider
                    value={[editingProfile.shapeParameters.edgeSmoothing]}
                    onValueChange={([value]) => handleParameterChange('shapeParameters', 'edgeSmoothing', value)}
                    min={0.5}
                    max={5.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Texture Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Layers className="h-4 w-4" />
                  <span>Texture Analysis</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Gaussian Blur: {editingProfile.textureFilters.gaussianBlur.toFixed(1)}
                  </label>
                  <Slider
                    value={[editingProfile.textureFilters.gaussianBlur]}
                    onValueChange={([value]) => handleParameterChange('textureFilters', 'gaussianBlur', value)}
                    min={0.5}
                    max={3.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Contrast Enhancement: {editingProfile.textureFilters.contrastEnhancement.toFixed(1)}
                  </label>
                  <Slider
                    value={[editingProfile.textureFilters.contrastEnhancement]}
                    onValueChange={([value]) => handleParameterChange('textureFilters', 'contrastEnhancement', value)}
                    min={0.8}
                    max={2.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Noise Reduction: {editingProfile.textureFilters.noiseReduction.toFixed(1)}
                  </label>
                  <Slider
                    value={[editingProfile.textureFilters.noiseReduction]}
                    onValueChange={([value]) => handleParameterChange('textureFilters', 'noiseReduction', value)}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={editingProfile.textureFilters.edgeDetection}
                    onCheckedChange={(checked) => handleParameterChange('textureFilters', 'edgeDetection', checked)}
                  />
                  <label className="text-sm">Enable Edge Detection</label>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Preview/Summary when not editing */}
      {!isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-600 font-medium">Sensitivity</div>
                <div className="text-lg font-bold text-blue-900">
                  {Math.round(editingProfile.sensitivity * 100)}%
                </div>
              </div>
              
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-sm text-green-600 font-medium">Confidence</div>
                <div className="text-lg font-bold text-green-900">
                  {Math.round(editingProfile.confidenceThreshold * 100)}%
                </div>
              </div>
              
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="text-sm text-purple-600 font-medium">CAD System</div>
                <div className="text-lg font-bold text-purple-900 capitalize">
                  {editingProfile.cadSystem}
                </div>
              </div>
              
              <div className="p-3 bg-amber-50 rounded-lg">
                <div className="text-sm text-amber-600 font-medium">Visualization</div>
                <div className="text-lg font-bold text-amber-900 capitalize">
                  {editingProfile.visualizationMode.replace('_', ' ')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};