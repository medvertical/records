import React from 'react';
import { ResourceFilterControls, type ResourceFilterOptions } from './resource-filter-controls';
import { useResourceFiltering } from '@/hooks/useResourceFiltering';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Database, 
  AlertTriangle, 
  Info, 
  CheckCircle, 
  ExternalLink,
  Loader2,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { getShortId } from "@/lib/resource-utils";

// ============================================================================
// Types
// ============================================================================

interface FilteredResourceListProps {
  onResourceSelect?: (resource: any) => void;
  showFilters?: boolean;
  initialFilters?: Partial<ResourceFilterOptions>;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function FilteredResourceList({
  onResourceSelect,
  showFilters = true,
  initialFilters = {},
  className = ''
}: FilteredResourceListProps) {
  
  const {
    resources,
    statistics,
    totalCount,
    returnedCount,
    hasMore,
    filterSummary,
    isLoading,
    error,
    filterOptions,
    setFilterOptions,
    clearFilters,
    refresh,
    loadMore,
    isExpanded,
    toggleExpanded
  } = useResourceFiltering({
    initialFilters,
    autoLoad: true
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const getValidationStatusIcon = (resource: any) => {
    const validation = resource._validation;
    if (!validation || !validation.hasValidationData) {
      return <Database className="h-4 w-4 text-gray-400" />;
    }
    
    if (validation.errorCount > 0) {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    if (validation.warningCount > 0) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    if (validation.informationCount > 0) {
      return <Info className="h-4 w-4 text-blue-500" />;
    }
    if (validation.isValid) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    return <Database className="h-4 w-4 text-gray-400" />;
  };

  const getValidationStatusBadge = (resource: any) => {
    const validation = resource._validation;
    if (!validation || !validation.hasValidationData) {
      return <Badge variant="outline" className="text-gray-500">Not Validated</Badge>;
    }
    
    if (validation.errorCount > 0) {
      return (
        <div className="flex items-center gap-2">
          {/* Error column */}
          <div className="flex flex-col items-center min-w-[3rem]">
            <Badge className="bg-red-50 text-fhir-error border-red-200">
              <XCircle className="h-3 w-3 mr-1" />
              {validation.errorCount}
            </Badge>
          </div>
          
          {/* Warning column */}
          <div className="flex flex-col items-center min-w-[3rem]">
            {validation.warningCount > 0 && (
              <Badge className="bg-orange-50 text-fhir-warning border-orange-200 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {validation.warningCount}
              </Badge>
            )}
          </div>
          
          {/* Info column */}
          <div className="flex flex-col items-center min-w-[3rem]">
            {validation.informationCount > 0 && (
              <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-xs">
                <Info className="h-3 w-3 mr-1" />
                {validation.informationCount}
              </Badge>
            )}
          </div>
        </div>
      );
    }
    if (validation.warningCount > 0) {
      return (
        <div className="flex items-center gap-2">
          {/* Error column - empty placeholder for alignment */}
          <div className="flex flex-col items-center min-w-[3rem]">
          </div>
          
          {/* Warning column */}
          <div className="flex flex-col items-center min-w-[3rem]">
            <Badge className="bg-orange-50 text-fhir-warning border-orange-200">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {validation.warningCount}
            </Badge>
          </div>
          
          {/* Info column */}
          <div className="flex flex-col items-center min-w-[3rem]">
            {validation.informationCount > 0 && (
              <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-xs">
                <Info className="h-3 w-3 mr-1" />
                {validation.informationCount}
              </Badge>
            )}
          </div>
        </div>
      );
    }
    if (validation.informationCount > 0) {
      return (
        <div className="flex items-center gap-2">
          {/* Error column - empty placeholder for alignment */}
          <div className="flex flex-col items-center min-w-[3rem]">
          </div>
          
          {/* Warning column - empty placeholder for alignment */}
          <div className="flex flex-col items-center min-w-[3rem]">
          </div>
          
          {/* Info column */}
          <div className="flex flex-col items-center min-w-[3rem]">
            <Badge className="bg-blue-50 text-blue-600 border-blue-200">
              <Info className="h-3 w-3 mr-1" />
              {validation.informationCount}
            </Badge>
          </div>
        </div>
      );
    }
    if (validation.isValid) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800">Valid</Badge>;
    }
    
    return <Badge variant="outline" className="text-gray-500">Unknown</Badge>;
  };

  const formatLastValidated = (lastValidated: Date | null) => {
    if (!lastValidated) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - lastValidated.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Filter Controls */}
      {showFilters && (
        <ResourceFilterControls
          filterOptions={filterOptions}
          onFilterChange={setFilterOptions}
          onClearFilters={clearFilters}
          onRefresh={refresh}
          statistics={statistics}
          totalCount={totalCount}
          returnedCount={returnedCount}
          hasMore={hasMore}
          isLoading={isLoading}
          isExpanded={isExpanded}
          onToggleExpanded={toggleExpanded}
        />
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              className="ml-2"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && resources.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && resources.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Resources Found</h3>
            <p className="text-gray-600 mb-4">
              {totalCount === 0 
                ? "No resources are available in the system."
                : "No resources match your current filter criteria."
              }
            </p>
            {totalCount > 0 && (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resource List */}
      {!isLoading && !error && resources.length > 0 && (
        <div className="space-y-2">
          {resources.map((resource, index) => (
            <Card 
              key={`${resource.resourceType}-${resource.id}-${index}`}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onResourceSelect?.(resource)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    {/* Validation Status Icon */}
                    <div className="flex-shrink-0">
                      {getValidationStatusIcon(resource)}
                    </div>
                    
                    {/* Resource Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {resource.resourceType}
                        </Badge>
                        <span className="font-medium text-gray-900 truncate">
                          {getShortId(resource.id)}
                        </span>
                      </div>
                      
                      {/* Validation Details */}
                      {resource._validation && resource._validation.hasValidationData && (
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>Score: {resource._validation.validationScore}%</span>
                          <span>Last validated: {formatLastValidated(resource._validation.lastValidated)}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Validation Status Badge */}
                    <div className="flex-shrink-0">
                      {getValidationStatusBadge(resource)}
                    </div>
                    
                    {/* External Link Icon */}
                    <div className="flex-shrink-0">
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Load More Button */}
      {!isLoading && !error && hasMore && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}

      {/* Results Summary */}
      {!isLoading && !error && resources.length > 0 && (
        <div className="text-center text-sm text-gray-600">
          Showing {returnedCount} of {totalCount} resources
          {filterSummary && (
            <span className="ml-2">
              • {filterSummary.totalMatching} match your filters
            </span>
          )}
        </div>
      )}
    </div>
  );
}
