import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useServerData } from "@/hooks/use-server-data";
import { useValidationSettingsPolling } from "@/hooks/use-validation-settings-polling";
import ResourceSearch, { type ValidationFilters } from "@/components/resources/resource-search";
import ResourceList from "@/components/resources/resource-list";
import { ValidationOverview } from "@/components/resources/validation-overview";
import { ValidationMessagesCard } from "@/components/validation/validation-messages-card";
import { BatchEditDialog } from "@/components/resources/BatchEditDialog";
import { ResourceListSkeleton } from "@/components/resources/resource-list-skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useValidationActivity } from "@/contexts/validation-activity-context";
import { useGroupNavigation } from "@/hooks/use-group-navigation";
import { CheckSquare, Edit2, X } from "lucide-react";

// Import extracted hooks and utilities
import { validatedResourcesCache } from "@/lib/validation-cache";
import { calculateValidationSummaryWithStats } from "@/lib/validation-summary-calculator";
import { useResourceBrowserState } from "@/hooks/use-resource-browser-state";
import { useBatchEdit } from "@/hooks/use-batch-edit";
import { useMessageNavigation } from "@/hooks/use-message-navigation";
import { useUrlSync } from "@/hooks/use-url-sync";
import { useResourceDataFetching } from "@/hooks/use-resource-data-fetching";
import { useValidationOrchestrator } from "@/hooks/use-validation-orchestrator";

export default function ResourceBrowser() {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeServer } = useServerData();
  
  // Core state from extracted hook
  const browserState = useResourceBrowserState();
  const {
    resourceType,
    setResourceType,
    searchQuery,
    setSearchQuery,
    page,
    setPage,
    pageSize,
    setPageSize,
    sort,
    setSort,
    validationFilters,
    setValidationFilters
  } = browserState;

  // Use validation settings polling
  const { lastChange, isPolling, error: pollingError } = useValidationSettingsPolling({
    pollingInterval: 60000,
    enabled: true,
    showNotifications: false,
    invalidateCache: true,
  });

  // Batch edit functionality from extracted hook
  const batchEdit = useBatchEdit();
  const {
    selectionMode,
    selectedResources,
    batchEditDialogOpen,
    toggleSelectionMode,
    handleSelectionChange,
    handleBatchEdit,
    handleBatchEditComplete
  } = batchEdit;

  // Data fetching from extracted hook
  const dataFetching = useResourceDataFetching({
    resourceType,
    searchQuery,
    page,
    pageSize,
    sort,
    location,
    validationFilters,
    activeServer
  });
  
  const {
    resourcesData,
    isLoading,
    error,
    resourceTypesData,
    enrichedResources,
    validationMessagesData,
    isLoadingMessages,
    validationMessagesError
  } = dataFetching;

  // Validation orchestrator from extracted hook
  const validation = useValidationOrchestrator({
    resourcesData,
    resourceType,
    page,
    lastChange,
    queryClient
  });
  
  const {
    isValidating,
    validatingResourceIds,
    validationProgress,
    hasValidatedCurrentPage,
    validateCurrentPage,
    handleRevalidate
  } = validation;

  // Message navigation from extracted hook
  const messageNav = useMessageNavigation({
    validationMessagesData,
    validationFilters
  });
  
  const {
    isMessagesVisible,
    setIsMessagesVisible,
    currentMessageIndex,
    aggregatedMessages,
    currentSeverity,
    messagesByAspect,
    handleNextMessage,
    handlePreviousMessage,
    handleSeverityChange,
    handleToggleMessages,
    handleNavigateToResource,
    handleFilterBySeverity,
    handleFilterByAspect
  } = messageNav;

  // URL synchronization from extracted hook
  useUrlSync({
    location,
    setResourceType,
    setSearchQuery,
    setPage,
    setPageSize,
    setSort,
    setValidationFilters,
    resourceType,
    searchQuery,
    page,
    pageSize,
    sort
  });

  // Group navigation setup
  const { 
    setCurrentGroup, 
    setGroupItems,
    clearGroup
  } = useGroupNavigation();

  // Update group navigation when resources change
  useEffect(() => {
    if (resourcesData?.resources) {
      setGroupItems(resourcesData.resources.map((r: any) => ({
        id: r.id,
        type: r.resourceType
      })));
      setCurrentGroup('resource-list');
    } else {
      clearGroup();
    }
  }, [resourcesData?.resources, setGroupItems, setCurrentGroup, clearGroup]);

  // Calculate validation summary with stats
  const validationSummaryWithStats = calculateValidationSummaryWithStats(
    enrichedResources,
    null // currentSettings - we can pass this if needed
  );

  // Handle search
  const handleSearch = useCallback((query: string, type: string, fhirParams?: Record<string, { value: string | string[]; operator?: string }>, sortParam?: string) => {
    const finalSort = sortParam || sort;
    
    setSearchQuery(query);
    setResourceType(type);
    setPage(0);
    setSort(finalSort);
    
    // Handle FHIR search parameters
    if (fhirParams && Object.keys(fhirParams).length > 0) {
      setValidationFilters(prev => ({
        ...prev,
        fhirSearchParams: fhirParams
      }));
    } else {
      // Clear FHIR search params if none provided
      setValidationFilters(prev => {
        const { fhirSearchParams, ...rest } = prev;
        return rest;
      });
    }

    // Update URL
    const urlParams = new URLSearchParams();
    if (type && type !== "all") urlParams.set('resourceType', type);
    if (query) urlParams.set('search', query);
    if (finalSort) urlParams.set('sort', finalSort);
    urlParams.set('page', '1');
    urlParams.set('pageSize', String(pageSize));
    
    // Add FHIR search params to URL
    if (fhirParams && Object.keys(fhirParams).length > 0) {
      Object.entries(fhirParams).forEach(([key, config]) => {
        if (config.value) {
          const paramKey = config.operator ? `${key}:${config.operator}` : key;
          const value = Array.isArray(config.value) ? config.value.join(',') : config.value;
          urlParams.set(paramKey, value);
        }
      });
    }
    
    window.history.pushState({}, '', `?${urlParams.toString()}`);
  }, [sort, setSearchQuery, setResourceType, setPage, setSort, pageSize, setValidationFilters]);

  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    // Update URL
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('page', String(newPage + 1)); // 1-based in URL
    window.history.pushState({}, '', `?${urlParams.toString()}`);
  }, [setPage]);

  // Handle page size change
  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(0);
    // Update URL
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('pageSize', String(newSize));
    urlParams.set('page', '1');
    window.history.pushState({}, '', `?${urlParams.toString()}`);
  }, [setPageSize, setPage]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: ValidationFilters) => {
    setValidationFilters(newFilters);
    setPage(0);
    
    // Update URL with new filters
    const urlParams = new URLSearchParams(window.location.search);
    if (resourceType && resourceType !== "all") {
      urlParams.set('resourceType', resourceType);
    }
    if (searchQuery) {
      urlParams.set('search', searchQuery);
    }
    if (newFilters.aspects.length > 0) {
      urlParams.set('aspects', newFilters.aspects.join(','));
    } else {
      urlParams.delete('aspects');
    }
    if (newFilters.severities.length > 0) {
      urlParams.set('severities', newFilters.severities.join(','));
    } else {
      urlParams.delete('severities');
    }
    if (newFilters.hasIssuesOnly) {
      urlParams.set('hasIssues', 'true');
    } else {
      urlParams.delete('hasIssues');
    }
    
    urlParams.set('page', '1');
    window.history.pushState({}, '', `?${urlParams.toString()}`);
  }, [resourceType, searchQuery, setValidationFilters, setPage]);

  // Render
  return (
    <div className="flex flex-col h-full">
      {/* Search header */}
      <div className="p-4 border-b bg-white sticky top-0 z-10">
        <ResourceSearch
          resourceTypes={resourceTypesData || []}
          onSearch={handleSearch}
          initialQuery={searchQuery}
          initialType={resourceType}
          validationFilters={validationFilters}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          {/* Validation Overview */}
          {!isLoading && resourcesData?.resources && resourcesData.resources.length > 0 && (
            <div className="mb-4">
              <ValidationOverview
                summary={validationSummaryWithStats}
                onFilterBySeverity={handleFilterBySeverity}
                onFilterByAspect={handleFilterByAspect}
                onRevalidate={handleRevalidate}
                isValidating={isValidating}
              />
            </div>
          )}

          {/* Validation Messages Card */}
          {isMessagesVisible && messagesByAspect.length > 0 && (
            <div className="mb-4">
              <ValidationMessagesCard
                messages={messagesByAspect}
                currentSeverity={currentSeverity}
                onSeverityChange={handleSeverityChange}
                onClose={handleToggleMessages}
                onNavigateToResource={handleNavigateToResource}
              />
            </div>
          )}

          {/* Selection Mode Toolbar */}
          {selectionMode && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="secondary">{selectedResources.size} selected</Badge>
                <Button
                  onClick={handleBatchEdit}
                  disabled={selectedResources.size === 0}
                  size="sm"
                  variant="default"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Selected
                </Button>
              </div>
              <Button
                onClick={toggleSelectionMode}
                size="sm"
                variant="ghost"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel Selection
              </Button>
            </div>
          )}

          {/* Batch Edit Button */}
          {!selectionMode && resourcesData?.resources && resourcesData.resources.length > 0 && (
            <div className="mb-4">
              <Button
                onClick={toggleSelectionMode}
                size="sm"
                variant="outline"
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Select Resources
              </Button>
            </div>
          )}

          {/* Resource List */}
          {isLoading ? (
            <ResourceListSkeleton />
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              Error loading resources: {error.message}
            </div>
          ) : resourcesData?.resources && resourcesData.resources.length > 0 ? (
            <ResourceList
              resources={enrichedResources || []}
              total={resourcesData.total || 0}
              page={page}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              validatingResourceIds={validatingResourceIds}
              validationProgress={validationProgress}
              selectionMode={selectionMode}
              selectedResources={selectedResources}
              onSelectionChange={handleSelectionChange}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              No resources found
            </div>
          )}
        </div>
      </div>

      {/* Batch Edit Dialog */}
      <BatchEditDialog
        open={batchEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleBatchEditComplete();
          }
        }}
        selectedResourceIds={Array.from(selectedResources)}
        onComplete={handleBatchEditComplete}
      />
    </div>
  );
}

