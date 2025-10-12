import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Filter, 
  Search, 
  X, 
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Database,
  AlertTriangle,
  Info,
  CheckCircle,
  SortAsc,
  SortDesc
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// ============================================================================
// Types
// ============================================================================

export interface ResourceFilterOptions {
  resourceTypes: string[];
  validationStatus: {
    hasErrors?: boolean;
    hasWarnings?: boolean;
    hasInformation?: boolean;
    isValid?: boolean;
  };
  search: string;
  pagination: {
    limit: number;
    offset: number;
  };
  sorting: {
    field: 'resourceType' | 'lastValidated' | 'validationScore' | 'errorCount' | 'warningCount';
    direction: 'asc' | 'desc';
  };
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

export interface ResourceFilterStatistics {
  availableResourceTypes: string[];
  validationStatistics: {
    totalResources: number;
    withValidationData: number;
    withoutValidationData: number;
    hasErrors: number;
    hasWarnings: number;
    hasInformation: number;
    isValid: number;
  };
}

interface ResourceFilterControlsProps {
  // Filter values
  filterOptions: ResourceFilterOptions;
  
  // Filter handlers
  onFilterChange: (options: ResourceFilterOptions) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  
  // Statistics
  statistics?: ResourceFilterStatistics;
  
  // Results
  totalCount: number;
  returnedCount: number;
  hasMore: boolean;
  
  // Loading state
  isLoading?: boolean;
  
  // UI state
  isExpanded?: boolean;
  onToggleExpanded?: (expanded: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export function ResourceFilterControls({
  filterOptions,
  onFilterChange,
  onClearFilters,
  onRefresh,
  statistics,
  totalCount,
  returnedCount,
  hasMore,
  isLoading = false,
  isExpanded = true,
  onToggleExpanded
}: ResourceFilterControlsProps) {
  
  const [localSearch, setLocalSearch] = useState(filterOptions.search);
  const [localResourceTypes, setLocalResourceTypes] = useState<string[]>(filterOptions.resourceTypes);
  const [localValidationStatus, setLocalValidationStatus] = useState(filterOptions.validationStatus);
  const [localSorting, setLocalSorting] = useState(filterOptions.sorting);
  const [localPagination, setLocalPagination] = useState(filterOptions.pagination);

  // Update local state when filterOptions change
  useEffect(() => {
    setLocalSearch(filterOptions.search);
    setLocalResourceTypes(filterOptions.resourceTypes);
    setLocalValidationStatus(filterOptions.validationStatus);
    setLocalSorting(filterOptions.sorting);
    setLocalPagination(filterOptions.pagination);
  }, [filterOptions]);

  const hasActiveFilters = localResourceTypes.length > 0 || 
                          (localValidationStatus && typeof localValidationStatus === 'object' && Object.values(localValidationStatus).some(Boolean)) || 
                          localSearch !== '' ||
                          localSorting.field !== 'lastValidated' ||
                          localSorting.direction !== 'desc';

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    onFilterChange({
      ...filterOptions,
      search: value,
      pagination: { ...localPagination, offset: 0 } // Reset to first page
    });
  };

  const handleResourceTypeChange = (resourceType: string, checked: boolean) => {
    const newResourceTypes = checked 
      ? [...localResourceTypes, resourceType]
      : localResourceTypes.filter(type => type !== resourceType);
    
    setLocalResourceTypes(newResourceTypes);
    onFilterChange({
      ...filterOptions,
      resourceTypes: newResourceTypes,
      pagination: { ...localPagination, offset: 0 } // Reset to first page
    });
  };

  const handleValidationStatusChange = (status: keyof ResourceFilterOptions['validationStatus'], checked: boolean) => {
    const newValidationStatus = { ...localValidationStatus, [status]: checked };
    setLocalValidationStatus(newValidationStatus);
    onFilterChange({
      ...filterOptions,
      validationStatus: newValidationStatus,
      pagination: { ...localPagination, offset: 0 } // Reset to first page
    });
  };

  const handleSortingChange = (field: ResourceFilterOptions['sorting']['field']) => {
    const newDirection = localSorting.field === field && localSorting.direction === 'asc' ? 'desc' : 'asc';
    const newSorting = { field, direction: newDirection };
    setLocalSorting(newSorting);
    onFilterChange({
      ...filterOptions,
      sorting: newSorting
    });
  };

  const handlePaginationChange = (newOffset: number) => {
    const newPagination = { ...localPagination, offset: newOffset };
    setLocalPagination(newPagination);
    onFilterChange({
      ...filterOptions,
      pagination: newPagination
    });
  };

  const handleClearFilters = () => {
    setLocalSearch('');
    setLocalResourceTypes([]);
    setLocalValidationStatus({});
    setLocalSorting({ field: 'lastValidated', direction: 'desc' });
    setLocalPagination({ limit: 50, offset: 0 });
    onClearFilters();
  };

  const getSortIcon = (field: ResourceFilterOptions['sorting']['field']) => {
    if (localSorting.field !== field) return null;
    return localSorting.direction === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />;
  };

  const getValidationStatusCount = (status: keyof ResourceFilterStatistics['validationStatistics']) => {
    return statistics?.validationStatistics[status] || 0;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-600" />
          <span className="font-semibold text-gray-900">Resource Filters</span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-2">
              Active
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
          
          {onToggleExpanded && (
            <Collapsible open={isExpanded} onOpenChange={onToggleExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          )}
        </div>
      </div>

      <Collapsible open={isExpanded} onOpenChange={onToggleExpanded}>
        <CollapsibleContent>
          <div className="p-4 space-y-4">
            {/* Search Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Search Resources</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by resource ID, type, or content..."
                  value={localSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 pr-10"
                />
                {localSearch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSearchChange('')}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Resource Types Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Resource Types</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                {statistics?.availableResourceTypes.map((resourceType) => (
                  <div key={resourceType} className="flex items-center space-x-2">
                    <Checkbox
                      id={`resource-type-${resourceType}`}
                      checked={localResourceTypes.includes(resourceType)}
                      onCheckedChange={(checked) => handleResourceTypeChange(resourceType, checked as boolean)}
                    />
                    <label
                      htmlFor={`resource-type-${resourceType}`}
                      className="text-sm text-gray-700 cursor-pointer"
                    >
                      {resourceType}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Validation Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Validation Status</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has-errors"
                    checked={localValidationStatus.hasErrors || false}
                    onCheckedChange={(checked) => handleValidationStatusChange('hasErrors', checked as boolean)}
                  />
                  <label htmlFor="has-errors" className="text-sm text-gray-700 cursor-pointer flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Errors ({getValidationStatusCount('hasErrors')})
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has-warnings"
                    checked={localValidationStatus.hasWarnings || false}
                    onCheckedChange={(checked) => handleValidationStatusChange('hasWarnings', checked as boolean)}
                  />
                  <label htmlFor="has-warnings" className="text-sm text-gray-700 cursor-pointer flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Warnings ({getValidationStatusCount('hasWarnings')})
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has-information"
                    checked={localValidationStatus.hasInformation || false}
                    onCheckedChange={(checked) => handleValidationStatusChange('hasInformation', checked as boolean)}
                  />
                  <label htmlFor="has-information" className="text-sm text-gray-700 cursor-pointer flex items-center gap-1">
                    <Info className="h-4 w-4 text-blue-500" />
                    Information ({getValidationStatusCount('hasInformation')})
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is-valid"
                    checked={localValidationStatus.isValid || false}
                    onCheckedChange={(checked) => handleValidationStatusChange('isValid', checked as boolean)}
                  />
                  <label htmlFor="is-valid" className="text-sm text-gray-700 cursor-pointer flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Valid ({getValidationStatusCount('isValid')})
                  </label>
                </div>
              </div>
            </div>

            {/* Sorting */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Sort By</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { field: 'lastValidated' as const, label: 'Last Validated' },
                  { field: 'resourceType' as const, label: 'Resource Type' },
                  { field: 'validationScore' as const, label: 'Validation Score' },
                  { field: 'errorCount' as const, label: 'Error Count' },
                  { field: 'warningCount' as const, label: 'Warning Count' }
                ].map(({ field, label }) => (
                  <Button
                    key={field}
                    variant={localSorting.field === field ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSortingChange(field)}
                    className="flex items-center gap-1"
                  >
                    {label}
                    {getSortIcon(field)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Show:</label>
                <Select
                  value={localPagination.limit.toString()}
                  onValueChange={(value) => {
                    const newPagination = { ...localPagination, limit: parseInt(value), offset: 0 };
                    setLocalPagination(newPagination);
                    onFilterChange({ ...filterOptions, pagination: newPagination });
                  }}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-600">per page</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePaginationChange(Math.max(0, localPagination.offset - localPagination.limit))}
                  disabled={localPagination.offset === 0}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  {localPagination.offset + 1}-{Math.min(localPagination.offset + localPagination.limit, totalCount)} of {totalCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePaginationChange(localPagination.offset + localPagination.limit)}
                  disabled={!hasMore}
                >
                  Next
                </Button>
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <div className="flex justify-end">
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
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-gray-600">
              Showing {returnedCount} of {totalCount} resources
            </span>
            {statistics && (
              <span className="text-gray-500">
                <Database className="h-4 w-4 inline mr-1" />
                {statistics.validationStatistics.totalResources} total resources
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <Badge variant="outline" className="text-blue-600 border-blue-200">
              Filters Active
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
