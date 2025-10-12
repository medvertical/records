import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, ListFilter, ChevronDown, ChevronUp, X } from "lucide-react";
import { SeverityIcon } from "@/components/ui/severity-icon";
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
}

interface ResourceSearchProps {
  resourceTypes: string[];
  onSearch: (query: string, resourceType: string) => void;
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

  useEffect(() => {
    setQuery(defaultQuery);
    setResourceType(defaultResourceType);
  }, [defaultQuery, defaultResourceType]);

  const handleSearch = () => {
    // Convert "all" back to empty string for the API
    const searchResourceType = resourceType === "all" ? "" : resourceType;
    onSearch(query, searchResourceType);
  };

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
                onSearch(query, searchResourceType);
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
      
      {/* Expanded Filter Section */}
      {onFilterChange && isFilterExpanded && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="space-y-4">
            {/* Aspect Filters */}


          </div>
        </div>
      )}
      
      {(query || resourceType) && isFilterExpanded && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600">Active filters:</span>
          {query && (
            <span className="bg-blue-50 text-fhir-blue px-2 py-1 rounded-md text-sm">
              Query: "{query}"
            </span>
          )}
          {resourceType && (
            <span className="bg-blue-50 text-fhir-blue px-2 py-1 rounded-md text-sm">
              Type: {resourceType}
            </span>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setQuery("");
              setResourceType("all");
              onSearch("", "");
              if (onFilterChange) {
                onFilterChange({ aspects: [], severities: [], hasIssuesOnly: false, issueFilter: undefined });
              }
            }}
            className="text-xs"
          >
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
}
