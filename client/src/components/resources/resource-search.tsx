import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Filter, ChevronDown, ChevronUp, X } from "lucide-react";
import { SeverityIcon } from "@/components/ui/severity-icon";
import type { SeverityLevel } from "@/components/ui/severity-icon";
import { cn } from "@/lib/utils";

export interface ValidationFilters {
  aspects: string[];
  severities: string[];
  hasIssuesOnly: boolean;
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
    onFilterChange({ aspects: [], severities: [], hasIssuesOnly: false });
  };

  const hasActiveFilters = filters.aspects.length > 0 || filters.severities.length > 0 || filters.hasIssuesOnly;

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
        
        {/* FHIR Version Badge (Task 13.2) */}
        {activeServer?.fhirVersion && (
          <Badge 
            variant="secondary"
            className="text-xs px-2.5 py-1 h-8 font-medium bg-gray-100 text-gray-700 hover:bg-gray-100 whitespace-nowrap"
            title={`FHIR Version ${activeServer.fhirVersion} - ${activeServer.name}`}
          >
            {activeServer.fhirVersion}
          </Badge>
        )}
        
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
            <Filter className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && (
              <Badge variant="destructive" className="ml-2 px-1.5 py-0.5 text-xs">
                {filters.aspects.length + filters.severities.length + (filters.hasIssuesOnly ? 1 : 0)}
              </Badge>
            )}
            {isFilterExpanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
          </Button>
        )}
      </div>
      
      {/* Expanded Filter Section */}
      {onFilterChange && isFilterExpanded && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="space-y-4">
            {/* Aspect Filters */}
            <div className="text-left">
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block text-left">
                Validation Aspects
              </Label>
              <div className="space-y-2">
                {VALIDATION_ASPECTS.map((aspect) => {
                  const stats = validationSummary?.aspectStats?.[aspect.id];
                  return (
                    <div key={aspect.id} className="flex items-center justify-between text-left">
                      <div className="flex items-center space-x-2 text-left">
                        <Checkbox
                          id={`aspect-${aspect.id}`}
                          checked={filters.aspects.includes(aspect.id)}
                          onCheckedChange={() => handleAspectToggle(aspect.id)}
                        />
                        <Label
                          htmlFor={`aspect-${aspect.id}`}
                          className="text-sm font-normal cursor-pointer text-left"
                        >
                          {aspect.label}
                        </Label>
                      </div>
                      {stats && stats.total > 0 && (
                        <div className="flex items-center gap-1">
                          {stats.valid > 0 && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                              ✓ {stats.valid}
                            </Badge>
                          )}
                          {stats.invalid > 0 && (
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                              ✗ {stats.invalid}
                            </Badge>
                          )}
                          {stats.warnings > 0 && (
                            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                              ⚠ {stats.warnings}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Severity Filters */}
            <div className="text-left">
              <Label className="text-sm font-semibold text-gray-700 mb-2 block text-left">
                Severities
              </Label>
              <div className="space-y-2">
                {SEVERITIES.map((severity) => {
                  const stats = validationSummary?.severityStats?.[severity.id];
                  return (
                    <div key={severity.id} className="flex items-center justify-between text-left">
                      <div className="flex items-center space-x-2 text-left">
                        <Checkbox
                          id={`severity-${severity.id}`}
                          checked={filters.severities.includes(severity.id)}
                          onCheckedChange={() => handleSeverityToggle(severity.id)}
                        />
                        <SeverityIcon severity={severity.id as SeverityLevel} className="h-4 w-4" />
                        <Label
                          htmlFor={`severity-${severity.id}`}
                          className="text-sm font-normal cursor-pointer text-left"
                        >
                          {severity.label}
                        </Label>
                      </div>
                      {stats && (stats.count > 0 || stats.resourceCount > 0) && (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {stats.count} issue{stats.count !== 1 ? 's' : ''}
                          </Badge>
                          <Badge variant="outline" className="text-xs text-gray-600">
                            {stats.resourceCount} resource{stats.resourceCount !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Has Issues Only Toggle */}
            <div className="flex items-center space-x-2 text-left">
              <Checkbox
                id="hasIssuesOnly"
                checked={filters.hasIssuesOnly}
                onCheckedChange={(checked) =>
                  onFilterChange({
                    ...filters,
                    hasIssuesOnly: checked as boolean,
                  })
                }
              />
              <Label
                htmlFor="hasIssuesOnly"
                className="text-sm font-normal cursor-pointer text-left"
              >
                Only show resources with validation issues
              </Label>
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                disabled={!hasActiveFilters}
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
              
              {hasActiveFilters && (
                <div className="text-sm text-gray-600">
                  {filters.aspects.length + filters.severities.length + (filters.hasIssuesOnly ? 1 : 0)} active filter{(filters.aspects.length + filters.severities.length + (filters.hasIssuesOnly ? 1 : 0)) !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {(query || resourceType || hasActiveFilters) && (
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
          {filters?.aspects.map((aspectId) => {
            const aspect = VALIDATION_ASPECTS.find(a => a.id === aspectId);
            return aspect ? (
              <Badge key={aspectId} variant="secondary" className="text-xs">
                Aspect: {aspect.label}
              </Badge>
            ) : null;
          })}
          {filters?.severities.map((severityId) => {
            const severity = SEVERITIES.find(s => s.id === severityId);
            return severity ? (
              <Badge key={severityId} variant="secondary" className="text-xs">
                Severity: {severity.label}
              </Badge>
            ) : null;
          })}
          {filters?.hasIssuesOnly && (
            <Badge variant="secondary" className="text-xs">
              Issues Only
            </Badge>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setQuery("");
              setResourceType("all");
              onSearch("", "");
              if (onFilterChange) {
                onFilterChange({ aspects: [], severities: [], hasIssuesOnly: false });
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
