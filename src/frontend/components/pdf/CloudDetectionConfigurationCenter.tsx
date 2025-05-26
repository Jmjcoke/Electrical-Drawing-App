import React, { useState, useEffect } from 'react';
import {
  Settings,
  Monitor,
  Sliders,
  Users,
  Save,
  Upload,
  Download,
  RotateCcw,
  Star,
  Zap
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Alert, AlertDescription } from '../ui/Alert';
import { CloudDetectionSettings } from './CloudDetectionSettings';
import { DetectionProfileManager } from './DetectionProfileManager';
import { CADSystemPresets } from './CADSystemPresets';
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
  usageCount?: number;
  tags?: string[];
}

interface CloudDetectionConfigurationCenterProps {
  projectId?: string;
  drawingId?: string;
  currentProfile?: DetectionProfile;
  onConfigurationChange?: (profile: DetectionProfile) => void;
  onConfigurationApply?: (profile: DetectionProfile) => Promise<void>;
  onConfigurationTest?: (profile: DetectionProfile) => Promise<void>;
  className?: string;
}

type ConfigTab = 'profiles' | 'presets' | 'settings' | 'team';

export const CloudDetectionConfigurationCenter: React.FC<CloudDetectionConfigurationCenterProps> = ({
  projectId,
  drawingId,
  currentProfile,
  onConfigurationChange,
  onConfigurationApply,
  onConfigurationTest,
  className
}) => {
  const [activeTab, setActiveTab] = useState<ConfigTab>('profiles');
  const [profiles, setProfiles] = useState<DetectionProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<DetectionProfile | undefined>(currentProfile);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load profiles on mount
  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/ai/detection-profiles', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load detection profiles');
      }

      const data = await response.json();
      setProfiles(data.data.profiles || []);
      
      // Set default profile if none selected
      if (!selectedProfile && data.data.profiles.length > 0) {
        const defaultProfile = data.data.profiles.find((p: DetectionProfile) => p.isDefault) || data.data.profiles[0];
        setSelectedProfile(defaultProfile);
        onConfigurationChange?.(defaultProfile);
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load profiles');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSave = async (profile: DetectionProfile) => {
    setIsLoading(true);
    setError(null);

    try {
      const isNewProfile = !profiles.find(p => p.id === profile.id);
      const endpoint = isNewProfile 
        ? '/api/v1/ai/detection-profiles'
        : `/api/v1/ai/detection-profiles/${profile.id}`;
      
      const method = isNewProfile ? 'POST' : 'PUT';
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ 
          profile: isNewProfile ? profile : undefined,
          profileId: !isNewProfile ? profile.id : undefined,
          profile: profile 
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save profile');
      }

      // Reload profiles to get updated list
      await loadProfiles();
      setHasUnsavedChanges(false);

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save profile');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileDelete = async (profileId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/ai/detection-profiles/${profileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete profile');
      }

      // Reload profiles
      await loadProfiles();

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileApply = async (profile: DetectionProfile) => {
    if (!drawingId) {
      setError('No drawing selected for profile application');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/ai/detection-profiles/${profile.id}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ drawing_id: drawingId })
      });

      if (!response.ok) {
        throw new Error('Failed to apply profile');
      }

      setSelectedProfile(profile);
      onConfigurationChange?.(profile);
      
      if (onConfigurationApply) {
        await onConfigurationApply(profile);
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to apply profile');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresetSelect = (preset: any) => {
    // Convert preset to profile format
    const profile: DetectionProfile = {
      id: `preset-${preset.id}`,
      name: preset.name,
      description: preset.description,
      cadSystem: preset.cadSystem,
      sensitivity: preset.configuration.sensitivity,
      confidenceThreshold: preset.configuration.confidenceThreshold,
      colorThresholds: preset.configuration.colorThresholds,
      shapeParameters: preset.configuration.shapeParameters,
      textureFilters: preset.configuration.textureFilters,
      visualizationMode: preset.configuration.visualizationMode,
      isDefault: false,
      isSystemPreset: true,
      lastModified: new Date().toISOString()
    };

    setSelectedProfile(profile);
    onConfigurationChange?.(profile);
    setHasUnsavedChanges(true);
  };

  const handleConfigurationTest = async () => {
    if (!selectedProfile) return;

    try {
      if (onConfigurationTest) {
        await onConfigurationTest(selectedProfile);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Test failed');
    }
  };

  const tabs = [
    { id: 'profiles' as ConfigTab, label: 'Profile Manager', icon: <Users className="h-4 w-4" /> },
    { id: 'presets' as ConfigTab, label: 'CAD Presets', icon: <Monitor className="h-4 w-4" /> },
    { id: 'settings' as ConfigTab, label: 'Advanced Settings', icon: <Sliders className="h-4 w-4" /> },
  ];

  const stats = {
    totalProfiles: profiles.length,
    customProfiles: profiles.filter(p => !p.isSystemPreset).length,
    systemPresets: profiles.filter(p => p.isSystemPreset).length,
    currentProfileAccuracy: selectedProfile ? Math.round((selectedProfile.sensitivity + selectedProfile.confidenceThreshold) * 50) : 0
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Cloud Detection Configuration Center</span>
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Manage detection profiles, CAD system presets, and advanced settings
              </p>
            </div>

            <div className="flex items-center space-x-4">
              {/* Statistics */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 bg-blue-50 rounded">
                  <div className="text-lg font-bold text-blue-900">{stats.totalProfiles}</div>
                  <div className="text-xs text-blue-600">Total Profiles</div>
                </div>
                <div className="p-2 bg-green-50 rounded">
                  <div className="text-lg font-bold text-green-900">{stats.currentProfileAccuracy}%</div>
                  <div className="text-xs text-green-600">Current Accuracy</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                {hasUnsavedChanges && (
                  <Badge variant="outline" className="text-amber-600">
                    Unsaved Changes
                  </Badge>
                )}

                {selectedProfile && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleConfigurationTest}
                      disabled={isLoading}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Test Config
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => selectedProfile && handleProfileApply(selectedProfile)}
                      disabled={isLoading || !drawingId}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Apply Config
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Current Profile Info */}
      {selectedProfile && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Settings className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">{selectedProfile.name}</h3>
                  <p className="text-sm text-gray-600">{selectedProfile.description}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant="outline">{selectedProfile.cadSystem.toUpperCase()}</Badge>
                    {selectedProfile.isDefault && (
                      <Badge variant="outline" className="text-yellow-600">
                        <Star className="h-3 w-3 mr-1" />
                        Default
                      </Badge>
                    )}
                    {selectedProfile.isSystemPreset && (
                      <Badge variant="outline">System Preset</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-sm text-gray-600">Sensitivity</div>
                  <div className="font-semibold">{Math.round(selectedProfile.sensitivity * 100)}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Confidence</div>
                  <div className="font-semibold">{Math.round(selectedProfile.confidenceThreshold * 100)}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Mode</div>
                  <div className="font-semibold capitalize">{selectedProfile.visualizationMode}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab Navigation */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex space-x-1 border-b">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {isLoading && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading configuration...</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && activeTab === 'profiles' && (
          <DetectionProfileManager
            profiles={profiles}
            currentProfileId={selectedProfile?.id}
            onProfileSelect={setSelectedProfile}
            onProfileCreate={() => {
              // Create new profile logic
              const newProfile: DetectionProfile = {
                id: `custom-${Date.now()}`,
                name: 'New Custom Profile',
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
              setSelectedProfile(newProfile);
              setActiveTab('settings');
              setHasUnsavedChanges(true);
            }}
            onProfileEdit={(profile) => {
              setSelectedProfile(profile);
              setActiveTab('settings');
            }}
            onProfileDuplicate={(profile) => {
              const duplicated = {
                ...profile,
                id: `${profile.id}-copy-${Date.now()}`,
                name: `${profile.name} (Copy)`,
                isDefault: false,
                isSystemPreset: false,
                lastModified: new Date().toISOString()
              };
              setSelectedProfile(duplicated);
              setActiveTab('settings');
              setHasUnsavedChanges(true);
            }}
            onProfileDelete={handleProfileDelete}
            onProfileExport={(profile) => {
              const exportData = {
                profile,
                exportedAt: new Date().toISOString(),
                version: '1.0'
              };
              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${profile.name.toLowerCase().replace(/\s+/g, '-')}-profile.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            onSetDefault={(profileId) => {
              setProfiles(prev => prev.map(p => ({ ...p, isDefault: p.id === profileId })));
            }}
          />
        )}

        {!isLoading && activeTab === 'presets' && (
          <CADSystemPresets
            onPresetSelect={handlePresetSelect}
            onPresetApply={handleProfileApply}
            onPresetCustomize={(preset) => {
              handlePresetSelect(preset);
              setActiveTab('settings');
            }}
            selectedPresetId={selectedProfile?.id}
          />
        )}

        {!isLoading && activeTab === 'settings' && selectedProfile && (
          <CloudDetectionSettings
            currentProfile={selectedProfile}
            onProfileChange={(profile) => {
              setSelectedProfile(profile);
              onConfigurationChange?.(profile);
              setHasUnsavedChanges(true);
            }}
            onSave={handleProfileSave}
            onTest={onConfigurationTest}
          />
        )}
      </div>
    </div>
  );
};