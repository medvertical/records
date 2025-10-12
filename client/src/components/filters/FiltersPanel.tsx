import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  Filter, 
  Search, 
  X, 
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';

// ============================================================================
// Types - Per PRD requirements
// ============================================================================

export type ValidationAspect = 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata';
export type ValidationSeverity = 'error' | 'warning' | 'information';

export interface FilterOptions {
  // Aspect multi-select
  aspects: ValidationAspect[];
  
  // Severity multi-select
  severities: ValidationSeverity[];
  
  // Code typeahead (error codes)
  code?: string;
  
  // Path input (canonical FHIR paths)
  path?: string;
  
  // Has-issues toggle (resources with validation issues)
  hasIssues?: boolean;
  
  // Unvalidated toggle (resources not yet validated)
  unvalidated?: boolean;
  
  // Resource type selector
  resourceType?: string;
  
  // Pagination
  page: number;
  pageSize: number;
}

export interface FilterStatistics {
  availableResourceTypes: string[];
  availableCodes: string[]; // For code typeahead
  totalResources: number;
  withIssues: number;
  withoutIssues: number;
  unvalidated: number;
}

interface FiltersPanelProps {
  filters: FilterOptions;
  onChange: (filters: FilterOptions) => void;
  onRefresh: () => void;
  statistics?: FilterStatistics;
  isLoading?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const ASPECTS: { value: ValidationAspect; label: string }[] = [
  { value: 'structural', label: 'Structural' },
  { value: 'profile', label: 'Profile' },
  { value: 'terminology', label: 'Terminology' },
  { value: 'reference', label: 'Reference' },
  { value: 'businessRule', label: 'Business Rules' },
  { value: 'metadata', label: 'Metadata' },
];

const SEVERITIES: { value: ValidationSeverity; label: string; color: string }[] = [
  { value: 'error', label: 'Error', color: 'text-red-600' },
  { value: 'warning', label: 'Warning', color: 'text-yellow-600' },
  { value: 'information', label: 'Information', color: 'text-blue-600' },
];

// ============================================================================
// Component
// ============================================================================

export function FiltersPanel({
  filters,
  onChange,
  onRefresh,
  statistics,
  isLoading = false,
}: FiltersPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [codeSearch, setCodeSearch] = useState(filters.code || '');
  const [pathSearch, setPathSearch] = useState(filters.path || '');
  const [codePopoverOpen, setCodePopoverOpen] = useState(false);

  // Sync local state with external filters
  useEffect(() => {
    setCodeSearch(filters.code || '');
    setPathSearch(filters.path || '');
  }, [filters.code, filters.path]);

  const hasActiveFilters = 
    filters.aspects.length > 0 ||
    filters.severities.length > 0 ||
    filters.code ||
    filters.path ||
    filters.hasIssues !== undefined ||
    filters.unvalidated !== undefined ||
    filters.resourceType;

  const handleAspectToggle = (aspect: ValidationAspect) => {
    const newAspects = filters.aspects.includes(aspect)
      ? filters.aspects.filter(a => a !== aspect)
      : [...filters.aspects, aspect];
    
    onChange({
      ...filters,
      aspects: newAspects,
      page: 1, // Reset to first page
    });
  };

  const handleSeverityToggle = (severity: ValidationSeverity) => {
    const newSeverities = filters.severities.includes(severity)
      ? filters.severities.filter(s => s !== severity)
      : [...filters.severities, severity];
    
    onChange({
      ...filters,
      severities: newSeverities,
      page: 1,
    });
  };

  const handleCodeChange = useCallback((value: string) => {
    setCodeSearch(value);
    onChange({
      ...filters,
      code: value || undefined,
      page: 1,
    });
    setCodePopoverOpen(false);
  }, [filters, onChange]);

  const handlePathChange = (value: string) => {
    setPathSearch(value);
    onChange({
      ...filters,
      path: value || undefined,
      page: 1,
    });
  };

  const handleResourceTypeChange = (value: string) => {
    onChange({
      ...filters,
      resourceType: value || undefined,
      page: 1,
    });
  };

  const handleClearFilters = () => {
    setCodeSearch('');
    setPathSearch('');
    onChange({
      aspects: [],
      severities: [],
      code: undefined,
      path: undefined,
      hasIssues: undefined,
      unvalidated: undefined,
      resourceType: undefined,
      page: 1,
      pageSize: filters.pageSize,
    });
  };

  // Filter codes based on search input
  const filteredCodes = statistics?.availableCodes.filter(code =>
    code.toLowerCase().includes(codeSearch.toLowerCase())
  ) || [];

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-600" />
          <span className="font-semibold text-gray-900">Validation Filters</span>
          {hasActiveFilters && filters && typeof filters === 'object' && (
            <Badge variant="secondary" className="ml-2">
              {Object.values(filters).filter(v => 
                Array.isArray(v) ? v.length > 0 : v !== undefined && v !== false
              ).length} active
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="text-gray-600 hover:text-gray-900"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </div>

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <div className="p-4 space-y-4">
            {/* Resource Type Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Resource Type</Label>
              <div className="flex gap-2">
                <select
                  value={filters.resourceType || ''}
                  onChange={(e) => handleResourceTypeChange(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  {statistics?.availableResourceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {filters.resourceType && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResourceTypeChange('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Aspect Multi-Select */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Validation Aspects</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {ASPECTS.map(({ value, label }) => (
                  <div key={value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`aspect-${value}`}
                      checked={filters.aspects.includes(value)}
                      onCheckedChange={() => handleAspectToggle(value)}
                    />
                    <Label
                      htmlFor={`aspect-${value}`}
                      className="text-sm text-gray-700 cursor-pointer font-normal"
                    >
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Severity Multi-Select */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Severity Levels</Label>
              <div className="grid grid-cols-3 gap-3">
                {SEVERITIES.map(({ value, label, color }) => (
                  <div key={value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`severity-${value}`}
                      checked={filters.severities.includes(value)}
                      onCheckedChange={() => handleSeverityToggle(value)}
                    />
                    <Label
                      htmlFor={`severity-${value}`}
                      className={`text-sm cursor-pointer font-normal ${color}`}
                    >
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Code Typeahead */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Error Code</Label>
              <Popover open={codePopoverOpen} onOpenChange={setCodePopoverOpen}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Filter by error code..."
                      value={codeSearch}
                      onChange={(e) => setCodeSearch(e.target.value)}
                      onFocus={() => setCodePopoverOpen(true)}
                      className="pl-10 pr-10"
                    />
                    {codeSearch && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCodeChange('')}
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[300px]" align="start">
                  <Command>
                    <CommandInput placeholder="Search codes..." value={codeSearch} onValueChange={setCodeSearch} />
                    <CommandList>
                      <CommandEmpty>No codes found.</CommandEmpty>
                      <CommandGroup>
                        {filteredCodes.slice(0, 10).map((code) => (
                          <CommandItem
                            key={code}
                            value={code}
                            onSelect={() => handleCodeChange(code)}
                          >
                            {code}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Path Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Canonical Path</Label>
              <div className="relative">
                <Input
                  placeholder="e.g., patient.name, entry.item.code"
                  value={pathSearch}
                  onChange={(e) => handlePathChange(e.target.value)}
                  className="pr-10"
                />
                {pathSearch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePathChange('')}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Has Issues Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="has-issues" className="text-sm font-medium text-gray-700">
                Has Validation Issues
              </Label>
              <Switch
                id="has-issues"
                checked={filters.hasIssues || false}
                onCheckedChange={(checked) => onChange({
                  ...filters,
                  hasIssues: checked ? true : undefined,
                  page: 1,
                })}
              />
            </div>

            {/* Unvalidated Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="unvalidated" className="text-sm font-medium text-gray-700">
                Unvalidated Resources
              </Label>
              <Switch
                id="unvalidated"
                checked={filters.unvalidated || false}
                onCheckedChange={(checked) => onChange({
                  ...filters,
                  unvalidated: checked ? true : undefined,
                  page: 1,
                })}
              />
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <div className="flex justify-end pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear All Filters
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Results Summary */}
      {statistics && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4 text-gray-600">
              <span>{statistics.totalResources} total resources</span>
              {statistics.withIssues > 0 && (
                <span className="text-yellow-600">{statistics.withIssues} with issues</span>
              )}
              {statistics.unvalidated > 0 && (
                <span className="text-gray-500">{statistics.unvalidated} unvalidated</span>
              )}
            </div>
            {hasActiveFilters && (
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                Filters Active
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
