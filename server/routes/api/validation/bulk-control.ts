/**
 * Bulk Validation Control Routes
 * 
 * This module contains all the bulk validation control endpoints:
 * - Start validation
 * - Stop validation  
 * - Pause validation
 * - Resume validation
 * - Get progress
 */

import type { Express } from "express";
import { getValidationSettingsService } from "../../../services/validation/settings/validation-settings-service";
import { getValidationPipeline, getValidationQueueService, ValidationPriority, getIndividualResourceProgressService, getValidationCancellationRetryService } from "../../../services/validation";
import { CancellationType } from "../../../services/validation/features/validation-cancellation-retry-service";
import type { ResourceProgressStats, IndividualResourceProgress } from "../../../services/validation/features/individual-resource-progress-service";
import { getValidationProgressPersistenceService } from "../../../services/validation/persistence/validation-progress-persistence-service";
import { getActiveServerId, getServerScopingContext } from "../../../utils/server-scoping";
import { getValidationPerformanceMonitor } from "../../../services/performance/validation-performance-monitor";
import { randomUUID } from "crypto";
import { handleError } from "../../../utils/validation-error-handler";

// Global validation state tracking
let globalValidationState = {
  isRunning: false,
  isPaused: false,
  startTime: null as Date | null,
  canPause: false,
  shouldStop: false,
  resumeData: null as any | null,
  currentResourceType: null as string | null,
  nextResourceType: null as string | null,
  activeValidationAspects: null as {
    structural: boolean;
    profile: boolean;
    terminology: boolean;
    reference: boolean;
    businessRule: boolean;
    metadata: boolean;
  } | null,
  lastBroadcastTime: null as number | null,
  // Real-time progress counters
  processedResources: 0,
  totalResources: 0,
  currentBatch: 0,
  totalBatches: 0,
  errors: 0,
  warnings: 0,
  // Detailed error and warning tracking
  errorDetails: {
    total: 0,
    byType: {} as Record<string, number>,
    byResourceType: {} as Record<string, number>,
    byAspect: {} as Record<string, number>,
    bySeverity: {} as Record<string, number>,
    recent: [] as Array<{
      timestamp: number;
      resourceId: string;
      resourceType: string;
      aspect: string;
      errorType: string;
      severity: string;
      message: string;
    }>
  },
  warningDetails: {
    total: 0,
    byType: {} as Record<string, number>,
    byResourceType: {} as Record<string, number>,
    byAspect: {} as Record<string, number>,
    bySeverity: {} as Record<string, number>,
    recent: [] as Array<{
      timestamp: number;
      resourceId: string;
      resourceType: string;
      aspect: string;
      warningType: string;
      severity: string;
      message: string;
    }>
  },
  // Performance metrics
  startTimeMs: 0,
  lastUpdateTime: 0,
  averageProcessingTime: 0,
  estimatedTimeRemaining: 0,
  // Resource type progress
  resourceTypeProgress: {} as Record<string, {
    processed: number;
    total: number;
    errors: number;
    warnings: number;
    startTime: number;
  }>,
  // Validation aspects progress
  aspectProgress: {} as Record<string, {
    processed: number;
    total: number;
    errors: number;
    warnings: number;
    startTime: number;
  }>,
  // Enhanced tracking fields
  jobId: null as string | null,
  requestPayload: null as any | null,
  startTimestamp: 0,
  stopTimestamp: 0,
  runDuration: 0,
  finalStats: null as any | null
};

interface StartRequestPayload {
  resourceTypes?: string[];
  validationAspects?: {
    structural?: boolean;
    profile?: boolean;
    terminology?: boolean;
    reference?: boolean;
    businessRule?: boolean;
    metadata?: boolean;
  };
  config?: {
    batchSize?: number;
    maxConcurrent?: number;
    priority?: string;
  };
}

/**
 * Validate start request payload
 */
function validateStartRequest(payload: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object') {
    errors.push('Request body must be an object');
    return { isValid: false, errors };
  }

  // Validate resourceTypes if provided
  if (payload.resourceTypes !== undefined) {
    if (!Array.isArray(payload.resourceTypes)) {
      errors.push('resourceTypes must be an array');
    } else if (payload.resourceTypes.length === 0) {
      errors.push('resourceTypes array cannot be empty');
    } else {
      const invalidTypes = payload.resourceTypes.filter((type: any) => typeof type !== 'string' || type.trim() === '');
      if (invalidTypes.length > 0) {
        errors.push('All resourceTypes must be non-empty strings');
      }
    }
  }

  // Validate validationAspects if provided
  if (payload.validationAspects !== undefined) {
    if (typeof payload.validationAspects !== 'object' || payload.validationAspects === null) {
      errors.push('validationAspects must be an object');
    } else {
      const validAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
      const providedAspects = Object.keys(payload.validationAspects);
      const invalidAspects = providedAspects.filter(aspect => !validAspects.includes(aspect));
      if (invalidAspects.length > 0) {
        errors.push(`Invalid validation aspects: ${invalidAspects.join(', ')}. Valid aspects are: ${validAspects.join(', ')}`);
      }
      
      const booleanAspects = providedAspects.filter(aspect => typeof payload.validationAspects[aspect] !== 'boolean');
      if (booleanAspects.length > 0) {
        errors.push(`Validation aspects must be boolean values. Invalid aspects: ${booleanAspects.join(', ')}`);
      }
    }
  }

  // Validate config if provided
  if (payload.config !== undefined) {
    if (typeof payload.config !== 'object' || payload.config === null) {
      errors.push('config must be an object');
    } else {
      if (payload.config.batchSize !== undefined && (typeof payload.config.batchSize !== 'number' || payload.config.batchSize < 1)) {
        errors.push('config.batchSize must be a positive number');
      }
      if (payload.config.maxConcurrent !== undefined && (typeof payload.config.maxConcurrent !== 'number' || payload.config.maxConcurrent < 1)) {
        errors.push('config.maxConcurrent must be a positive number');
      }
      if (payload.config.priority !== undefined && typeof payload.config.priority !== 'string') {
        errors.push('config.priority must be a string');
      }
    }
  }

  return { isValid: errors.length === 0, errors };
}

// Helper function to track errors in real-time
function trackError(
  resourceId: string,
  resourceType: string,
  aspect: string,
  errorType: string,
  severity: string,
  message: string
): void {
  const timestamp = Date.now();
  
  // Update global error counters
  globalValidationState.errors++;
  globalValidationState.errorDetails.total++;
  
  // Update error details by type
  globalValidationState.errorDetails.byType[errorType] = 
    (globalValidationState.errorDetails.byType[errorType] || 0) + 1;
  
  // Update error details by resource type
  globalValidationState.errorDetails.byResourceType[resourceType] = 
    (globalValidationState.errorDetails.byResourceType[resourceType] || 0) + 1;
  
  // Update error details by aspect
  globalValidationState.errorDetails.byAspect[aspect] = 
    (globalValidationState.errorDetails.byAspect[aspect] || 0) + 1;
  
  // Update error details by severity
  globalValidationState.errorDetails.bySeverity[severity] = 
    (globalValidationState.errorDetails.bySeverity[severity] || 0) + 1;
  
  // Add to recent errors (keep only last 100)
  globalValidationState.errorDetails.recent.push({
    timestamp,
    resourceId,
    resourceType,
    aspect,
    errorType,
    severity,
    message
  });
  
  // Keep only the most recent 100 errors
  if (globalValidationState.errorDetails.recent.length > 100) {
    globalValidationState.errorDetails.recent = globalValidationState.errorDetails.recent.slice(-100);
  }
  
  // Update last update time
  globalValidationState.lastUpdateTime = timestamp;
}

// Helper function to track warnings in real-time
function trackWarning(
  resourceId: string,
  resourceType: string,
  aspect: string,
  warningType: string,
  severity: string,
  message: string
): void {
  const timestamp = Date.now();
  
  // Update global warning counters
  globalValidationState.warnings++;
  globalValidationState.warningDetails.total++;
  
  // Update warning details by type
  globalValidationState.warningDetails.byType[warningType] = 
    (globalValidationState.warningDetails.byType[warningType] || 0) + 1;
  
  // Update warning details by resource type
  globalValidationState.warningDetails.byResourceType[resourceType] = 
    (globalValidationState.warningDetails.byResourceType[resourceType] || 0) + 1;
  
  // Update warning details by aspect
  globalValidationState.warningDetails.byAspect[aspect] = 
    (globalValidationState.warningDetails.byAspect[aspect] || 0) + 1;
  
  // Update warning details by severity
  globalValidationState.warningDetails.bySeverity[severity] = 
    (globalValidationState.warningDetails.bySeverity[severity] || 0) + 1;
  
  // Add to recent warnings (keep only last 100)
  globalValidationState.warningDetails.recent.push({
    timestamp,
    resourceId,
    resourceType,
    aspect,
    warningType,
    severity,
    message
  });
  
  // Keep only the most recent 100 warnings
  if (globalValidationState.warningDetails.recent.length > 100) {
    globalValidationState.warningDetails.recent = globalValidationState.warningDetails.recent.slice(-100);
  }
  
  // Update last update time
  globalValidationState.lastUpdateTime = timestamp;
}

// Helper function to save validation state to persistence
async function saveValidationState(jobId: string, serverId?: number): Promise<void> {
  try {
    const activeServerId = serverId || await getActiveServerId();
    const persistenceService = getValidationProgressPersistenceService();
    await persistenceService.saveProgressState(jobId, activeServerId, globalValidationState);
  } catch (error) {
    console.error('[ValidationPersistence] Error saving validation state:', error);
    // Don't throw - persistence failure shouldn't break validation
  }
}

// Helper function to load validation state from persistence
async function loadValidationState(jobId: string): Promise<boolean> {
  try {
    const persistenceService = getValidationProgressPersistenceService();
    const savedState = await persistenceService.loadProgressState(jobId);
    
    if (savedState) {
      globalValidationState = savedState;
      console.log(`[ValidationPersistence] Loaded validation state for job ${jobId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[ValidationPersistence] Error loading validation state:', error);
    return false;
  }
}

// Helper function to restore active validation state on server startup
async function restoreActiveValidationState(serverId?: number): Promise<boolean> {
  try {
    const activeServerId = serverId || await getActiveServerId();
    const persistenceService = getValidationProgressPersistenceService();
    const activeState = await persistenceService.loadActiveProgressState(activeServerId);
    
    if (activeState) {
      globalValidationState = activeState;
      console.log(`[ValidationPersistence] Restored active validation state for server ${activeServerId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[ValidationPersistence] Error restoring active validation state:', error);
    return false;
  }
}

// Helper function to process validation resources in the background
async function processValidationResources(jobId: string, requestPayload: StartRequestPayload): Promise<void> {
  try {
    console.log(`[BulkValidation] Starting resource processing for job ${jobId}`);
    
    // Get validation service
    const { ConsolidatedValidationService } = await import("../../../services/validation/core/consolidated-validation-service");
    const validationService = new ConsolidatedValidationService();
    
    // Get resources from FHIR server
    const { storage } = await import("../../../storage.js");
    const { FhirClient } = await import("../../../services/fhir/fhir-client");
    
    // Get active FHIR server
    const activeServer = await storage.getActiveFhirServer();
    if (!activeServer) {
      throw new Error('No active FHIR server configured');
    }
    
    const fhirClient = new FhirClient(activeServer.url);
    let resources: any[] = [];
    
    // Get validation settings to determine which resource types to validate
    const settingsService = getValidationSettingsService();
    const settings = await settingsService.getCurrentSettings();
    
    // Determine resource types to validate based on settings
    let resourceTypesToValidate: string[] = [];
    
    if (requestPayload.resourceTypes && requestPayload.resourceTypes.length > 0) {
      // Use resource types from request payload
      resourceTypesToValidate = requestPayload.resourceTypes;
    } else if (settings.resourceTypes.enabled && settings.resourceTypes.includedTypes.length > 0) {
      // Use resource types from settings
      resourceTypesToValidate = settings.resourceTypes.includedTypes;
    } else {
      // Use default resource types if no specific types are configured
      resourceTypesToValidate = ['Patient', 'Observation', 'Encounter', 'Condition', 'Procedure', 'Medication', 'DiagnosticReport'];
    }
    
    console.log(`[BulkValidation] Resource types to validate (${resourceTypesToValidate.length} types): ${resourceTypesToValidate.join(', ')}`);
    
    // Initialize total resources count to 0 to show UI that we're loading
    globalValidationState.totalResources = 0;
    globalValidationState.lastUpdateTime = Date.now();
    
    // Fetch resources from FHIR server by type
    for (const resourceType of resourceTypesToValidate) {
      try {
        console.log(`[BulkValidation] Fetching ${resourceType} resources from FHIR server...`);
        // Use searchAllResources to get all available resources with pagination
        const typeResources = await fhirClient.searchAllResources(resourceType, {}, 10000); // Limit to 10k per type for performance
        console.log(`[BulkValidation] Found ${typeResources.length} ${resourceType} resources from FHIR server`);
        resources.push(...typeResources);
        
        // Update total resources count incrementally so UI shows progress
        globalValidationState.totalResources = resources.length;
        globalValidationState.lastUpdateTime = Date.now();
      } catch (error) {
        console.error(`[BulkValidation] Error fetching ${resourceType} resources from FHIR server:`, error);
        // Continue with other resource types
      }
    }
    
    console.log(`[BulkValidation] Total resources fetched from FHIR server: ${resources.length} (from ${resourceTypesToValidate.length} resource types)`);
    
    // Final update of total resources count
    globalValidationState.totalResources = resources.length;
    globalValidationState.lastUpdateTime = Date.now();
    
    if (resources.length === 0) {
      console.log(`[BulkValidation] No resources to validate for job ${jobId}`);
      globalValidationState.isRunning = false;
      globalValidationState.shouldStop = true;
      return;
    }
    
    // Process resources in batches
    const batchSize = requestPayload.config?.batchSize || 10;
    const totalBatches = Math.ceil(resources.length / batchSize);
    globalValidationState.totalBatches = totalBatches;
    
    console.log(`[BulkValidation] Processing ${resources.length} resources in ${totalBatches} batches of ${batchSize}`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      // Check if validation should stop
      if (globalValidationState.shouldStop) {
        console.log(`[BulkValidation] Validation stopped for job ${jobId}`);
        break;
      }
      
      // Check if validation is paused
      while (globalValidationState.isPaused && !globalValidationState.shouldStop) {
        console.log(`[BulkValidation] Validation paused for job ${jobId}, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (globalValidationState.shouldStop) {
        break;
      }
      
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, resources.length);
      const batch = resources.slice(startIndex, endIndex);
      
      globalValidationState.currentBatch = batchIndex + 1;
      globalValidationState.lastUpdateTime = Date.now();
      
      console.log(`[BulkValidation] Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} resources)`);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (resource) => {
        try {
          globalValidationState.currentResourceType = resource.resourceType;
          globalValidationState.lastUpdateTime = Date.now();
          
          // Validate the resource (resource is already the FHIR resource object)
          const result = await validationService.validateResource(
            resource, // resource is the FHIR resource object directly
            true, // skipUnchanged
            false, // forceRevalidation
            0, // retryAttempt
            {
              aspects: requestPayload.validationAspects,
              settings: undefined // Will use current settings
            }
          );
          
          // Update progress
          globalValidationState.processedResources++;
          
          // Track errors and warnings
          if (result.detailedResult.issues && result.detailedResult.issues.length > 0) {
            result.detailedResult.issues.forEach(issue => {
              if (issue.severity === 'error') {
                trackError(
                  resource.id || 'unknown',
                  resource.resourceType,
                  issue.aspect || 'unknown',
                  issue.type || 'unknown',
                  issue.severity,
                  issue.message
                );
              } else if (issue.severity === 'warning') {
                trackWarning(
                  resource.id || 'unknown',
                  resource.resourceType,
                  issue.aspect || 'unknown',
                  issue.type || 'unknown',
                  issue.severity,
                  issue.message
                );
              }
            });
          }
          
          // Update resource type progress
          if (!globalValidationState.resourceTypeProgress[resource.resourceType]) {
            globalValidationState.resourceTypeProgress[resource.resourceType] = {
              processed: 0,
              total: 0,
              errors: 0,
              warnings: 0,
              startTime: Date.now()
            };
          }
          
          globalValidationState.resourceTypeProgress[resource.resourceType].processed++;
          globalValidationState.resourceTypeProgress[resource.resourceType].total++;
          
          if (result.detailedResult.issues) {
            globalValidationState.resourceTypeProgress[resource.resourceType].errors += 
              result.detailedResult.issues.filter(i => i.severity === 'error').length;
            globalValidationState.resourceTypeProgress[resource.resourceType].warnings += 
              result.detailedResult.issues.filter(i => i.severity === 'warning').length;
          }
          
          globalValidationState.lastUpdateTime = Date.now();
          
        } catch (error) {
          console.error(`[BulkValidation] Error validating resource ${resource.resourceType}/${resource.id}:`, error);
          globalValidationState.errors++;
          globalValidationState.processedResources++;
          
          trackError(
            resource.id || 'unknown',
            resource.resourceType,
            'validation',
            'processing_error',
            'error',
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      });
      
      // Wait for batch to complete
      await Promise.all(batchPromises);
      
      // Save progress periodically
      if (batchIndex % 5 === 0 || batchIndex === totalBatches - 1) {
        await saveValidationState(jobId);
      }
    }
    
    // Mark validation as completed
    globalValidationState.isRunning = false;
    globalValidationState.shouldStop = true;
    globalValidationState.lastUpdateTime = Date.now();
    
    console.log(`[BulkValidation] Completed validation for job ${jobId}. Processed: ${globalValidationState.processedResources}/${globalValidationState.totalResources}`);
    
    // Save final state
    await saveValidationState(jobId);
    
  } catch (error) {
    console.error(`[BulkValidation] Error in resource processing for job ${jobId}:`, error);
    globalValidationState.isRunning = false;
    globalValidationState.shouldStop = true;
    globalValidationState.lastUpdateTime = Date.now();
    throw error;
  }
}

// Enhanced progress calculation function
function calculateEnhancedProgressMetrics(
  globalState: any,
  progressStats: ResourceProgressStats,
  activeProgress: IndividualResourceProgress[]
): {
  completionPercentage: number;
  processingRate: number; // resources per second
  estimatedTimeRemaining: number; // seconds
  throughput: {
    resourcesPerSecond: number;
    resourcesPerMinute: number;
    resourcesPerHour: number;
  };
  progressBreakdown: {
    byStatus: Record<string, { count: number; percentage: number }>;
    byAspect: Record<string, { 
      count: number; 
      percentage: number;
      completed: number;
      failed: number;
      pending: number;
      validating: number;
      errors: number;
      warnings: number;
      averageProcessingTime: number;
      successRate: number;
    }>;
    byResourceType: Record<string, { 
      count: number; 
      percentage: number;
      completed: number;
      failed: number;
      pending: number;
      validating: number;
      errors: number;
      warnings: number;
      averageProcessingTime: number;
    }>;
  };
  performanceMetrics: {
    averageProcessingTime: number;
    fastestProcessingTime: number;
    slowestProcessingTime: number;
    totalProcessingTime: number;
  };
} {
  const now = Date.now();
  const startTime = globalState.startTimestamp || now;
  const elapsedTime = (now - startTime) / 1000; // seconds
  
  // Calculate total resources (use progress stats if available, otherwise global state)
  const totalResources = Math.max(
    progressStats.totalResources || globalState.totalResources || 0,
    progressStats.completedResources + progressStats.failedResources + progressStats.pendingResources + progressStats.validatingResources || 0
  );
  
  // Calculate processed resources
  const processedResources = progressStats.completedResources + progressStats.failedResources || globalState.processedResources || 0;
  
  // Calculate completion percentage
  const completionPercentage = totalResources > 0 ? (processedResources / totalResources) * 100 : 0;
  
  // Calculate processing rate (resources per second)
  const processingRate = elapsedTime > 0 ? processedResources / elapsedTime : 0;
  
  // Calculate estimated time remaining
  let estimatedTimeRemaining = 0;
  if (processingRate > 0 && totalResources > processedResources) {
    const remainingResources = totalResources - processedResources;
    estimatedTimeRemaining = remainingResources / processingRate;
  }
  
  // Calculate throughput metrics
  const throughput = {
    resourcesPerSecond: processingRate,
    resourcesPerMinute: processingRate * 60,
    resourcesPerHour: processingRate * 3600
  };
  
  // Calculate progress breakdown by status
  const statusBreakdown: Record<string, { count: number; percentage: number }> = {};
  if (totalResources > 0) {
    statusBreakdown.pending = {
      count: progressStats.pendingResources || 0,
      percentage: ((progressStats.pendingResources || 0) / totalResources) * 100
    };
    statusBreakdown.validating = {
      count: progressStats.validatingResources || 0,
      percentage: ((progressStats.validatingResources || 0) / totalResources) * 100
    };
    statusBreakdown.completed = {
      count: progressStats.completedResources || 0,
      percentage: ((progressStats.completedResources || 0) / totalResources) * 100
    };
    statusBreakdown.failed = {
      count: progressStats.failedResources || 0,
      percentage: ((progressStats.failedResources || 0) / totalResources) * 100
    };
    statusBreakdown.cancelled = {
      count: progressStats.cancelledResources || 0,
      percentage: ((progressStats.cancelledResources || 0) / totalResources) * 100
    };
    statusBreakdown.retrying = {
      count: progressStats.retryingResources || 0,
      percentage: ((progressStats.retryingResources || 0) / totalResources) * 100
    };
  }
  
  // Calculate comprehensive progress breakdown by validation aspect
  const aspectBreakdown: Record<string, { 
    count: number; 
    percentage: number;
    completed: number;
    failed: number;
    pending: number;
    validating: number;
    errors: number;
    warnings: number;
    averageProcessingTime: number;
    successRate: number;
  }> = {};
  
  // Always initialize validation aspects from the validation request payload
  if (globalState.requestPayload && globalState.requestPayload.validationAspects) {
    Object.entries(globalState.requestPayload.validationAspects).forEach(([aspect, enabled]) => {
      if (enabled) {
        aspectBreakdown[aspect] = {
          count: 0,
          percentage: 0,
          completed: 0,
          failed: 0,
          pending: 0,
          validating: 0,
          errors: 0,
          warnings: 0,
          averageProcessingTime: 0,
          successRate: 0
        };
      }
    });
  }
  
  if (totalResources > 0) {
    // Get all progress data (active + completed)
    const allProgress = [...activeProgress, ...(progressStats as any).completedProgress || []];
    
    // Initialize aspect tracking
    const aspectStats: Record<string, {
      total: number;
      completed: number;
      failed: number;
      pending: number;
      validating: number;
      errors: number;
      warnings: number;
      processingTimes: number[];
    }> = {};
    
    // Process all progress data by aspect
    allProgress.forEach(progress => {
      // Track current aspect
      if (progress.currentAspect) {
        const aspect = progress.currentAspect;
        
        if (!aspectStats[aspect]) {
          aspectStats[aspect] = {
            total: 0,
            completed: 0,
            failed: 0,
            pending: 0,
            validating: 0,
            errors: 0,
            warnings: 0,
            processingTimes: []
          };
        }
        
        aspectStats[aspect].total++;
        
        // Track by status for current aspect
        switch (progress.status) {
          case 'completed':
            aspectStats[aspect].completed++;
            break;
          case 'failed':
            aspectStats[aspect].failed++;
            break;
          case 'pending':
            aspectStats[aspect].pending++;
            break;
          case 'validating':
            aspectStats[aspect].validating++;
            break;
        }
        
        // Track errors and warnings for current aspect
        if (progress.errors && progress.errors.length > 0) {
          aspectStats[aspect].errors += progress.errors.length;
        }
        if (progress.warnings && progress.warnings.length > 0) {
          aspectStats[aspect].warnings += progress.warnings.length;
        }
        
        // Track processing times for current aspect
        if (progress.performance && progress.performance.totalTimeMs) {
          aspectStats[aspect].processingTimes.push(progress.performance.totalTimeMs);
        }
      }
      
      // Track completed aspects
      if (progress.completedAspects && Array.isArray(progress.completedAspects)) {
        progress.completedAspects.forEach((aspect: string) => {
          if (!aspectStats[aspect]) {
            aspectStats[aspect] = {
              total: 0,
              completed: 0,
              failed: 0,
              pending: 0,
              validating: 0,
              errors: 0,
              warnings: 0,
              processingTimes: []
            };
          }
          
          aspectStats[aspect].total++;
          aspectStats[aspect].completed++;
          
          // Track processing times for completed aspects
          if (progress.performance && progress.performance.totalTimeMs) {
            aspectStats[aspect].processingTimes.push(progress.performance.totalTimeMs);
          }
        });
      }
    });
    
    // Calculate breakdown with detailed metrics for each aspect
    Object.entries(aspectStats).forEach(([aspect, stats]) => {
      const averageProcessingTime = stats.processingTimes.length > 0
        ? stats.processingTimes.reduce((sum, time) => sum + time, 0) / stats.processingTimes.length
        : 0;
      
      const successRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
      
      aspectBreakdown[aspect] = {
        count: stats.total,
        percentage: (stats.total / totalResources) * 100,
        completed: stats.completed,
        failed: stats.failed,
        pending: stats.pending,
        validating: stats.validating,
        errors: stats.errors,
        warnings: stats.warnings,
        averageProcessingTime: Math.round(averageProcessingTime),
        successRate: Math.round(successRate * 100) / 100
      };
    });
  }
  
  // Calculate comprehensive progress breakdown by resource type
  const resourceTypeBreakdown: Record<string, { 
    count: number; 
    percentage: number;
    completed: number;
    failed: number;
    pending: number;
    validating: number;
    errors: number;
    warnings: number;
    averageProcessingTime: number;
  }> = {};
  
  // Always initialize resource types from the validation request payload
  if (globalState.requestPayload && globalState.requestPayload.resourceTypes) {
    globalState.requestPayload.resourceTypes.forEach((resourceType: string) => {
      resourceTypeBreakdown[resourceType] = {
        count: 0,
        percentage: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        validating: 0,
        errors: 0,
        warnings: 0,
        averageProcessingTime: 0
      };
    });
  }
  
  if (totalResources > 0) {
    // Get all progress data (active + completed)
    const allProgress = [...activeProgress, ...(progressStats as any).completedProgress || []];
    
    // Initialize resource type tracking
    const resourceTypeStats: Record<string, {
      total: number;
      completed: number;
      failed: number;
      pending: number;
      validating: number;
      errors: number;
      warnings: number;
      processingTimes: number[];
    }> = {};
    
    // Initialize resource types from the validation request payload
    if (globalState.requestPayload && globalState.requestPayload.resourceTypes) {
      globalState.requestPayload.resourceTypes.forEach((resourceType: string) => {
        if (!resourceTypeStats[resourceType]) {
          resourceTypeStats[resourceType] = {
            total: 0,
            completed: 0,
            failed: 0,
            pending: 0,
            validating: 0,
            errors: 0,
            warnings: 0,
            processingTimes: []
          };
        }
      });
    }
    
    // Process all progress data
    allProgress.forEach(progress => {
      const resourceType = progress.resourceType || 'Unknown';
      
      if (!resourceTypeStats[resourceType]) {
        resourceTypeStats[resourceType] = {
          total: 0,
          completed: 0,
          failed: 0,
          pending: 0,
          validating: 0,
          errors: 0,
          warnings: 0,
          processingTimes: []
        };
      }
      
      resourceTypeStats[resourceType].total++;
      
      // Track by status
      switch (progress.status) {
        case 'completed':
          resourceTypeStats[resourceType].completed++;
          break;
        case 'failed':
          resourceTypeStats[resourceType].failed++;
          break;
        case 'pending':
          resourceTypeStats[resourceType].pending++;
          break;
        case 'validating':
          resourceTypeStats[resourceType].validating++;
          break;
      }
      
      // Track errors and warnings
      if (progress.errors && progress.errors.length > 0) {
        resourceTypeStats[resourceType].errors += progress.errors.length;
      }
      if (progress.warnings && progress.warnings.length > 0) {
        resourceTypeStats[resourceType].warnings += progress.warnings.length;
      }
      
      // Track processing times
      if (progress.performance && progress.performance.totalTimeMs) {
        resourceTypeStats[resourceType].processingTimes.push(progress.performance.totalTimeMs);
      }
    });
    
    // Calculate breakdown with detailed metrics
    Object.entries(resourceTypeStats).forEach(([resourceType, stats]) => {
      const averageProcessingTime = stats.processingTimes.length > 0
        ? stats.processingTimes.reduce((sum, time) => sum + time, 0) / stats.processingTimes.length
        : 0;
      
      resourceTypeBreakdown[resourceType] = {
        count: stats.total,
        percentage: (stats.total / totalResources) * 100,
        completed: stats.completed,
        failed: stats.failed,
        pending: stats.pending,
        validating: stats.validating,
        errors: stats.errors,
        warnings: stats.warnings,
        averageProcessingTime: Math.round(averageProcessingTime)
      };
    });
  }
  
  // Calculate performance metrics
  const performanceMetrics = {
    averageProcessingTime: progressStats.averageProcessingTimeMs || 0,
    fastestProcessingTime: progressStats.performanceMetrics?.fastestResource?.timeMs || 0,
    slowestProcessingTime: progressStats.performanceMetrics?.slowestResource?.timeMs || 0,
    totalProcessingTime: elapsedTime * 1000 // Convert to milliseconds
  };
  
  const result = {
    completionPercentage: Math.round(completionPercentage * 100) / 100, // Round to 2 decimal places
    processingRate: Math.round(processingRate * 100) / 100,
    estimatedTimeRemaining: Math.round(estimatedTimeRemaining),
    throughput,
    progressBreakdown: {
      byStatus: statusBreakdown,
      byAspect: aspectBreakdown,
      byResourceType: resourceTypeBreakdown
    },
    performanceMetrics
  };
  
  return result;
}

/**
 * Setup bulk validation control routes
 */
export function setupBulkControlRoutes(app: Express): void {
  
  // POST /api/validation/bulk/start - Start bulk validation
  app.post("/api/validation/bulk/start", async (req, res) => {
    const startTime = Date.now();
    const performanceMonitor = getValidationPerformanceMonitor();
    
    try {
      // Schema validation for request payload
      const validation = validateStartRequest(req.body);
      if (!validation.isValid) {
        performanceMonitor.recordMetric('validation-start', Date.now() - startTime, false, 'Invalid request payload');
        return res.status(400).json({
          error: 'Invalid request payload',
          message: 'Request validation failed',
          details: validation.errors,
          code: 'INVALID_PAYLOAD'
        });
      }

      // Check if validation is already running
      if (globalValidationState.isRunning) {
        return res.status(200).json({
          message: 'Validation is already running',
          jobId: globalValidationState.jobId,
          status: 'running',
          startTime: globalValidationState.startTime,
          requestPayload: globalValidationState.requestPayload
        });
      }

      // Generate unique job ID
      const jobId = `validation_${Date.now()}_${randomUUID().slice(0, 8)}`;
      
      // Update global state
      globalValidationState = {
        ...globalValidationState,
        isRunning: true,
        isPaused: false,
        startTime: new Date(),
        canPause: true,
        shouldStop: false,
        jobId,
        requestPayload: req.body as StartRequestPayload,
        startTimestamp: Date.now(),
        processedResources: 0,
        totalResources: 0,
        errors: 0,
        warnings: 0,
        // Reset detailed error and warning tracking
        errorDetails: {
          total: 0,
          byType: {},
          byResourceType: {},
          byAspect: {},
          bySeverity: {},
          recent: []
        },
        warningDetails: {
          total: 0,
          byType: {},
          byResourceType: {},
          byAspect: {},
          bySeverity: {},
          recent: []
        },
        lastUpdateTime: Date.now()
      };

      // Calculate estimated duration (simplified)
      const estimatedDuration = req.body.resourceTypes?.length ? req.body.resourceTypes.length * 30 : 300; // 30 seconds per resource type

      // Save initial state to persistence
      await saveValidationState(jobId);

      // Start actual resource processing in the background
      processValidationResources(jobId, req.body as StartRequestPayload).catch(error => {
        console.error('[BulkValidation] Background processing error:', error);
        // Update global state to reflect error
        globalValidationState = {
          ...globalValidationState,
          isRunning: false,
          shouldStop: true,
          lastUpdateTime: Date.now()
        };
      });

      // Record successful start
      performanceMonitor.recordMetric('validation-start', Date.now() - startTime, true, undefined, {
        jobId,
        resourceTypes: req.body.resourceTypes?.length || 0,
        aspects: req.body.aspects?.length || 0,
        maxConcurrency: req.body.maxConcurrency,
        priority: req.body.priority
      });

      res.status(202).json({
        message: 'Bulk validation started successfully',
        jobId,
        status: 'running',
        startTime: globalValidationState.startTime,
        estimatedDuration,
        requestPayload: globalValidationState.requestPayload
      });
    } catch (error: any) {
      console.error('[BulkValidation] Start error:', error);
      performanceMonitor.recordMetric('validation-start', Date.now() - startTime, false, error.message);
      handleError(error, req, res, 'bulk-validation-start');
    }
  });

  // GET /api/validation/bulk/progress - Get validation progress and status
  app.get("/api/validation/bulk/progress", async (req, res) => {
    try {
      // Get progress from consolidated service
      const progressService = getIndividualResourceProgressService();
      const progressStats = progressService.getProgressStats();
      const activeProgress = progressService.getActiveProgress();
      
      // Determine status based on global state
      let status = 'idle';
      if (globalValidationState.isRunning && !globalValidationState.isPaused) {
        status = 'running';
      } else if (globalValidationState.isRunning && globalValidationState.isPaused) {
        status = 'paused';
      } else if (globalValidationState.shouldStop) {
        status = 'completed';
      }

      // Calculate enhanced progress metrics
      const enhancedProgress = calculateEnhancedProgressMetrics(
        globalValidationState,
        progressStats,
        activeProgress
      );
      

      // Calculate valid and error resources from resourceTypeProgress
      let totalValidResources = 0;
      let totalErrorResources = 0;
      
      if (globalValidationState.resourceTypeProgress) {
        Object.values(globalValidationState.resourceTypeProgress).forEach((resourceType: any) => {
          totalValidResources += (resourceType.processed || 0) - (resourceType.errors || 0);
          totalErrorResources += resourceType.errors || 0;
        });
      }

      const response = {
        isRunning: globalValidationState.isRunning,
        isPaused: globalValidationState.isPaused,
        shouldStop: globalValidationState.shouldStop,
        status,
        jobId: globalValidationState.jobId,
        startTime: globalValidationState.startTime,
        processedResources: globalValidationState.processedResources,
        totalResources: globalValidationState.totalResources,
        validResources: totalValidResources,
        errorResources: totalErrorResources,
        currentBatch: globalValidationState.currentBatch,
        totalBatches: globalValidationState.totalBatches,
        errors: globalValidationState.errors,
        warnings: globalValidationState.warnings,
        // Detailed error and warning tracking
        errorDetails: globalValidationState.errorDetails,
        warningDetails: globalValidationState.warningDetails,
        currentResourceType: globalValidationState.currentResourceType,
        nextResourceType: globalValidationState.nextResourceType,
        activeValidationAspects: globalValidationState.activeValidationAspects,
        averageProcessingTime: globalValidationState.averageProcessingTime,
        resourceTypeProgress: globalValidationState.resourceTypeProgress,
        aspectProgress: globalValidationState.aspectProgress,
        lastUpdateTime: globalValidationState.lastUpdateTime,
        // Include progress service data
        progressStats,
        activeProgress,
        // Enhanced progress metrics
        ...enhancedProgress
      };


      // Save state to persistence periodically (every 10th call or if significant changes)
      if (globalValidationState.jobId && (Math.random() < 0.1 || globalValidationState.processedResources % 10 === 0)) {
        await saveValidationState(globalValidationState.jobId);
      }

      res.json(response);
    } catch (error: any) {
      console.error('[BulkValidation] Progress error:', error);
      handleError(error, req, res, 'bulk-validation-progress');
    }
  });

  // POST /api/validation/bulk/pause - Pause validation
  app.post("/api/validation/bulk/pause", async (req, res) => {
    try {
      // State consistency checks
      if (!globalValidationState.isRunning) {
        return res.status(400).json({
          error: 'No validation is currently running',
          message: 'Cannot pause validation when no validation is active',
          code: 'NO_ACTIVE_VALIDATION'
        });
      }

      if (globalValidationState.isPaused) {
        return res.status(200).json({
          message: 'Validation is already paused',
          status: 'paused',
          pauseTime: globalValidationState.startTime
        });
      }

      if (!globalValidationState.canPause) {
        return res.status(400).json({
          error: 'Cannot pause validation at this time',
          message: 'Validation is in a state where pausing is not allowed',
          code: 'PAUSE_NOT_ALLOWED'
        });
      }

      console.log('[ValidationPause] Initiating graceful pause of validation operations');

      // Update global state
      globalValidationState = {
        ...globalValidationState,
        isPaused: true,
        canPause: false,
        lastUpdateTime: Date.now()
      };

      const pauseTimestamp = new Date();
      const estimatedResumeTime = new Date(Date.now() + 5000); // 5 seconds estimate

      res.status(202).json({
        message: 'Validation pause requested successfully',
        status: 'paused',
        pauseTimestamp,
        estimatedResumeTime,
        jobId: globalValidationState.jobId
      });
    } catch (error: any) {
      console.error('[BulkValidation] Pause error:', error);
      handleError(error, req, res, 'bulk-validation-pause');
    }
  });

  // POST /api/validation/bulk/resume - Resume validation
  app.post("/api/validation/bulk/resume", async (req, res) => {
    try {
      // State consistency checks
      if (!globalValidationState.isRunning) {
        return res.status(400).json({
          error: 'No validation is currently running',
          message: 'Cannot resume validation when no validation is active',
          code: 'NO_ACTIVE_VALIDATION'
        });
      }

      if (!globalValidationState.isPaused) {
        return res.status(200).json({
          message: 'Validation is not paused',
          status: 'running'
        });
      }

      console.log('[ValidationResume] Resuming validation operations from paused state');

      // Update global state
      globalValidationState = {
        ...globalValidationState,
        isPaused: false,
        canPause: true,
        lastUpdateTime: Date.now()
      };

      const resumeTimestamp = new Date();
      const pauseDuration = globalValidationState.startTime ? 
        Date.now() - new Date(globalValidationState.startTime).getTime() : 0;
      const estimatedProcessingResume = new Date(Date.now() + 2000); // 2 seconds estimate

      res.status(202).json({
        message: 'Validation resume requested successfully',
        status: 'running',
        resumeTimestamp,
        pauseDuration,
        estimatedProcessingResume,
        jobId: globalValidationState.jobId
      });
    } catch (error: any) {
      console.error('[BulkValidation] Resume error:', error);
      handleError(error, req, res, 'bulk-validation-resume');
    }
  });

  // POST /api/validation/bulk/stop - Stop validation
  app.post("/api/validation/bulk/stop", async (req, res) => {
    try {
      // State consistency checks
      if (!globalValidationState.isRunning) {
        return res.status(200).json({
          message: 'No validation is currently running',
          status: 'idle'
        });
      }

      console.log('[ValidationStop] Initiating graceful shutdown of validation operations');

      // Get cancellation service and cancel all operations
      const cancellationService = getValidationCancellationRetryService();
      const cancellationResult = await cancellationService.cancelAllOperations(CancellationType.BULK_VALIDATION, 'user-requested', 'api-user');

      // Update global state
      globalValidationState = {
        ...globalValidationState,
        isRunning: false,
        isPaused: false,
        shouldStop: true,
        stopTimestamp: Date.now(),
        runDuration: globalValidationState.startTime ? 
          Date.now() - new Date(globalValidationState.startTime).getTime() : 0,
        finalStats: {
          processedResources: globalValidationState.processedResources,
          totalResources: globalValidationState.totalResources,
          errors: globalValidationState.errors,
          warnings: globalValidationState.warnings,
          duration: globalValidationState.startTime ? 
            Date.now() - new Date(globalValidationState.startTime).getTime() : 0
        },
        lastUpdateTime: Date.now()
      };

      console.log('[ValidationStop] Performing cleanup operations');

      const stopTimestamp = new Date();
      const runDuration = globalValidationState.runDuration;
      const estimatedCleanupTime = new Date(Date.now() + 3000); // 3 seconds estimate

      res.status(202).json({
        message: 'Validation stop requested successfully',
        status: 'stopped',
        stopTimestamp,
        runDuration,
        finalStats: globalValidationState.finalStats,
        cancellationResult,
        estimatedCleanupTime,
        jobId: globalValidationState.jobId
      });
    } catch (error: any) {
      console.error('[BulkValidation] Stop error:', error);
      handleError(error, req, res, 'bulk-validation-stop');
    }
  });

  // POST /api/validation/bulk/restore - Restore validation state from persistence
  app.post("/api/validation/bulk/restore", async (req, res) => {
    try {
      const { jobId } = req.body;

      if (!jobId) {
        return res.status(400).json({
          message: "Job ID is required for state restoration",
          code: "MISSING_JOB_ID"
        });
      }

      const restored = await loadValidationState(jobId);

      if (restored) {
        res.status(200).json({
          message: "Validation state restored successfully",
          jobId,
          state: globalValidationState,
          restored: true
        });
      } else {
        res.status(404).json({
          message: "No valid validation state found for the given job ID",
          jobId,
          restored: false
        });
      }
    } catch (error: any) {
      console.error('[ValidationRestore] Error restoring validation state:', error);
      handleError(error, req, res, 'validation-restore');
    }
  });

  // GET /api/validation/bulk/restore-active - Restore active validation state for server
  app.get("/api/validation/bulk/restore-active", async (req, res) => {
    try {
      const restored = await restoreActiveValidationState();

      if (restored) {
        const serverContext = await getServerScopingContext();
        res.status(200).json({
          message: "Active validation state restored successfully",
          serverId: serverContext.serverId,
          serverName: serverContext.serverName,
          serverUrl: serverContext.serverUrl,
          state: globalValidationState,
          restored: true
        });
      } else {
        res.status(404).json({
          message: "No active validation state found for the server",
          restored: false
        });
      }
    } catch (error: any) {
      console.error('[ValidationRestoreActive] Error restoring active validation state:', error);
      handleError(error, req, res, 'validation-restore-active');
    }
  });
}

/**
 * Get current global validation state (for testing/debugging)
 */
export function getGlobalValidationState() {
  return { ...globalValidationState };
}

/**
 * Reset global validation state (for testing/debugging)
 */
export function resetGlobalValidationState() {
  globalValidationState = {
    isRunning: false,
    isPaused: false,
    startTime: null,
    canPause: false,
    shouldStop: false,
    resumeData: null,
    currentResourceType: null,
    nextResourceType: null,
    activeValidationAspects: null,
    lastBroadcastTime: null,
    processedResources: 0,
    totalResources: 0,
    currentBatch: 0,
    totalBatches: 0,
    errors: 0,
    warnings: 0,
    // Detailed error and warning tracking
    errorDetails: {
      total: 0,
      byType: {},
      byResourceType: {},
      byAspect: {},
      bySeverity: {},
      recent: []
    },
    warningDetails: {
      total: 0,
      byType: {},
      byResourceType: {},
      byAspect: {},
      bySeverity: {},
      recent: []
    },
    startTimeMs: 0,
    lastUpdateTime: 0,
    averageProcessingTime: 0,
    estimatedTimeRemaining: 0,
    resourceTypeProgress: {},
    aspectProgress: {},
    jobId: null,
    requestPayload: null,
    startTimestamp: 0,
    stopTimestamp: 0,
    runDuration: 0,
    finalStats: null
  };
}
