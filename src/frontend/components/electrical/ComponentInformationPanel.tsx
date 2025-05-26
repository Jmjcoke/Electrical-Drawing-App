/**
 * Interactive Component Information Panel
 * 
 * Displays comprehensive electrical component specifications with interactive features
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Separator } from '@/components/ui/Separator';
import { Progress } from '@/components/ui/Progress';
import { 
  ZapIcon, 
  InfoIcon, 
  DownloadIcon, 
  ExternalLinkIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  SearchIcon,
  BookOpenIcon,
  ToolIcon,
  SparklesIcon
} from 'lucide-react';
import { ComponentSpecification } from '@/services/api/componentSpecifications';

interface ComponentInformationPanelProps {
  component: ComponentSpecification | null;
  isLoading?: boolean;
  onSpecificationUpdate?: (component: ComponentSpecification) => void;
  onCompatibilityCheck?: (componentId: string) => void;
  onDownloadDatasheet?: (url: string) => void;
  className?: string;
}

interface SpecificationGroup {
  title: string;
  icon: React.ReactNode;
  items: Array<{
    label: string;
    value: string | number | boolean;
    unit?: string;
    type?: 'text' | 'number' | 'boolean' | 'rating' | 'url';
    importance?: 'high' | 'medium' | 'low';
  }>;
}

const ComponentInformationPanel: React.FC<ComponentInformationPanelProps> = ({
  component,
  isLoading = false,
  onSpecificationUpdate,
  onCompatibilityCheck,
  onDownloadDatasheet,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'electrical' | 'physical' | 'compliance' | 'docs'>('overview');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const specificationGroups = useMemo((): SpecificationGroup[] => {
    if (!component) return [];

    return [
      {
        title: 'Overview',
        icon: <InfoIcon className="w-4 h-4" />,
        items: [
          { label: 'Part Number', value: component.part_number, type: 'text', importance: 'high' },
          { label: 'Model Number', value: component.model_number || 'N/A', type: 'text' },
          { label: 'Category', value: component.category, type: 'text', importance: 'high' },
          { label: 'Manufacturer', value: component.manufacturer.name, type: 'text', importance: 'high' },
          { label: 'Brand', value: component.manufacturer.brand || 'N/A', type: 'text' },
          { label: 'Verified', value: component.verified, type: 'boolean', importance: 'medium' },
          { label: 'Confidence Score', value: Math.round(component.confidence_score * 100), unit: '%', type: 'rating', importance: 'medium' }
        ]
      },
      {
        title: 'Electrical Ratings',
        icon: <ZapIcon className="w-4 h-4" />,
        items: [
          { label: 'Voltage Rating', value: component.electrical_ratings.voltage_rating || 'N/A', unit: 'V', type: 'number', importance: 'high' },
          { label: 'Current Rating', value: component.electrical_ratings.current_rating || 'N/A', unit: 'A', type: 'number', importance: 'high' },
          { label: 'Power Rating', value: component.electrical_ratings.power_rating || 'N/A', unit: 'W', type: 'number', importance: 'medium' },
          { label: 'Voltage Type', value: component.electrical_ratings.voltage_type || 'N/A', type: 'text', importance: 'medium' },
          { label: 'Frequency', value: component.electrical_ratings.frequency || 'N/A', unit: 'Hz', type: 'number', importance: 'medium' },
          { label: 'Phases', value: component.electrical_ratings.phases || 'N/A', type: 'number', importance: 'medium' },
          { label: 'Short Circuit Rating', value: component.electrical_ratings.short_circuit_rating || 'N/A', unit: 'A', type: 'number', importance: 'low' }
        ]
      },
      {
        title: 'Physical Dimensions',
        icon: <ToolIcon className="w-4 h-4" />,
        items: [
          { label: 'Length', value: component.dimensions.length || 'N/A', unit: 'in', type: 'number' },
          { label: 'Width', value: component.dimensions.width || 'N/A', unit: 'in', type: 'number' },
          { label: 'Height', value: component.dimensions.height || 'N/A', unit: 'in', type: 'number' },
          { label: 'Depth', value: component.dimensions.depth || 'N/A', unit: 'in', type: 'number' },
          { label: 'Weight', value: component.dimensions.weight || 'N/A', unit: 'lbs', type: 'number' },
          { label: 'Mounting Type', value: component.mounting_type || 'N/A', type: 'text', importance: 'medium' }
        ]
      },
      {
        title: 'Compliance & Standards',
        icon: <CheckCircleIcon className="w-4 h-4" />,
        items: [
          { label: 'UL Listed', value: component.compliance.ul_listed, type: 'boolean', importance: 'high' },
          { label: 'NEC Compliant', value: component.compliance.nec_compliant, type: 'boolean', importance: 'high' },
          { label: 'NEMA Rating', value: component.compliance.nema_rating || 'N/A', type: 'text', importance: 'medium' },
          { label: 'IP Rating', value: component.compliance.ip_rating || 'N/A', type: 'text', importance: 'medium' },
          { label: 'IEEE Standards', value: component.compliance.ieee_standards.join(', ') || 'N/A', type: 'text' },
          { label: 'IEC Standards', value: component.compliance.iec_standards.join(', ') || 'N/A', type: 'text' }
        ]
      }
    ];
  }, [component]);

  const renderSpecificationValue = (item: any) => {
    switch (item.type) {
      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            {item.value ? (
              <CheckCircleIcon className="w-4 h-4 text-green-500" />
            ) : (
              <XCircleIcon className="w-4 h-4 text-red-500" />
            )}
            <span>{item.value ? 'Yes' : 'No'}</span>
          </div>
        );
      case 'rating':
        return (
          <div className="flex items-center gap-2">
            <Progress value={item.value} className="w-16 h-2" />
            <span className="text-sm">{item.value}{item.unit}</span>
          </div>
        );
      case 'url':
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(item.value, '_blank')}
            className="p-0 h-auto text-blue-500 hover:text-blue-700"
          >
            <ExternalLinkIcon className="w-3 h-3 mr-1" />
            {item.value}
          </Button>
        );
      default:
        return (
          <span className={`
            ${item.importance === 'high' ? 'font-semibold text-gray-900' : ''}
            ${item.importance === 'medium' ? 'font-medium text-gray-700' : ''}
            ${item.importance === 'low' ? 'text-gray-600' : ''}
          `}>
            {item.value}{item.unit ? ` ${item.unit}` : ''}
          </span>
        );
    }
  };

  const renderSpecificationGroup = (group: SpecificationGroup) => {
    const sectionKey = group.title.toLowerCase().replace(/\s+/g, '-');
    const isExpanded = expandedSections.has(sectionKey);

    return (
      <Card key={group.title} className="mb-4">
        <CardHeader 
          className="cursor-pointer hover:bg-gray-50 transition-colors pb-3"
          onClick={() => toggleSection(sectionKey)}
        >
          <CardTitle className="flex items-center justify-between text-sm font-medium">
            <div className="flex items-center gap-2">
              {group.icon}
              {group.title}
            </div>
            <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
              {isExpanded ? '−' : '+'}
            </Button>
          </CardTitle>
        </CardHeader>
        
        {isExpanded && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-3">
              {group.items.map((item, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 font-medium">
                    {item.label}:
                  </span>
                  {renderSpecificationValue(item)}
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  const renderFeatures = () => {
    if (!component?.features.length) return null;

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <SparklesIcon className="w-4 h-4" />
            Key Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {component.features.map((feature, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {feature}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderApplications = () => {
    if (!component?.applications.length) return null;

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <ToolIcon className="w-4 h-4" />
            Applications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-1">
            {component.applications.map((application, index) => (
              <div key={index} className="text-sm text-gray-700 flex items-center gap-2">
                <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                {application}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderDocumentation = () => {
    const docs = [
      { label: 'Datasheet', url: component?.datasheet_url, icon: <BookOpenIcon className="w-4 h-4" /> },
      { label: 'Installation Guide', url: component?.installation_guide_url, icon: <ToolIcon className="w-4 h-4" /> },
      { label: 'User Manual', url: component?.manual_url, icon: <InfoIcon className="w-4 h-4" /> }
    ].filter(doc => doc.url);

    if (!docs.length && !component?.cad_files.length) return null;

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <BookOpenIcon className="w-4 h-4" />
            Documentation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2">
            {docs.map((doc, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (doc.url && onDownloadDatasheet) {
                    onDownloadDatasheet(doc.url);
                  } else if (doc.url) {
                    window.open(doc.url, '_blank');
                  }
                }}
                className="justify-start h-8"
              >
                {doc.icon}
                <span className="ml-2">{doc.label}</span>
                <DownloadIcon className="w-3 h-3 ml-auto" />
              </Button>
            ))}
            
            {component?.cad_files.map((file, index) => (
              <Button
                key={`cad-${index}`}
                variant="ghost"
                size="sm"
                onClick={() => window.open(file, '_blank')}
                className="justify-start h-8"
              >
                <ToolIcon className="w-4 h-4" />
                <span className="ml-2">CAD File {index + 1}</span>
                <DownloadIcon className="w-3 h-3 ml-auto" />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCompatibility = () => {
    if (!component?.compatible_parts.length && !component?.replacement_parts.length) return null;

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <SearchIcon className="w-4 h-4" />
            Compatibility
          </CardTitle>
        </CardHeader>
        <CardContent>
          {component.compatible_parts.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Compatible Parts:</h4>
              <div className="flex flex-wrap gap-1">
                {component.compatible_parts.map((part, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {part}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {component.replacement_parts.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Replacement Options:</h4>
              <div className="flex flex-wrap gap-1">
                {component.replacement_parts.map((part, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {part}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {onCompatibilityCheck && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCompatibilityCheck(component.id)}
              className="mt-3 w-full"
            >
              <SearchIcon className="w-4 h-4 mr-2" />
              Find More Compatible Parts
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderWarnings = () => {
    const warnings = [];
    
    if (!component?.compliance.ul_listed) {
      warnings.push('Not UL Listed - Verify compliance requirements');
    }
    
    if (!component?.compliance.nec_compliant) {
      warnings.push('Not NEC Compliant - Check local code requirements');
    }
    
    if (component?.confidence_score && component.confidence_score < 0.8) {
      warnings.push('Low confidence specification match - Verify accuracy');
    }

    if (!warnings.length) return null;

    return (
      <Card className="mb-4 border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-orange-800">
            <AlertTriangleIcon className="w-4 h-4" />
            Warnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2">
            {warnings.map((warning, index) => (
              <div key={index} className="text-sm text-orange-700 flex items-start gap-2">
                <AlertTriangleIcon className="w-3 h-3 mt-0.5 flex-shrink-0" />
                {warning}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!component) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
        <InfoIcon className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 mb-2">No Component Selected</h3>
        <p className="text-sm text-gray-500">
          Click on a component in the PDF viewer to see its specifications
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          {component.name}
        </h2>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Badge variant={component.verified ? 'default' : 'secondary'}>
            {component.verified ? 'Verified' : 'Unverified'}
          </Badge>
          <span>•</span>
          <span>{component.manufacturer.brand || component.manufacturer.name}</span>
        </div>
      </div>

      {/* Warnings */}
      {renderWarnings()}

      {/* Specification Groups */}
      {specificationGroups.map(renderSpecificationGroup)}

      {/* Features */}
      {renderFeatures()}

      {/* Applications */}
      {renderApplications()}

      {/* Compatibility */}
      {renderCompatibility()}

      {/* Documentation */}
      {renderDocumentation()}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-medium text-gray-500">Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-1 text-xs text-gray-500">
            <div>Created: {new Date(component.created_at).toLocaleDateString()}</div>
            <div>Updated: {new Date(component.updated_at).toLocaleDateString()}</div>
            <div>ID: {component.id}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComponentInformationPanel;