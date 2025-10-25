import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useServerData } from "@/hooks/use-server-data";
import { useValidationSettingsPolling } from "@/hooks/use-validation-settings-polling";
import ResourceSearch, { type ValidationFilters } from "@/components/resources/resource-search";
import ResourceList from "@/components/resources/resource-list";
import { ValidationOverview } from "@/components/resources/validation-overview";
import { ValidationMessagesPerAspect } from "@/components/validation/validation-messages-per-aspect";
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
  const { settings: validationSettingsData, lastChange, isPolling, error: pollingError } = useValidationSettingsPolling({
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
  const dataFetching = useResourceDataFetching(
    resourceType,
    searchQuery,
    page,
    pageSize,
    sort,
    location,
    validationFilters,
    validationSettingsData
  );
  
  const {
    resourcesData,
    isLoading,
    error,
    resourceTypes,
    enrichedResources,
    validationMessagesData,
    isLoadingMessages,
    validationMessagesError
  } = dataFetching;

  // Validation orchestrator from extracted hook
  const {
    validateCurrentPage,
    validateUnvalidatedResources,
    handleRevalidate,
    handleFilterChange
  } = useValidationOrchestrator(
    browserState,
    resourcesData,
    validationSettingsData,
    resourceType,
    searchQuery,
    page
  );
  
  // Get validation state from browserState (not from orchestrator)
  const { 
    isValidating,
    validatingResourceIds,
    validationProgress,
    hasValidatedCurrentPage
  } = browserState;

  // Message navigation from extracted hook
  const messageNav = useMessageNavigation(
    validationMessagesData,
    resourcesData,
    validationFilters,
    handleFilterChange
  );
  
  const {
        isMessagesVisible,
    setIsMessagesVisible,
        currentMessageIndex,
    aggregatedMessages,
    currentSeverity,
    currentSeverityIndex,
    allMessages,
    messagesByAspect,
    handleMessageIndexChange,
    handleSeverityChange,
    handleSeverityIndexChange,
    handleToggleMessages,
    handleFilterBySeverity
  } = messageNav;

  // URL synchronization from extracted hook
  const { handleSearch, handlePageChange, handlePageSizeChange } = useUrlSync(
    browserState,
    location
  );

  // Group navigation setup
  const { 
    navigateToResourceDetail,
    buildGroupMembersUrl
  } = useGroupNavigation();

  // Handle severity badge click from resource cards
  const handleSeverityBadgeClick = useCallback((severity: 'error' | 'warning' | 'information') => {
    // Change to the clicked severity
    handleSeverityChange(severity);
    // Open the messages panel if it's not already open
    if (!isMessagesVisible) {
      handleToggleMessages();
    }
  }, [handleSeverityChange, isMessagesVisible, handleToggleMessages]);

  // Calculate validation summary with stats
  const validationSummaryWithStats = calculateValidationSummaryWithStats(
    enrichedResources,
    validationSettingsData
  ) || {
        totalResources: 0,
        validatedCount: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        aspectStats: {},
    severityStats: {}
  };

  // Now render the UI

  // Render
  return (
    <div className="flex flex-col h-full">
      {/* Search header */}
      <div className="p-4 border-b bg-white sticky top-0 z-10">
        <ResourceSearch 
          resourceTypes={resourceTypes || []}
          onSearch={handleSearch}
          defaultQuery={searchQuery}
          defaultResourceType={resourceType}
          filters={validationFilters}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* Main content area with side panel */}
      <div className="flex-1 overflow-hidden flex">
        {/* Main content */}
        <div className="flex-1 overflow-auto">
          <div className="p-4">
            {/* Validation Overview with Select Resources Button / Selection Toolbar */}
            {!isLoading && resourcesData?.resources && resourcesData.resources.length > 0 && (
              <div className="mb-4 flex items-center justify-between">
                <ValidationOverview
                  validationSummary={validationSummaryWithStats}
                  onRevalidate={handleRevalidate}
                  isRevalidating={isValidating}
                  messages={allMessages}
                  currentMessageIndex={currentMessageIndex}
                  onMessageIndexChange={handleMessageIndexChange}
                  onToggleMessages={handleToggleMessages}
                  isMessagesVisible={isMessagesVisible}
                  currentSeverity={currentSeverity}
                  onSeverityChange={handleSeverityChange}
                  currentSeverityIndex={currentSeverityIndex}
                  onSeverityIndexChange={handleSeverityIndexChange}
                  onFilterBySeverity={handleFilterBySeverity}
                />
                
                {/* Right side: Select Resources Button OR Selection Mode Controls */}
                {!selectionMode ? (
                  <Button
                    onClick={toggleSelectionMode}
                    size="sm"
                    variant="outline"
                  >
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Select Resources
                  </Button>
                ) : (
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
              selectedIds={selectedResources}
              onSelectionChange={handleSelectionChange}
              onSeverityBadgeClick={handleSeverityBadgeClick}
            />
            ) : (
              <div className="text-center py-8 text-gray-500">
                No resources found
            </div>
          )}
          </div>
        </div>

        {/* Side Panel - Validation Messages */}
        {isMessagesVisible && (() => {
          // Calculate the most recent validation timestamp from resources on current page
          const mostRecentValidation = enrichedResources?.reduce((latest: string | null, resource: any) => {
            const validationTimestamp = resource._enhancedValidationSummary?.lastValidated || 
                                       resource._validationSummary?.lastValidated;
            if (!validationTimestamp) return latest;
            if (!latest) return validationTimestamp;
            return new Date(validationTimestamp) > new Date(latest) ? validationTimestamp : latest;
          }, null);

          return (
            <div className="w-96 border-l bg-white overflow-auto">
              <ValidationMessagesPerAspect
                aspects={messagesByAspect}
                initialSeverity={currentSeverity}
                onClose={handleToggleMessages}
                errorCount={validationSummaryWithStats?.errorCount || 0}
                warningCount={validationSummaryWithStats?.warningCount || 0}
                informationCount={validationSummaryWithStats?.infoCount || 0}
                lastValidated={mostRecentValidation || undefined}
              />
            </div>
          );
        })()}
      </div>

      {/* Batch Edit Dialog */}
      <BatchEditDialog
        open={batchEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleBatchEditComplete();
          }
        }}
        selectedResources={Array.from(selectedResources).map(key => {
          const [resourceType, id] = key.split('/');
          return { resourceType, id };
        })}
        onComplete={handleBatchEditComplete}
      />
    </div>
  );
}

