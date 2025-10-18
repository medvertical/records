import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, ListFilter, ChevronDown, ChevronUp, X, Clock, Zap } from "lucide-react";
import { SeverityIcon } from "@/components/ui/severity-icon";
import { FilterChipList } from "@/components/filters/FilterChipList";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SeverityLevel } from "@/components/ui/severity-icon";
import { cn } from "@/lib/utils";

export interface ValidationFilters {
  aspects: string[];
  severities: string[];
  hasIssuesOnly: boolean;
  // Issue-based filtering
  issueFilter?: {
    /** Filter by specific issue IDs */
    issueIds?: string[];
    /** Filter by issue severity */
    severity?: 'error' | 'warning' | 'information';
    /** Filter by issue category/aspect */
    category?: string;
    /** Filter by issue message content */
    messageContains?: string;
    /** Filter by issue path */
    pathContains?: string;
  };
  // FHIR search parameter filters (per capability statement)
  fhirSearchParams?: {
    [paramName: string]: {
      operator?: string;
      value: string | string[];
    };
  };
}

interface ResourceSearchProps {
  resourceTypes: string[];
  onSearch: (query: string, resourceType: string, fhirParams?: Record<string, { value: string | string[]; operator?: string }>) => void;
  defaultQuery?: string;
  defaultResourceType?: string;
  filters?: ValidationFilters;
  onFilterChange?: (filters: ValidationFilters) => void;
  validationSummary?: {
    aspectStats?: {
      [aspectId: string]: {
        valid: number;
        invalid: number;
        warnings: number;
        total: number;
      };
    };
    severityStats?: {
      [severityId: string]: {
        count: number;
        resourceCount: number;
      };
    };
  };
  activeServer?: {
    name: string;
    url: string;
    fhirVersion?: string;
  };
}

const VALIDATION_ASPECTS = [
  { id: 'structural', label: 'Structural' },
  { id: 'profile', label: 'Profile' },
  { id: 'terminology', label: 'Terminology' },
  { id: 'reference', label: 'Reference' },
  { id: 'businessRule', label: 'Business Rules' },
  { id: 'metadata', label: 'Metadata' },
];

const SEVERITIES = [
  { id: 'error', label: 'Error' },
  { id: 'warning', label: 'Warning' },
  { id: 'information', label: 'Information' },
];

export default function ResourceSearch({
  resourceTypes,
  onSearch,
  defaultQuery = "",
  defaultResourceType = "",
  filters = { aspects: [], severities: [], hasIssuesOnly: false },
  onFilterChange,
  validationSummary,
  activeServer,
}: ResourceSearchProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [resourceType, setResourceType] = useState(defaultResourceType);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(false);
  const [fhirSearchParams, setFhirSearchParams] = useState<Record<string, { value: string | string[]; operator?: string }>>({});
  
  // Autocomplete state
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{value: string, label: string, type: 'history' | 'suggestion' | 'syntax'}>>([]);
  
  // Ref for search input to manage focus
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(defaultQuery);
    setResourceType(defaultResourceType);
  }, [defaultQuery, defaultResourceType]);

  // Load search history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('fhir-search-history');
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.warn('Failed to parse search history:', e);
      }
    }
  }, []);

  // Generate suggestions based on query and resource type
  useEffect(() => {
    if (!query.trim()) {
      // Show recent searches when no query
      const recentSuggestions = searchHistory.slice(0, 5).map(search => ({
        value: search,
        label: search,
        type: 'history' as const
      }));
      setSuggestions(recentSuggestions);
      return;
    }

    const newSuggestions: Array<{value: string, label: string, type: 'history' | 'suggestion' | 'syntax'}> = [];
    
    // Add matching search history
    const matchingHistory = searchHistory
      .filter(search => search.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3)
      .map(search => ({
        value: search,
        label: search,
        type: 'history' as const
      }));
    newSuggestions.push(...matchingHistory);

    // Add resource-specific suggestions
    if (resourceType && resourceType !== 'all') {
      const resourceSuggestions = getResourceSpecificSuggestions(resourceType, query);
      newSuggestions.push(...resourceSuggestions);
    }

    // Always add general suggestions (field paths work for all resource types)
    const generalSuggestions = getGeneralSuggestions(query);
    newSuggestions.push(...generalSuggestions);

    // Add syntax suggestions
    const syntaxSuggestions = getSyntaxSuggestions(query);
    newSuggestions.push(...syntaxSuggestions);

    setSuggestions(newSuggestions);
  }, [query, resourceType, searchHistory]);

  // Helper functions for generating suggestions
  const getResourceSpecificSuggestions = (resourceType: string, query: string) => {
    const suggestions: Array<{value: string, label: string, type: 'suggestion' | 'syntax'}> = [];
    
    const resourceFields: Record<string, string[]> = {
      'Patient': ['name:', 'family:', 'given:', 'identifier:', 'birthdate:', 'gender:'],
      'Practitioner': ['name:', 'family:', 'given:', 'identifier:', 'practitioner-role:'],
      'Organization': ['name:', 'identifier:', 'address:', 'type:'],
      'Observation': ['code:', 'value-string:', 'value-quantity:', 'status:', 'category:'],
      'Medication': ['name:', 'code:', 'manufacturer:'],
      'Condition': ['code:', 'clinical-status:', 'verification-status:', 'category:'],
      'DiagnosticReport': ['code:', 'status:', 'category:'],
      'Encounter': ['status:', 'class:', 'type:', 'service-type:'],
      'Procedure': ['code:', 'status:', 'category:'],
      'AllergyIntolerance': ['code:', 'clinical-status:', 'verification-status:'],
      'Immunization': ['vaccine-code:', 'status:', 'reason-code:'],
      'DocumentReference': ['type:', 'status:', 'category:'],
      'Location': ['name:', 'address:', 'type:'],
      'Appointment': ['status:', 'service-type:', 'specialty:']
    };

    const fields = resourceFields[resourceType] || [];
    
    // If query starts with a field name, suggest completions
    const matchingFields = fields.filter(field => 
      field.toLowerCase().startsWith(query.toLowerCase())
    );
    
    matchingFields.forEach(field => {
      suggestions.push({
        value: field,
        label: `${field} (search in ${field.slice(0, -1)})`,
        type: 'syntax'
      });
    });

    // If no field match, suggest common fields for this resource
    if (matchingFields.length === 0 && fields.length > 0) {
      fields.slice(0, 3).forEach(field => {
        suggestions.push({
          value: field,
          label: `${field} (search in ${field.slice(0, -1)})`,
          type: 'suggestion'
        });
      });
    }

    return suggestions;
  };

  const getGeneralSuggestions = (query: string) => {
    const suggestions: Array<{value: string, label: string, type: 'suggestion' | 'syntax'}> = [];
    
    // Common FHIR search suggestions
    const commonSuggestions = [
      'meta.profile',
      'meta.lastUpdated',
      'meta.versionId',
      '_content',
      '_text',
      'name:',
      'identifier:',
      'status:'
    ];

    const matchingSuggestions = commonSuggestions.filter(suggestion =>
      suggestion.toLowerCase().includes(query.toLowerCase())
    );

    matchingSuggestions.forEach(suggestion => {
      suggestions.push({
        value: suggestion,
        label: suggestion.includes(':') ? `${suggestion} (field search)` : suggestion,
        type: 'syntax'
      });
    });

    return suggestions;
  };

  const getSyntaxSuggestions = (query: string) => {
    const suggestions: Array<{value: string, label: string, type: 'syntax'}> = [];
    
    // FHIR search operators
    const operators = [
      ':exact',
      ':contains',
      ':gt',
      ':lt',
      ':ge',
      ':le',
      ':not'
    ];

    // If query ends with a colon, suggest operators
    if (query.endsWith(':')) {
      operators.forEach(op => {
        suggestions.push({
          value: query + op,
          label: `${query}${op} (exact match)`,
          type: 'syntax'
        });
      });
    }

    return suggestions;
  };

  // Initialize FHIR search parameters from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fhirParams: Record<string, { value: string | string[]; operator?: string }> = {};
    
    params.forEach((value, key) => {
      // Skip known params like 'type', 'search', pagination params, etc.
      if (!['type', 'search', 'page', 'pageSize', 'limit'].includes(key)) {
        // Parse operator if present (e.g., "birthdate:gt")
        const [paramName, operator] = key.split(':');
        fhirParams[paramName] = { value, operator };
      }
    });
    
    if (Object.keys(fhirParams).length > 0) {
      setFhirSearchParams(fhirParams);
    }
  }, []);

  // Sync local fhirSearchParams with filters prop
  useEffect(() => {
    if (filters.fhirSearchParams) {
      setFhirSearchParams(filters.fhirSearchParams);
    }
  }, [filters.fhirSearchParams]);

  const handleSearch = useCallback(() => {
    // Save to search history
    if (query.trim()) {
      const newHistory = [query.trim(), ...searchHistory.filter(h => h !== query.trim())].slice(0, 10);
      setSearchHistory(newHistory);
      localStorage.setItem('fhir-search-history', JSON.stringify(newHistory));
    }
    
    // Convert "all" back to empty string for the API
    const searchResourceType = resourceType === "all" ? "" : resourceType;
    onSearch(query, searchResourceType, fhirSearchParams);
    setIsAutocompleteOpen(false);
  }, [query, resourceType, fhirSearchParams, onSearch, searchHistory]);

  // Auto-expand filters when there are active filters, but respect manual collapse
  useEffect(() => {
    const hasActiveFilters = 
      (resourceType && resourceType !== 'all') || 
      (query && query.trim() !== '') || 
      Object.keys(fhirSearchParams).length > 0;
    
    // Auto-expand if there are active filters and user hasn't manually collapsed
    if (hasActiveFilters && !isManuallyCollapsed) {
      setIsFilterExpanded(true);
    }
    // Auto-collapse if no active filters and user hasn't manually expanded
    else if (!hasActiveFilters && !isFilterExpanded) {
      setIsManuallyCollapsed(false);
    }
  }, [resourceType, query, fhirSearchParams, isManuallyCollapsed, isFilterExpanded]);

  // Note: Auto-search removed to prevent infinite loops
  // The query will re-run automatically when validationFilters.fhirSearchParams changes
  // due to the query key dependency in resource-browser.tsx

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      setIsAutocompleteOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsAutocompleteOpen(true);
    }
  };

  const handleAspectToggle = (aspectId: string) => {
    if (!onFilterChange) return;
    const newAspects = filters.aspects.includes(aspectId)
      ? filters.aspects.filter(a => a !== aspectId)
      : [...filters.aspects, aspectId];
    onFilterChange({ ...filters, aspects: newAspects });
  };

  const handleSeverityToggle = (severityId: string) => {
    if (!onFilterChange) return;
    const newSeverities = filters.severities.includes(severityId)
      ? filters.severities.filter(s => s !== severityId)
      : [...filters.severities, severityId];
    onFilterChange({ ...filters, severities: newSeverities });
  };

  const handleClearFilters = () => {
    if (!onFilterChange) return;
    onFilterChange({ aspects: [], severities: [], hasIssuesOnly: false, issueFilter: undefined });
  };

  const hasActiveFilters = false; // No validation filters remain

  return (
    <div className="w-full bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Popover open={isAutocompleteOpen} onOpenChange={setIsAutocompleteOpen}>
            <PopoverTrigger asChild>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search resources by ID, name, or content..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    // Only open autocomplete if there's a query or suggestions
                    if (e.target.value.trim() && suggestions.length > 0) {
                      setIsAutocompleteOpen(true);
                    } else if (!e.target.value.trim()) {
                      setIsAutocompleteOpen(false);
                    }
                  }}
                  onKeyDown={handleKeyPress}
                  onFocus={() => {
                    // Only open if there are suggestions to show and query is empty (for history)
                    if (suggestions.length > 0 && !query.trim()) {
                      setIsAutocompleteOpen(true);
                    }
                  }}
                  className="pl-10"
                />
              </div>
            </PopoverTrigger>
            <PopoverContent 
              className="w-[--radix-popover-trigger-width] p-0" 
              align="start"
              onOpenAutoFocus={(e) => {
                // Prevent Radix from stealing focus when popover opens
                e.preventDefault();
              }}
              onCloseAutoFocus={(e) => {
                // Prevent Radix from managing focus when popover closes
                e.preventDefault();
                // Manually focus the input
                searchInputRef.current?.focus();
              }}
            >
              <div className="max-h-60 overflow-auto">
                {suggestions.length === 0 ? (
                  <div className="p-2 text-sm text-gray-500">No suggestions found.</div>
                ) : (
                  <>
                    {suggestions.some(s => s.type === 'history') && (
                      <div>
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50">
                          Recent Searches
                        </div>
                        {suggestions.filter(s => s.type === 'history').map((suggestion, index) => (
                          <button
                            key={`history-${index}`}
                            className="w-full flex items-center px-3 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                            onMouseDown={(e) => {
                              // Use onMouseDown instead of onClick to prevent input blur
                              e.preventDefault();
                            }}
                            onClick={() => {
                              const newQuery = suggestion.value;
                              setQuery(newQuery);
                              
                              // Save to search history immediately with the new query
                              if (newQuery.trim()) {
                                const newHistory = [newQuery.trim(), ...searchHistory.filter(h => h !== newQuery.trim())].slice(0, 10);
                                setSearchHistory(newHistory);
                                localStorage.setItem('fhir-search-history', JSON.stringify(newHistory));
                              }
                              
                              // Trigger search with the new query value directly
                              const searchResourceType = resourceType === "all" ? "" : resourceType;
                              onSearch(newQuery, searchResourceType, fhirSearchParams);
                              setIsAutocompleteOpen(false);
                              // Focus is now handled by onCloseAutoFocus in PopoverContent
                            }}
                          >
                            <Clock className="mr-2 h-4 w-4 text-gray-500" />
                            {suggestion.label}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {suggestions.some(s => s.type === 'suggestion') && (
                      <div>
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50">
                          Suggestions
                        </div>
                        {suggestions.filter(s => s.type === 'suggestion').map((suggestion, index) => (
                          <button
                            key={`suggestion-${index}`}
                            className="w-full flex items-center px-3 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                            onMouseDown={(e) => {
                              // Use onMouseDown instead of onClick to prevent input blur
                              e.preventDefault();
                            }}
                            onClick={() => {
                              const newQuery = suggestion.value;
                              setQuery(newQuery);
                              
                              // Save to search history immediately with the new query
                              if (newQuery.trim()) {
                                const newHistory = [newQuery.trim(), ...searchHistory.filter(h => h !== newQuery.trim())].slice(0, 10);
                                setSearchHistory(newHistory);
                                localStorage.setItem('fhir-search-history', JSON.stringify(newHistory));
                              }
                              
                              // Trigger search with the new query value directly
                              const searchResourceType = resourceType === "all" ? "" : resourceType;
                              onSearch(newQuery, searchResourceType, fhirSearchParams);
                              setIsAutocompleteOpen(false);
                              // Focus is now handled by onCloseAutoFocus in PopoverContent
                            }}
                          >
                            <Search className="mr-2 h-4 w-4 text-blue-500" />
                            {suggestion.label}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {suggestions.some(s => s.type === 'syntax') && (
                      <div>
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50">
                          Search Syntax
                        </div>
                        {suggestions.filter(s => s.type === 'syntax').map((suggestion, index) => (
                          <button
                            key={`syntax-${index}`}
                            className="w-full flex items-center px-3 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                            onMouseDown={(e) => {
                              // Use onMouseDown instead of onClick to prevent input blur
                              e.preventDefault();
                            }}
                            onClick={() => {
                              const newQuery = suggestion.value;
                              setQuery(newQuery);
                              
                              // Save to search history immediately with the new query
                              if (newQuery.trim()) {
                                const newHistory = [newQuery.trim(), ...searchHistory.filter(h => h !== newQuery.trim())].slice(0, 10);
                                setSearchHistory(newHistory);
                                localStorage.setItem('fhir-search-history', JSON.stringify(newHistory));
                              }
                              
                              // Trigger search with the new query value directly
                              const searchResourceType = resourceType === "all" ? "" : resourceType;
                              onSearch(newQuery, searchResourceType, fhirSearchParams);
                              setIsAutocompleteOpen(false);
                              // Focus is now handled by onCloseAutoFocus in PopoverContent
                            }}
                          >
                            <Zap className="mr-2 h-4 w-4 text-purple-500" />
                            {suggestion.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Button onClick={handleSearch} className="bg-fhir-blue text-white hover:bg-blue-700">
          <Search className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Search</span>
        </Button>
        
        {onFilterChange && (
          <Button 
            variant="outline" 
            onClick={() => {
              const newExpanded = !isFilterExpanded;
              setIsFilterExpanded(newExpanded);
              // Track manual collapse/expand
              if (!newExpanded) {
                setIsManuallyCollapsed(true);
              } else {
                setIsManuallyCollapsed(false);
              }
            }}
            className="relative"
          >
            <ListFilter className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Filters</span>
            {(() => {
              const hasActiveFilters = 
                (resourceType && resourceType !== 'all') || 
                (query && query.trim() !== '') || 
                Object.keys(fhirSearchParams).length > 0;
              
              return (
                <div className="flex items-center ml-1">
                  {hasActiveFilters && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-1" />
                  )}
                  {isFilterExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </div>
              );
            })()}
          </Button>
        )}
      </div>
      
      
      {isFilterExpanded && (
        <div className="mt-4">
          <FilterChipList
            filterOptions={{
              resourceTypes: resourceType && resourceType !== 'all' ? [resourceType] : [],
              search: query || '',
              validationStatus: {},
              fhirSearchParams: fhirSearchParams,
              pagination: { limit: 20, offset: 0 },
              sorting: { field: 'resourceType', direction: 'desc' }
            }}
            availableResourceTypes={resourceTypes}
            onFilterChange={(newFilters) => {
              // Update local state
              if (newFilters.resourceTypes.length > 0) {
                setResourceType(newFilters.resourceTypes[0]);
              }
              if (newFilters.search !== undefined) {
                setQuery(newFilters.search);
              }
              if (newFilters.fhirSearchParams !== undefined) {
                setFhirSearchParams(newFilters.fhirSearchParams);
              }
              
              // Trigger search with FHIR params
              // Use current resourceType state if no resource type in newFilters
              const searchResourceType = newFilters.resourceTypes.length > 0 
                ? newFilters.resourceTypes[0] 
                : resourceType;
              onSearch(newFilters.search || query, searchResourceType, newFilters.fhirSearchParams);
            }}
          />
        </div>
      )}
    </div>
  );
}
