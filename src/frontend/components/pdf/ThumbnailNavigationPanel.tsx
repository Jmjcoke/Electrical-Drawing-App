import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Eye,
  EyeOff,
  Maximize2,
  Grid3X3,
  List,
  Search,
  Filter
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';

interface ThumbnailData {
  pageNumber: number;
  thumbnailUrl: string;
  title?: string;
  cloudCount?: number;
  isProcessed: boolean;
  hasAnnotations: boolean;
  lastModified?: string;
}

interface ThumbnailNavigationPanelProps {
  totalPages: number;
  currentPage: number;
  thumbnails: ThumbnailData[];
  onPageSelect: (pageNumber: number) => void;
  onThumbnailRegenerate?: (pageNumber: number) => void;
  isLoading?: boolean;
  className?: string;
}

type ViewMode = 'grid' | 'list';
type SortBy = 'page' | 'clouds' | 'modified';

export const ThumbnailNavigationPanel: React.FC<ThumbnailNavigationPanelProps> = ({
  totalPages,
  currentPage,
  thumbnails,
  onPageSelect,
  onThumbnailRegenerate,
  isLoading = false,
  className
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('page');
  const [filterText, setFilterText] = useState('');
  const [showProcessedOnly, setShowProcessedOnly] = useState(false);
  const [showCloudsOnly, setShowCloudsOnly] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current page thumbnail
  useEffect(() => {
    if (scrollContainerRef.current) {
      const currentThumbnailElement = scrollContainerRef.current.querySelector(
        `[data-page="${currentPage}"]`
      );
      if (currentThumbnailElement) {
        currentThumbnailElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
  }, [currentPage]);

  // Filter and sort thumbnails
  const filteredAndSortedThumbnails = thumbnails
    .filter(thumbnail => {
      // Text filter
      if (filterText) {
        const searchText = filterText.toLowerCase();
        const matchesPage = thumbnail.pageNumber.toString().includes(searchText);
        const matchesTitle = thumbnail.title?.toLowerCase().includes(searchText);
        if (!matchesPage && !matchesTitle) return false;
      }

      // Processed filter
      if (showProcessedOnly && !thumbnail.isProcessed) return false;

      // Clouds filter
      if (showCloudsOnly && !thumbnail.cloudCount) return false;

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'page':
          return a.pageNumber - b.pageNumber;
        case 'clouds':
          return (b.cloudCount || 0) - (a.cloudCount || 0);
        case 'modified':
          if (!a.lastModified || !b.lastModified) return 0;
          return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
        default:
          return a.pageNumber - b.pageNumber;
      }
    });

  const handleThumbnailClick = (pageNumber: number) => {
    onPageSelect(pageNumber);
  };

  const handleThumbnailDoubleClick = (pageNumber: number) => {
    if (onThumbnailRegenerate) {
      onThumbnailRegenerate(pageNumber);
    }
  };

  const getThumbnailStatusColor = (thumbnail: ThumbnailData) => {
    if (!thumbnail.isProcessed) return 'bg-gray-100 border-gray-300';
    if (thumbnail.cloudCount && thumbnail.cloudCount > 0) return 'bg-amber-50 border-amber-300';
    if (thumbnail.hasAnnotations) return 'bg-blue-50 border-blue-300';
    return 'bg-green-50 border-green-300';
  };

  const getThumbnailStatusBadge = (thumbnail: ThumbnailData) => {
    if (!thumbnail.isProcessed) {
      return <Badge variant="outline" className="text-xs">Processing</Badge>;
    }
    if (thumbnail.cloudCount && thumbnail.cloudCount > 0) {
      return <Badge variant="outline" className="text-xs text-amber-600">{thumbnail.cloudCount} clouds</Badge>;
    }
    if (thumbnail.hasAnnotations) {
      return <Badge variant="outline" className="text-xs text-blue-600">Annotated</Badge>;
    }
    return <Badge variant="outline" className="text-xs text-green-600">Ready</Badge>;
  };

  const renderGridView = () => (
    <div className="grid grid-cols-2 gap-3 p-3">
      {filteredAndSortedThumbnails.map(thumbnail => (
        <div
          key={thumbnail.pageNumber}
          data-page={thumbnail.pageNumber}
          className={cn(
            'relative cursor-pointer rounded-lg border-2 transition-all hover:shadow-md',
            currentPage === thumbnail.pageNumber
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : getThumbnailStatusColor(thumbnail)
          )}
          onClick={() => handleThumbnailClick(thumbnail.pageNumber)}
          onDoubleClick={() => handleThumbnailDoubleClick(thumbnail.pageNumber)}
        >
          {/* Thumbnail Image */}
          <div className="aspect-[3/4] relative overflow-hidden rounded-t-lg">
            {thumbnail.thumbnailUrl ? (
              <img
                src={thumbnail.thumbnailUrl}
                alt={`Page ${thumbnail.pageNumber}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <div className="text-gray-400 text-center">
                  <div className="text-2xl mb-1">{thumbnail.pageNumber}</div>
                  <div className="text-xs">Loading...</div>
                </div>
              </div>
            )}
            
            {/* Overlay for current page */}
            {currentPage === thumbnail.pageNumber && (
              <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
                  Current
                </div>
              </div>
            )}

            {/* Processing indicator */}
            {!thumbnail.isProcessed && (
              <div className="absolute top-2 right-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600" />
              </div>
            )}
          </div>

          {/* Thumbnail Info */}
          <div className="p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Page {thumbnail.pageNumber}</span>
              {getThumbnailStatusBadge(thumbnail)}
            </div>
            
            {thumbnail.title && (
              <div className="text-xs text-gray-600 truncate mb-1">
                {thumbnail.title}
              </div>
            )}
            
            {thumbnail.lastModified && (
              <div className="text-xs text-gray-500">
                {new Date(thumbnail.lastModified).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderListView = () => (
    <div className="divide-y divide-gray-200">
      {filteredAndSortedThumbnails.map(thumbnail => (
        <div
          key={thumbnail.pageNumber}
          data-page={thumbnail.pageNumber}
          className={cn(
            'flex items-center p-3 cursor-pointer hover:bg-gray-50 transition-colors',
            currentPage === thumbnail.pageNumber && 'bg-blue-50 border-l-4 border-blue-500'
          )}
          onClick={() => handleThumbnailClick(thumbnail.pageNumber)}
          onDoubleClick={() => handleThumbnailDoubleClick(thumbnail.pageNumber)}
        >
          {/* Small thumbnail */}
          <div className="w-12 h-16 mr-3 rounded border overflow-hidden flex-shrink-0">
            {thumbnail.thumbnailUrl ? (
              <img
                src={thumbnail.thumbnailUrl}
                alt={`Page ${thumbnail.pageNumber}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <span className="text-xs text-gray-400">{thumbnail.pageNumber}</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-medium truncate">
                Page {thumbnail.pageNumber}
                {thumbnail.title && ` - ${thumbnail.title}`}
              </h4>
              {getThumbnailStatusBadge(thumbnail)}
            </div>
            
            <div className="flex items-center space-x-3 text-xs text-gray-500">
              {thumbnail.cloudCount !== undefined && (
                <span>{thumbnail.cloudCount} clouds</span>
              )}
              {thumbnail.hasAnnotations && (
                <span>Annotated</span>
              )}
              {thumbnail.lastModified && (
                <span>{new Date(thumbnail.lastModified).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          {/* Processing indicator */}
          {!thumbnail.isProcessed && (
            <div className="ml-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600" />
            </div>
          )}
        </div>
      ))}
    </div>
  );

  if (isCollapsed) {
    return (
      <div className={cn('w-12 bg-white border-r shadow-sm', className)}>
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(false)}
            className="w-full"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Vertical page indicators */}
        <div className="space-y-1 px-1">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i + 1}
              onClick={() => handleThumbnailClick(i + 1)}
              className={cn(
                'w-full h-2 rounded-sm transition-colors',
                currentPage === i + 1 ? 'bg-blue-500' : 'bg-gray-300 hover:bg-gray-400'
              )}
              title={`Page ${i + 1}`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card className={cn('w-80 bg-white border-r shadow-sm', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Pages ({filteredAndSortedThumbnails.length}/{totalPages})</CardTitle>
          
          <div className="flex items-center space-x-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="p-1"
            >
              <Grid3X3 className="h-3 w-3" />
            </Button>
            
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="p-1"
            >
              <List className="h-3 w-3" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(true)}
              className="p-1"
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3 w-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search pages..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-7 pr-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="page">Sort by Page</option>
              <option value="clouds">Sort by Clouds</option>
              <option value="modified">Sort by Modified</option>
            </select>
            
            <Button
              variant={showProcessedOnly ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setShowProcessedOnly(!showProcessedOnly)}
              className="p-1"
              title="Show processed only"
            >
              <Eye className="h-3 w-3" />
            </Button>
            
            <Button
              variant={showCloudsOnly ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setShowCloudsOnly(!showCloudsOnly)}
              className="p-1"
              title="Show with clouds only"
            >
              <Filter className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-sm text-gray-600">Loading thumbnails...</p>
          </div>
        ) : filteredAndSortedThumbnails.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-2">
              <Grid3X3 className="h-8 w-8 mx-auto" />
            </div>
            <p className="text-sm text-gray-600">No pages match your filters</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterText('');
                setShowProcessedOnly(false);
                setShowCloudsOnly(false);
              }}
              className="mt-2"
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            className="max-h-[calc(100vh-200px)] overflow-y-auto"
          >
            {viewMode === 'grid' ? renderGridView() : renderListView()}
          </div>
        )}
      </CardContent>

      {/* Footer with summary */}
      <div className="px-3 py-2 border-t bg-gray-50 text-xs text-gray-600">
        <div className="flex items-center justify-between">
          <span>Current: Page {currentPage}</span>
          <span>
            {thumbnails.filter(t => t.isProcessed).length} processed
          </span>
        </div>
      </div>
    </Card>
  );
};