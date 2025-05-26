/**
 * Component Search and Filtering Panel
 * 
 * Advanced search and filtering interface for electrical component specifications
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { Progress } from '@/components/ui/Progress';
import { 
  SearchIcon, 
  FilterIcon, 
  XIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SortAscIcon,
  SortDescIcon,
  BookmarkIcon,
  HistoryIcon,
  ZapIcon,
  ToolIcon,
  TagIcon,
  BuildingIcon
} from 'lucide-react';
import { 
  ComponentSpecification, 
  ComponentSearchRequest, 
  ComponentCategory,
  componentSpecificationsAPI 
} from '@/services/api/componentSpecifications';

interface ComponentSearchPanelProps {
  onComponentSelect?: (component: ComponentSpecification) => void;
  onMultipleSelect?: (components: ComponentSpecification[]) => void;
  selectedComponents?: ComponentSpecification[];
  className?: string;
  isVisible?: boolean;
}

interface FilterState {
  query: string;
  category?: ComponentCategory;
  manufacturer?: string;
  voltageRange: { min?: number; max?: number };
  currentRange: { min?: number; max?: number };
  powerRange: { min?: number; max?: number };
  nemaRating?: string;
  ulListedOnly: boolean;
  necCompliantOnly: boolean;
  verifiedOnly: boolean;
  tags: string[];
}

interface SortOption {
  key: string;
  label: string;
  direction: 'asc' | 'desc';
}

const ComponentSearchPanel: React.FC<ComponentSearchPanelProps> = ({
  onComponentSelect,
  onMultipleSelect,
  selectedComponents = [],
  className = '',
  isVisible = true
}) => {
  // State management
  const [filters, setFilters] = useState<FilterState>({
    query: '',
    voltageRange: {},
    currentRange: {},
    powerRange: {},
    ulListedOnly: false,
    necCompliantOnly: false,
    verifiedOnly: false,
    tags: []
  });

  const [searchResults, setSearchResults] = useState<ComponentSpecification[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [availableCategories, setAvailableCategories] = useState<ComponentCategory[]>([]);
  const [availableManufacturers, setAvailableManufacturers] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<Array<{ name: string; filters: FilterState }>>([]);

  const [sortOption, setSortOption] = useState<SortOption>({ key: 'relevance', label: 'Relevance', direction: 'desc' });
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set(['search', 'category']));
  const [multiSelectMode, setMultiSelectMode] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const pageSize = 20;

  // Load initial data
  useEffect(() => {
    loadInitialData();
    loadStoredSearches();
  }, []);

  const loadInitialData = async () => {
    try {
      const [categories, manufacturers] = await Promise.all([
        componentSpecificationsAPI.getCategories(),
        componentSpecificationsAPI.getManufacturers()
      ]);
      setAvailableCategories(categories);
      setAvailableManufacturers(manufacturers);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  const loadStoredSearches = () => {
    try {
      const stored = localStorage.getItem('component-search-history');
      if (stored) {
        const { recent, saved } = JSON.parse(stored);
        setRecentSearches(recent || []);
        setSavedSearches(saved || []);
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  };

  const saveSearchToHistory = (query: string) => {
    if (!query.trim()) return;
    
    const newRecent = [query, ...recentSearches.filter(q => q !== query)].slice(0, 10);
    setRecentSearches(newRecent);
    
    try {
      const stored = { recent: newRecent, saved: savedSearches };
      localStorage.setItem('component-search-history', JSON.stringify(stored));
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  };

  // Search functionality
  const performSearch = useCallback(async (page: number = 1) => {
    setIsSearching(true);
    
    try {
      const searchRequest: ComponentSearchRequest = {
        query: filters.query || undefined,
        category: filters.category,
        manufacturer: filters.manufacturer,
        voltage_min: filters.voltageRange.min,
        voltage_max: filters.voltageRange.max,
        current_min: filters.currentRange.min,
        current_max: filters.currentRange.max,
        nema_rating: filters.nemaRating,
        ul_listed_only: filters.ulListedOnly
      };

      const response = await componentSpecificationsAPI.searchComponents(
        searchRequest,
        page,
        pageSize
      );

      let results = response.components;

      // Apply additional filtering
      if (filters.necCompliantOnly) {
        results = results.filter(c => c.compliance.nec_compliant);
      }

      if (filters.verifiedOnly) {
        results = results.filter(c => c.verified);
      }

      if (filters.powerRange.min || filters.powerRange.max) {
        results = results.filter(c => {
          const power = c.electrical_ratings.power_rating;
          if (!power) return false;
          if (filters.powerRange.min && power < filters.powerRange.min) return false;
          if (filters.powerRange.max && power > filters.powerRange.max) return false;
          return true;
        });
      }

      // Apply sorting
      if (sortOption.key !== 'relevance') {
        results = sortResults(results, sortOption);
      }

      setSearchResults(results);
      setTotalResults(response.total_count);
      setCurrentPage(page);
      setHasNextPage(response.has_next);

      if (filters.query) {
        saveSearchToHistory(filters.query);
      }

    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
      setTotalResults(0);
    } finally {
      setIsSearching(false);
    }
  }, [filters, sortOption]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (filters.query || filters.category || filters.manufacturer) {
        performSearch();
      } else {
        setSearchResults([]);
        setTotalResults(0);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [performSearch]);

  const sortResults = (results: ComponentSpecification[], sort: SortOption): ComponentSpecification[] => {
    const sorted = [...results];

    sorted.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sort.key) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'manufacturer':
          aValue = a.manufacturer.name.toLowerCase();
          bValue = b.manufacturer.name.toLowerCase();
          break;
        case 'voltage':
          aValue = a.electrical_ratings.voltage_rating || 0;
          bValue = b.electrical_ratings.voltage_rating || 0;
          break;
        case 'current':
          aValue = a.electrical_ratings.current_rating || 0;
          bValue = b.electrical_ratings.current_rating || 0;
          break;
        case 'updated':
          aValue = new Date(a.updated_at).getTime();
          bValue = new Date(b.updated_at).getTime();
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string') {
        return sort.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else {
        return sort.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
    });

    return sorted;
  };

  // Filter panel rendering
  const toggleFilterSection = (section: string) => {
    const newExpanded = new Set(expandedFilters);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedFilters(newExpanded);
  };

  const renderFilterSection = (
    key: string,
    title: string,
    icon: React.ReactNode,
    content: React.ReactNode
  ) => {
    const isExpanded = expandedFilters.has(key);

    return (
      <div key={key} className="mb-4">
        <Button
          variant="ghost"
          onClick={() => toggleFilterSection(key)}
          className="w-full justify-between p-2 h-auto"
        >
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-medium">{title}</span>
          </div>
          {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
        </Button>
        
        {isExpanded && (
          <div className="mt-2 pl-2">
            {content}
          </div>
        )}
      </div>
    );
  };

  const renderSearchFilter = () => (
    <div className="space-y-3">
      {/* Main search */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search components..."
          value={filters.query}
          onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {filters.query && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters(prev => ({ ...prev, query: '' }))}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <XIcon className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Recent searches */}
      {recentSearches.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-2">
            <HistoryIcon className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-600">Recent</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {recentSearches.slice(0, 5).map((search, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={() => setFilters(prev => ({ ...prev, query: search }))}
                className="h-6 px-2 text-xs text-gray-600 hover:text-gray-900"
              >
                {search}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderCategoryFilter = () => (
    <div className="space-y-2">
      <select
        value={filters.category || ''}
        onChange={(e) => setFilters(prev => ({ 
          ...prev, 
          category: e.target.value as ComponentCategory || undefined 
        }))}
        className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Categories</option>
        {availableCategories.map(category => (
          <option key={category} value={category}>
            {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </option>
        ))}
      </select>
    </div>
  );

  const renderManufacturerFilter = () => (
    <div className="space-y-2">
      <select
        value={filters.manufacturer || ''}
        onChange={(e) => setFilters(prev => ({ 
          ...prev, 
          manufacturer: e.target.value || undefined 
        }))}
        className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Manufacturers</option>
        {availableManufacturers.map(manufacturer => (
          <option key={manufacturer} value={manufacturer}>
            {manufacturer}
          </option>
        ))}
      </select>
    </div>
  );

  const renderElectricalFilter = () => (
    <div className="space-y-3">
      {/* Voltage range */}
      <div>
        <label className="text-xs text-gray-600 mb-1 block">Voltage Range (V)</label>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.voltageRange.min || ''}
            onChange={(e) => setFilters(prev => ({
              ...prev,
              voltageRange: { ...prev.voltageRange, min: e.target.value ? Number(e.target.value) : undefined }
            }))}
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.voltageRange.max || ''}
            onChange={(e) => setFilters(prev => ({
              ...prev,
              voltageRange: { ...prev.voltageRange, max: e.target.value ? Number(e.target.value) : undefined }
            }))}
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Current range */}
      <div>
        <label className="text-xs text-gray-600 mb-1 block">Current Range (A)</label>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.currentRange.min || ''}
            onChange={(e) => setFilters(prev => ({
              ...prev,
              currentRange: { ...prev.currentRange, min: e.target.value ? Number(e.target.value) : undefined }
            }))}
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.currentRange.max || ''}
            onChange={(e) => setFilters(prev => ({
              ...prev,
              currentRange: { ...prev.currentRange, max: e.target.value ? Number(e.target.value) : undefined }
            }))}
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* NEMA Rating */}
      <div>
        <label className="text-xs text-gray-600 mb-1 block">NEMA Rating</label>
        <input
          type="text"
          placeholder="e.g., 4X, 3R"
          value={filters.nemaRating || ''}
          onChange={(e) => setFilters(prev => ({ 
            ...prev, 
            nemaRating: e.target.value || undefined 
          }))}
          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );

  const renderComplianceFilter = () => (
    <div className="space-y-2">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={filters.ulListedOnly}
          onChange={(e) => setFilters(prev => ({ ...prev, ulListedOnly: e.target.checked }))}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm">UL Listed only</span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={filters.necCompliantOnly}
          onChange={(e) => setFilters(prev => ({ ...prev, necCompliantOnly: e.target.checked }))}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm">NEC Compliant only</span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={filters.verifiedOnly}
          onChange={(e) => setFilters(prev => ({ ...prev, verifiedOnly: e.target.checked }))}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm">Verified specifications only</span>
      </label>
    </div>
  );

  // Results rendering
  const renderResultItem = (component: ComponentSpecification, index: number) => {
    const isSelected = selectedComponents.some(c => c.id === component.id);

    const handleSelect = () => {
      if (multiSelectMode) {
        if (isSelected) {
          onMultipleSelect?.(selectedComponents.filter(c => c.id !== component.id));
        } else {
          onMultipleSelect?.([...selectedComponents, component]);
        }
      } else {
        onComponentSelect?.(component);
      }
    };

    return (
      <Card 
        key={component.id}
        className={`mb-3 cursor-pointer transition-all hover:shadow-md ${
          isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
        }`}
        onClick={handleSelect}
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h3 className="font-semibold text-sm text-gray-900 mb-1">
                {component.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span>{component.manufacturer.brand || component.manufacturer.name}</span>
                <span>•</span>
                <span>{component.part_number}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <Badge variant={component.verified ? 'default' : 'secondary'} className="text-xs">
                {component.verified ? 'Verified' : 'Unverified'}
              </Badge>
              {component.compliance.ul_listed && (
                <Badge variant="outline" className="text-xs">UL</Badge>
              )}
            </div>
          </div>

          {/* Quick specs */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            {component.electrical_ratings.voltage_rating && (
              <div className="text-xs">
                <span className="text-gray-600">Voltage:</span>
                <span className="ml-1 font-medium">{component.electrical_ratings.voltage_rating}V</span>
              </div>
            )}
            
            {component.electrical_ratings.current_rating && (
              <div className="text-xs">
                <span className="text-gray-600">Current:</span>
                <span className="ml-1 font-medium">{component.electrical_ratings.current_rating}A</span>
              </div>
            )}
            
            {component.compliance.nema_rating && (
              <div className="text-xs">
                <span className="text-gray-600">NEMA:</span>
                <span className="ml-1 font-medium">{component.compliance.nema_rating}</span>
              </div>
            )}
            
            {component.category && (
              <div className="text-xs">
                <span className="text-gray-600">Type:</span>
                <span className="ml-1 font-medium">
                  {component.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
            )}
          </div>

          {/* Features preview */}
          {component.features.length > 0 && (
            <div className="mt-2">
              <div className="flex flex-wrap gap-1">
                {component.features.slice(0, 3).map((feature, featureIndex) => (
                  <Badge key={featureIndex} variant="secondary" className="text-xs">
                    {feature}
                  </Badge>
                ))}
                {component.features.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{component.features.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderSortControls = () => {
    const sortOptions = [
      { key: 'relevance', label: 'Relevance' },
      { key: 'name', label: 'Name' },
      { key: 'manufacturer', label: 'Manufacturer' },
      { key: 'voltage', label: 'Voltage' },
      { key: 'current', label: 'Current' },
      { key: 'updated', label: 'Updated' }
    ];

    return (
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-600">Sort by:</span>
        <select
          value={sortOption.key}
          onChange={(e) => {
            const newOption = sortOptions.find(opt => opt.key === e.target.value);
            if (newOption) {
              setSortOption({ ...newOption, direction: 'desc' });
            }
          }}
          className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {sortOptions.map(option => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSortOption(prev => ({ 
            ...prev, 
            direction: prev.direction === 'asc' ? 'desc' : 'asc' 
          }))}
          className="h-8 px-2"
        >
          {sortOption.direction === 'asc' ? <SortAscIcon className="w-4 h-4" /> : <SortDescIcon className="w-4 h-4" />}
        </Button>
      </div>
    );
  };

  const clearAllFilters = () => {
    setFilters({
      query: '',
      voltageRange: {},
      currentRange: {},
      powerRange: {},
      ulListedOnly: false,
      necCompliantOnly: false,
      verifiedOnly: false,
      tags: []
    });
  };

  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.query ||
      filters.category ||
      filters.manufacturer ||
      filters.voltageRange.min ||
      filters.voltageRange.max ||
      filters.currentRange.min ||
      filters.currentRange.max ||
      filters.nemaRating ||
      filters.ulListedOnly ||
      filters.necCompliantOnly ||
      filters.verifiedOnly
    );
  }, [filters]);

  if (!isVisible) return null;

  return (
    <div className={`flex h-full ${className}`}>
      {/* Filters Panel */}
      <div className="w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FilterIcon className="w-5 h-5" />
              Search & Filter
            </h2>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                Clear All
              </Button>
            )}
          </div>

          {/* Filter sections */}
          {renderFilterSection('search', 'Search', <SearchIcon className="w-4 h-4" />, renderSearchFilter())}
          {renderFilterSection('category', 'Category', <TagIcon className="w-4 h-4" />, renderCategoryFilter())}
          {renderFilterSection('manufacturer', 'Manufacturer', <BuildingIcon className="w-4 h-4" />, renderManufacturerFilter())}
          {renderFilterSection('electrical', 'Electrical', <ZapIcon className="w-4 h-4" />, renderElectricalFilter())}
          {renderFilterSection('compliance', 'Compliance', <ToolIcon className="w-4 h-4" />, renderComplianceFilter())}
        </div>
      </div>

      {/* Results Panel */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Search Results
              </h3>
              {totalResults > 0 && (
                <Badge variant="secondary">
                  {totalResults} components
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant={multiSelectMode ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMultiSelectMode(!multiSelectMode)}
              >
                Multi-select
              </Button>
            </div>
          </div>

          {totalResults > 0 && renderSortControls()}

          {isSearching && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              Searching...
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {searchResults.length > 0 ? (
            <>
              {searchResults.map(renderResultItem)}
              
              {/* Pagination */}
              {hasNextPage && (
                <div className="text-center mt-4">
                  <Button
                    variant="outline"
                    onClick={() => performSearch(currentPage + 1)}
                    disabled={isSearching}
                  >
                    Load More Results
                  </Button>
                </div>
              )}
            </>
          ) : totalResults === 0 && !isSearching && hasActiveFilters ? (
            <div className="text-center py-8">
              <SearchIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No results found</h3>
              <p className="text-gray-500 mb-4">Try adjusting your search criteria</p>
              <Button variant="outline" onClick={clearAllFilters}>
                Clear All Filters
              </Button>
            </div>
          ) : !hasActiveFilters ? (
            <div className="text-center py-8">
              <SearchIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Start searching</h3>
              <p className="text-gray-500">Enter a search term or select filters to find components</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ComponentSearchPanel;