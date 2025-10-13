import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, ListFilter, ChevronDown, ChevronUp, X } from "lucide-react";
import { SeverityIcon } from "@/components/ui/severity-icon";
import { FilterChipList } from "@/components/filters/FilterChipList";
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
  const [fhirSearchParams, setFhirSearchParams] = useState<Record<string, { value: string | string[]; operator?: string }>>({});

  useEffect(() => {
    setQuery(defaultQuery);
    setResourceType(defaultResourceType);
  }, [defaultQuery, defaultResourceType]);

  // Initialize FHIR search parameters from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fhirParams: Record<string, { value: string | string[]; operator?: string }> = {};
    
    params.forEach((value, key) => {
      // Skip known params like 'type', 'search', etc.
      if (!['type', 'search', 'page', 'limit'].includes(key)) {
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
    // Convert "all" back to empty string for the API
    const searchResourceType = resourceType === "all" ? "" : resourceType;
    onSearch(query, searchResourceType, fhirSearchParams);
  }, [query, resourceType, fhirSearchParams, onSearch]);

  // Auto-expand filters when there are active filters
  useEffect(() => {
    const hasActiveFilters = 
      (resourceType && resourceType !== 'all') || // Has specific resource type
      (query && query.trim() !== '') || // Has search query
      Object.keys(fhirSearchParams).length > 0; // Has FHIR search parameters
    
    if (hasActiveFilters && !isFilterExpanded) {
      setIsFilterExpanded(true);
    }
  }, [resourceType, query, fhirSearchParams, isFilterExpanded]);

  // Note: Auto-search removed to prevent infinite loops
  // The query will re-run automatically when validationFilters.fhirSearchParams changes
  // due to the query key dependency in resource-browser.tsx

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
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
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search resources by ID, name, or content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyPress}
            className="pl-10"
          />
        </div>
        
        <Select 
              value={resourceType || "all"} 
              onValueChange={(value) => {
                setResourceType(value);
                // Convert "all" back to empty string for the API
                const searchResourceType = value === "all" ? "" : value;
                onSearch(query, searchResourceType, fhirSearchParams);
              }}
            >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Resource Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resource Types</SelectItem>
            {resourceTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        

        <Button onClick={handleSearch} className="bg-fhir-blue text-white hover:bg-blue-700">
          <Search className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Search</span>
        </Button>
        
        {onFilterChange && (
          <Button 
            variant="outline" 
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            className="relative"
          >
            <ListFilter className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Filters</span>
            {isFilterExpanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
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
