import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Plus,
  Trash2,
  Copy,
  Download,
  Upload,
  Search,
  Filter,
  MoreVertical,
  Star,
  Clock,
  User,
  Shield
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Alert, AlertDescription } from '../ui/Alert';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/Popover';
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

interface DetectionProfileManagerProps {
  profiles: DetectionProfile[];
  currentProfileId?: string;
  onProfileSelect?: (profile: DetectionProfile) => void;
  onProfileCreate?: () => void;
  onProfileEdit?: (profile: DetectionProfile) => void;
  onProfileDuplicate?: (profile: DetectionProfile) => void;
  onProfileDelete?: (profileId: string) => void;
  onProfileImport?: (profileData: any) => void;
  onProfileExport?: (profile: DetectionProfile) => void;
  onSetDefault?: (profileId: string) => void;
  className?: string;
}

export const DetectionProfileManager: React.FC<DetectionProfileManagerProps> = ({
  profiles,
  currentProfileId,
  onProfileSelect,
  onProfileCreate,
  onProfileEdit,
  onProfileDuplicate,
  onProfileDelete,
  onProfileImport,
  onProfileExport,
  onSetDefault,
  className
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCadSystem, setFilterCadSystem] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all'); // all, system, custom
  const [sortBy, setSortBy] = useState<'name' | 'modified' | 'usage'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);

  // Filter and sort profiles
  const filteredAndSortedProfiles = profiles
    .filter(profile => {
      const matchesSearch = profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           profile.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCadSystem = filterCadSystem === 'all' || profile.cadSystem === filterCadSystem;
      
      const matchesType = filterType === 'all' ||
                         (filterType === 'system' && profile.isSystemPreset) ||
                         (filterType === 'custom' && !profile.isSystemPreset);
      
      return matchesSearch && matchesCadSystem && matchesType;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'modified':
          comparison = new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
          break;
        case 'usage':
          comparison = (b.usageCount || 0) - (a.usageCount || 0);
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  const handleProfileClick = (profile: DetectionProfile) => {
    onProfileSelect?.(profile);
  };

  const handleProfileAction = (action: string, profile: DetectionProfile, event?: React.MouseEvent) => {
    event?.stopPropagation();
    
    switch (action) {
      case 'edit':
        onProfileEdit?.(profile);
        break;
      case 'duplicate':
        onProfileDuplicate?.(profile);
        break;
      case 'delete':
        setShowConfirmDelete(profile.id);
        break;
      case 'export':
        onProfileExport?.(profile);
        break;
      case 'setDefault':
        onSetDefault?.(profile.id);
        break;
    }
  };

  const handleDeleteConfirm = () => {
    if (showConfirmDelete) {
      onProfileDelete?.(showConfirmDelete);
      setShowConfirmDelete(null);
    }
  };

  const handleBulkAction = (action: string) => {
    switch (action) {
      case 'delete':
        selectedProfiles.forEach(profileId => {
          const profile = profiles.find(p => p.id === profileId);
          if (profile && !profile.isSystemPreset) {
            onProfileDelete?.(profileId);
          }
        });
        setSelectedProfiles([]);
        break;
      case 'export':
        selectedProfiles.forEach(profileId => {
          const profile = profiles.find(p => p.id === profileId);
          if (profile) {
            onProfileExport?.(profile);
          }
        });
        break;
    }
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        onProfileImport?.(data);
      } catch (error) {
        console.error('Failed to import profile:', error);
      }
    };
    reader.readAsText(file);
  };

  const getCadSystemColor = (system: string) => {
    switch (system) {
      case 'autocad': return 'bg-blue-100 text-blue-800';
      case 'microstation': return 'bg-green-100 text-green-800';
      case 'solidworks': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const cadSystems = ['all', ...new Set(profiles.map(p => p.cadSystem))];

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Detection Profile Manager</span>
              <Badge variant="outline">{profiles.length} profiles</Badge>
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={onProfileCreate}>
                <Plus className="h-4 w-4 mr-2" />
                New Profile
              </Button>
              
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters and Search */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search profiles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* CAD System Filter */}
            <select
              value={filterCadSystem}
              onChange={(e) => setFilterCadSystem(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {cadSystems.map(system => (
                <option key={system} value={system}>
                  {system === 'all' ? 'All CAD Systems' : system.toUpperCase()}
                </option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="system">System Presets</option>
              <option value="custom">Custom Profiles</option>
            </select>

            {/* Sort Options */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sort, order] = e.target.value.split('-');
                setSortBy(sort as 'name' | 'modified' | 'usage');
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="modified-desc">Recently Modified</option>
              <option value="modified-asc">Oldest Modified</option>
              <option value="usage-desc">Most Used</option>
              <option value="usage-asc">Least Used</option>
            </select>
          </div>

          {/* Bulk Actions */}
          {selectedProfiles.length > 0 && (
            <div className="flex items-center space-x-2 mb-4 p-2 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-700">
                {selectedProfiles.length} profile(s) selected
              </span>
              <Button variant="outline" size="sm" onClick={() => handleBulkAction('export')}>
                <Download className="h-4 w-4 mr-1" />
                Export All
              </Button>
              <Button variant="destructive" size="sm" onClick={() => handleBulkAction('delete')}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete All
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedProfiles([])}>
                Clear Selection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSortedProfiles.map(profile => (
          <Card
            key={profile.id}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              currentProfileId === profile.id && 'ring-2 ring-blue-500 bg-blue-50',
              selectedProfiles.includes(profile.id) && 'ring-2 ring-green-500'
            )}
            onClick={() => handleProfileClick(profile)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedProfiles.includes(profile.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (e.target.checked) {
                        setSelectedProfiles(prev => [...prev, profile.id]);
                      } else {
                        setSelectedProfiles(prev => prev.filter(id => id !== profile.id));
                      }
                    }}
                    className="rounded"
                  />
                  
                  {profile.isDefault && (
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                  )}
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => e.stopPropagation()}
                      className="h-8 w-8 p-0"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48" align="end">
                    <div className="space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={(e) => handleProfileAction('edit', profile, e)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Edit Profile
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={(e) => handleProfileAction('duplicate', profile, e)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={(e) => handleProfileAction('export', profile, e)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>

                      {!profile.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={(e) => handleProfileAction('setDefault', profile, e)}
                        >
                          <Star className="h-4 w-4 mr-2" />
                          Set as Default
                        </Button>
                      )}

                      {!profile.isSystemPreset && (
                        <>
                          <div className="border-t my-1" />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-red-600 hover:text-red-700"
                            onClick={(e) => handleProfileAction('delete', profile, e)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <h3 className="font-semibold text-lg leading-tight">{profile.name}</h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{profile.description}</p>
              </div>

              <div className="flex items-center space-x-2 mt-2">
                <Badge className={cn('text-xs', getCadSystemColor(profile.cadSystem))}>
                  {profile.cadSystem.toUpperCase()}
                </Badge>
                
                {profile.isSystemPreset && (
                  <Badge variant="outline" className="text-xs">
                    <Shield className="h-3 w-3 mr-1" />
                    System
                  </Badge>
                )}
                
                {profile.isDefault && (
                  <Badge variant="outline" className="text-xs text-yellow-600">
                    <Star className="h-3 w-3 mr-1" />
                    Default
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {/* Configuration Summary */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="text-center p-2 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600">Sensitivity</div>
                  <div className="font-semibold">{Math.round(profile.sensitivity * 100)}%</div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600">Confidence</div>
                  <div className="font-semibold">{Math.round(profile.confidenceThreshold * 100)}%</div>
                </div>
              </div>

              {/* Metadata */}
              <div className="space-y-1 text-xs text-gray-500">
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>Modified {new Date(profile.lastModified).toLocaleDateString()}</span>
                </div>
                
                {profile.createdBy && (
                  <div className="flex items-center space-x-1">
                    <User className="h-3 w-3" />
                    <span>Created by {profile.createdBy}</span>
                  </div>
                )}
                
                {profile.usageCount !== undefined && (
                  <div className="flex items-center space-x-1">
                    <span>Used {profile.usageCount} times</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {profile.tags && profile.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {profile.tags.slice(0, 3).map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {profile.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{profile.tags.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No Results */}
      {filteredAndSortedProfiles.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No profiles found</h3>
            <p className="text-gray-600 mb-4">
              {profiles.length === 0 
                ? "No detection profiles have been created yet."
                : "Try adjusting your search criteria or filters."
              }
            </p>
            <Button onClick={onProfileCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Profile
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Delete Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete this detection profile? This action cannot be undone.
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="destructive"
                  onClick={handleDeleteConfirm}
                >
                  Delete Profile
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmDelete(null)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};