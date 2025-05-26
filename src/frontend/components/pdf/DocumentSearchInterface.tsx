import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { SearchResult, SearchFilter, SearchSettings, SearchIndex } from '../../types/search';
import { ElectricalComponent } from '../../types/electrical';
import { Annotation } from '../../types/annotations';
import { Point, BoundingBox } from '../../types/electrical';

interface DocumentSearchInterfaceProps {
  components: ElectricalComponent[];
  annotations: Annotation[];
  onNavigateToResult: (result: SearchResult) => void;
  onHighlightResults: (results: SearchResult[]) => void;
  onClearHighlights: () => void;
  isVisible: boolean;
  onToggleVisibility: () => void;
  documentBounds: BoundingBox;
}

interface SearchHistory {
  query: string;
  timestamp: number;
  resultCount: number;
}

export const DocumentSearchInterface: React.FC<DocumentSearchInterfaceProps> = ({
  components,
  annotations,
  onNavigateToResult,
  onHighlightResults,
  onClearHighlights,
  isVisible,
  onToggleVisibility,
  documentBounds
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [activeFilters, setActiveFilters] = useState<SearchFilter[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchSettings, setSearchSettings] = useState<SearchSettings>({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
    searchScope: 'all',
    maxResults: 100,
    fuzzySearch: true,
    searchInProperties: true
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Build search index for faster searching
  const searchIndex = useMemo((): SearchIndex => {
    const index: SearchIndex = {
      components: [],
      annotations: [],
      properties: new Map(),
      fullText: []
    };

    // Index components
    components.forEach(component => {
      const searchableText = [
        component.id,
        component.type,
        JSON.stringify(component.properties || {}),
        component.metadata?.source || ''
      ].join(' ').toLowerCase();

      index.components.push({
        id: component.id,
        type: 'component',
        searchableText,
        object: component,
        keywords: [component.type, ...(Object.keys(component.properties || {}))],
        location: component.centerPoint
      });

      // Index component properties
      if (component.properties) {
        Object.entries(component.properties).forEach(([key, value]) => {
          const propertyKey = `${component.id}.${key}`;
          index.properties.set(propertyKey, {
            componentId: component.id,
            key,
            value: String(value),
            searchableText: `${key} ${value}`.toLowerCase()
          });
        });
      }
    });

    // Index annotations
    annotations.forEach(annotation => {
      const searchableText = [
        annotation.id,
        annotation.type,
        annotation.text || '',
        annotation.authorName || '',
        JSON.stringify(annotation.metadata || {})
      ].join(' ').toLowerCase();

      index.annotations.push({
        id: annotation.id,
        type: 'annotation',
        searchableText,
        object: annotation,
        keywords: [annotation.type, annotation.authorName || ''],
        location: annotation.position || annotation.centerPoint || { x: 0, y: 0 }
      });
    });

    return index;
  }, [components, annotations]);

  const availableFilters: SearchFilter[] = [
    { id: 'components', label: 'Components', type: 'category', active: true },
    { id: 'annotations', label: 'Annotations', type: 'category', active: true },
    { id: 'outlets', label: 'Outlets', type: 'component_type', active: false },
    { id: 'switches', label: 'Switches', type: 'component_type', active: false },
    { id: 'lights', label: 'Light Fixtures', type: 'component_type', active: false },
    { id: 'panels', label: 'Panels', type: 'component_type', active: false },
    { id: 'recent', label: 'Recently Added', type: 'temporal', active: false },
    { id: 'modified', label: 'Recently Modified', type: 'temporal', active: false }
  ];

  const performSearch = useCallback((query: string, filters: SearchFilter[] = activeFilters): SearchResult[] => {
    if (!query.trim()) return [];

    const results: SearchResult[] = [];
    const normalizedQuery = searchSettings.caseSensitive ? query : query.toLowerCase();
    const searchTerms = normalizedQuery.split(/\s+/).filter(term => term.length > 0);

    // Helper function to calculate relevance score
    const calculateRelevance = (text: string, location: Point): number => {
      let score = 0;
      const normalizedText = searchSettings.caseSensitive ? text : text.toLowerCase();

      searchTerms.forEach(term => {
        if (searchSettings.useRegex) {
          try {
            const regex = new RegExp(term, searchSettings.caseSensitive ? 'g' : 'gi');
            const matches = normalizedText.match(regex);
            score += matches ? matches.length * 10 : 0;
          } catch {
            // Fallback to simple search if regex is invalid
            score += normalizedText.includes(term) ? 10 : 0;
          }
        } else if (searchSettings.wholeWord) {
          const wordRegex = new RegExp(`\\b${term}\\b`, searchSettings.caseSensitive ? 'g' : 'gi');
          const matches = normalizedText.match(wordRegex);
          score += matches ? matches.length * 15 : 0;
        } else {
          const index = normalizedText.indexOf(term);
          if (index !== -1) {
            score += 10;
            // Boost score for matches at the beginning
            if (index === 0) score += 5;
          }
        }
      });

      // Fuzzy search fallback
      if (score === 0 && searchSettings.fuzzySearch) {
        searchTerms.forEach(term => {
          const fuzzyScore = calculateFuzzyMatch(term, normalizedText);
          score += fuzzyScore;
        });
      }

      return score;
    };

    // Search components
    if (filters.some(f => f.id === 'components' && f.active) || filters.length === 0) {
      searchIndex.components.forEach(item => {
        const relevance = calculateRelevance(item.searchableText, item.location);
        
        if (relevance > 0) {
          // Apply component type filters
          const componentTypeFilters = filters.filter(f => f.type === 'component_type' && f.active);
          if (componentTypeFilters.length > 0) {
            const component = item.object as ElectricalComponent;
            const matchesType = componentTypeFilters.some(f => {
              switch (f.id) {
                case 'outlets': return component.type === 'outlet';
                case 'switches': return component.type === 'switch';
                case 'lights': return component.type === 'light_fixture';
                case 'panels': return component.type === 'panel';
                default: return false;
              }
            });
            if (!matchesType) return;
          }

          results.push({
            id: item.id,
            type: 'component',
            title: `${item.object.type} - ${item.id}`,
            description: `Type: ${item.object.type}`,
            location: item.location,
            relevance,
            object: item.object,
            highlightText: extractHighlightText(item.searchableText, searchTerms),
            matchedTerms: searchTerms.filter(term => 
              item.searchableText.includes(searchSettings.caseSensitive ? term : term.toLowerCase())
            )
          });
        }
      });
    }

    // Search annotations
    if (filters.some(f => f.id === 'annotations' && f.active) || filters.length === 0) {
      searchIndex.annotations.forEach(item => {
        const relevance = calculateRelevance(item.searchableText, item.location);
        
        if (relevance > 0) {
          const annotation = item.object as Annotation;
          results.push({
            id: item.id,
            type: 'annotation',
            title: `${annotation.type} - ${annotation.text || annotation.id}`,
            description: `Author: ${annotation.authorName || 'Unknown'}`,
            location: item.location,
            relevance,
            object: item.object,
            highlightText: extractHighlightText(item.searchableText, searchTerms),
            matchedTerms: searchTerms.filter(term => 
              item.searchableText.includes(searchSettings.caseSensitive ? term : term.toLowerCase())
            )
          });
        }
      });
    }

    // Apply temporal filters
    const temporalFilters = filters.filter(f => f.type === 'temporal' && f.active);
    if (temporalFilters.length > 0) {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      
      results.forEach(result => {
        let shouldInclude = false;
        
        temporalFilters.forEach(filter => {
          if (filter.id === 'recent') {
            const createdAt = result.object.createdAt || result.object.timestamp;
            if (createdAt && new Date(createdAt).getTime() > oneDayAgo) {
              shouldInclude = true;
            }
          } else if (filter.id === 'modified') {
            const updatedAt = result.object.updatedAt;
            if (updatedAt && new Date(updatedAt).getTime() > oneDayAgo) {
              shouldInclude = true;
            }
          }
        });
        
        if (!shouldInclude) {
          const index = results.indexOf(result);
          if (index > -1) results.splice(index, 1);
        }
      });
    }

    // Sort by relevance and limit results
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, searchSettings.maxResults);
  }, [searchIndex, activeFilters, searchSettings]);

  const calculateFuzzyMatch = useCallback((term: string, text: string): number => {
    // Simple fuzzy matching algorithm
    let score = 0;
    let termIndex = 0;
    
    for (let i = 0; i < text.length && termIndex < term.length; i++) {
      if (text[i] === term[termIndex]) {
        score += 1;
        termIndex++;
      }
    }
    
    return termIndex === term.length ? score * 2 : 0;
  }, []);

  const extractHighlightText = useCallback((text: string, terms: string[]): string => {
    let highlighted = text;
    
    terms.forEach(term => {
      const regex = new RegExp(`(${term})`, searchSettings.caseSensitive ? 'g' : 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });
    
    return highlighted;
  }, [searchSettings]);

  const handleSearch = useCallback((query: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setIsSearching(true);
      
      try {
        const results = performSearch(query);
        setSearchResults(results);
        setSelectedResultIndex(0);
        
        // Add to search history
        if (query.trim() && results.length > 0) {
          setSearchHistory(prev => {
            const newHistory = [{
              query: query.trim(),
              timestamp: Date.now(),
              resultCount: results.length
            }, ...prev.filter(h => h.query !== query.trim())].slice(0, 10);
            return newHistory;
          });
        }

        // Highlight results
        onHighlightResults(results);
        
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [performSearch, onHighlightResults]);

  useEffect(() => {
    handleSearch(searchQuery);
  }, [searchQuery, handleSearch, activeFilters]);

  const handleResultSelect = useCallback((result: SearchResult, index: number) => {
    setSelectedResultIndex(index);
    onNavigateToResult(result);
  }, [onNavigateToResult]);

  const handleKeyNavigation = useCallback((event: React.KeyboardEvent) => {
    if (searchResults.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        const nextIndex = (selectedResultIndex + 1) % searchResults.length;
        setSelectedResultIndex(nextIndex);
        onNavigateToResult(searchResults[nextIndex]);
        break;
      case 'ArrowUp':
        event.preventDefault();
        const prevIndex = selectedResultIndex === 0 ? searchResults.length - 1 : selectedResultIndex - 1;
        setSelectedResultIndex(prevIndex);
        onNavigateToResult(searchResults[prevIndex]);
        break;
      case 'Enter':
        event.preventDefault();
        if (searchResults[selectedResultIndex]) {
          onNavigateToResult(searchResults[selectedResultIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        setSearchQuery('');
        onClearHighlights();
        break;
    }
  }, [searchResults, selectedResultIndex, onNavigateToResult, onClearHighlights]);

  const toggleFilter = useCallback((filterId: string) => {
    setActiveFilters(prev => {
      const existing = prev.find(f => f.id === filterId);
      if (existing) {
        return prev.map(f => f.id === filterId ? { ...f, active: !f.active } : f);
      } else {
        const filter = availableFilters.find(f => f.id === filterId);
        return filter ? [...prev, { ...filter, active: true }] : prev;
      }
    });
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    onClearHighlights();
  }, [onClearHighlights]);

  if (!isVisible) {
    return (
      <button 
        onClick={onToggleVisibility}
        className="search-toggle collapsed"
        title="Show search"
      >
        🔍
      </button>
    );
  }

  return (
    <div className="document-search-interface">
      {/* Search Header */}
      <div className="search-header">
        <h4 className="search-title">Search Document</h4>
        <button onClick={onToggleVisibility} className="close-btn">✕</button>
      </div>

      {/* Search Input */}
      <div className="search-input-container">
        <div className="search-input-wrapper">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyNavigation}
            placeholder="Search components, annotations, properties..."
            className="search-input"
          />
          <div className="search-input-actions">
            {searchQuery && (
              <button onClick={clearSearch} className="clear-btn" title="Clear search">
                ✕
              </button>
            )}
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`advanced-btn ${showAdvanced ? 'active' : ''}`}
              title="Advanced search options"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Search Status */}
        <div className="search-status">
          {isSearching ? (
            <span className="searching">Searching...</span>
          ) : (
            <span className="result-count">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
              {searchQuery && ` for "${searchQuery}"`}
            </span>
          )}
        </div>
      </div>

      {/* Advanced Search Options */}
      {showAdvanced && (
        <div className="advanced-search">
          <div className="search-settings">
            <h5>Search Options</h5>
            <div className="settings-grid">
              <label>
                <input
                  type="checkbox"
                  checked={searchSettings.caseSensitive}
                  onChange={(e) => setSearchSettings(prev => ({ ...prev, caseSensitive: e.target.checked }))}
                />
                Case sensitive
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={searchSettings.wholeWord}
                  onChange={(e) => setSearchSettings(prev => ({ ...prev, wholeWord: e.target.checked }))}
                />
                Whole word
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={searchSettings.useRegex}
                  onChange={(e) => setSearchSettings(prev => ({ ...prev, useRegex: e.target.checked }))}
                />
                Regular expressions
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={searchSettings.fuzzySearch}
                  onChange={(e) => setSearchSettings(prev => ({ ...prev, fuzzySearch: e.target.checked }))}
                />
                Fuzzy search
              </label>
            </div>
          </div>

          <div className="search-filters">
            <h5>Filters</h5>
            <div className="filter-chips">
              {availableFilters.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => toggleFilter(filter.id)}
                  className={`filter-chip ${activeFilters.some(f => f.id === filter.id && f.active) ? 'active' : ''}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      <div className="search-results" ref={resultsContainerRef}>
        {searchResults.length > 0 ? (
          <div className="results-list">
            {searchResults.map((result, index) => (
              <div
                key={result.id}
                className={`result-item ${index === selectedResultIndex ? 'selected' : ''}`}
                onClick={() => handleResultSelect(result, index)}
              >
                <div className="result-header">
                  <span className={`result-type type-${result.type}`}>
                    {result.type === 'component' ? '⚡' : '📝'}
                  </span>
                  <span className="result-title">{result.title}</span>
                  <span className="result-relevance">{result.relevance}%</span>
                </div>
                
                <div className="result-description">{result.description}</div>
                
                {result.highlightText && (
                  <div 
                    className="result-highlight"
                    dangerouslySetInnerHTML={{ __html: result.highlightText }}
                  />
                )}
                
                <div className="result-location">
                  📍 ({result.location.x.toFixed(0)}, {result.location.y.toFixed(0)})
                </div>
                
                {result.matchedTerms && result.matchedTerms.length > 0 && (
                  <div className="matched-terms">
                    {result.matchedTerms.map(term => (
                      <span key={term} className="matched-term">{term}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : searchQuery && !isSearching ? (
          <div className="no-results">
            <div className="no-results-icon">🔍</div>
            <div className="no-results-text">No results found</div>
            <div className="no-results-suggestions">
              <p>Try:</p>
              <ul>
                <li>Different keywords</li>
                <li>Enabling fuzzy search</li>
                <li>Adjusting filters</li>
                <li>Using broader search terms</li>
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      {/* Search History */}
      {searchHistory.length > 0 && !searchQuery && (
        <div className="search-history">
          <h5>Recent Searches</h5>
          <div className="history-list">
            {searchHistory.map((item, index) => (
              <div
                key={index}
                className="history-item"
                onClick={() => setSearchQuery(item.query)}
              >
                <span className="history-query">{item.query}</span>
                <span className="history-count">{item.resultCount} results</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Statistics */}
      {searchResults.length > 0 && (
        <div className="search-statistics">
          <h5>Search Statistics</h5>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Components:</span>
              <span className="stat-value">
                {searchResults.filter(r => r.type === 'component').length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Annotations:</span>
              <span className="stat-value">
                {searchResults.filter(r => r.type === 'annotation').length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Avg. Relevance:</span>
              <span className="stat-value">
                {(searchResults.reduce((sum, r) => sum + r.relevance, 0) / searchResults.length).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};