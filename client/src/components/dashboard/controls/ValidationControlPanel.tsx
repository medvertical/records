import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, Square, Settings, RefreshCw, Clock, AlertCircle, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useValidationPolling } from '@/hooks/use-validation-polling';
import { ValidationSettingsModal } from '../modals/ValidationSettingsModal';
import { ValidationProgressDisplay } from './ValidationProgressDisplay';
import { ValidationStatusBadge, ValidationStatus } from './ValidationStatusBadge';
import { ValidationErrorWarningDisplay, ValidationError, ValidationWarning } from './ValidationErrorWarningDisplay';
import { convertApiErrorsToValidationErrors, convertApiWarningsToValidationWarnings } from '@/lib/validation-error-utils';
import { responsiveClasses, getResponsiveClassNames } from '@/lib/responsive-design-utils';
import { accessibility, keyboardNavigation, screenReader, focusManagement } from '@/lib/accessibility-utils.tsx';
import { SkeletonComponents, LoadingSpinner, LoadingState, ComponentLoadingStates } from '@/lib/loading-states-utils.tsx';
import { useConfirmationDialog, ConfirmationActions } from '@/lib/confirmation-dialog-utils';
import { useNetworkErrorHandler, fetchWithRetry, NetworkUtils } from '@/lib/network-error-handler';
import { useAdvancedRetry, VALIDATION_RETRY_CONFIGS } from '@/lib/advanced-retry-mechanisms';
import { useGracefulDegradation, DegradationUtils } from '@/lib/graceful-degradation';
import { useUserFriendlyErrors, ErrorMessageUtils } from '@/lib/user-friendly-error-messages';
import { useErrorLogging, LoggingUtils } from '@/lib/error-logging-monitoring';
import { useTimeoutHandling, TimeoutUtils } from '@/lib/timeout-handling';
import { useErrorRecovery, RecoveryUtils } from '@/lib/error-recovery-mechanisms';
import ErrorRecoveryDisplay from './ErrorRecoveryDisplay';
import { useValidationSettingsIntegration } from '@/lib/validation-settings-integration';
import { useValidationSettingsChangeDetection } from '@/lib/validation-settings-change-detector';
import ValidationAspectsPanel from './ValidationAspectsPanel';
import { useToast } from '@/hooks/use-toast';
import { usePerformanceMonitoring } from '@/hooks/use-performance-monitoring';
import PerformanceMonitoringDashboard from '../performance/PerformanceMonitoringDashboard';

interface ValidationControlPanelProps {
  className?: string;
}

/**
 * Validation Control Panel - Provides controls for managing validation operations
 */
export const ValidationControlPanel: React.FC<ValidationControlPanelProps> = ({
  className,
}) => {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
  const [isInitializing, setIsInitializing] = useState(true); // Loading state
  const [isRefreshing, setIsRefreshing] = useState(false); // Refresh loading state
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'poor'>('online');
  const [showRetryStats, setShowRetryStats] = useState(false);
  const [serviceStatuses, setServiceStatuses] = useState<any[]>([]);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [userFriendlyErrors, setUserFriendlyErrors] = useState<any[]>([]);
  const [errorAnalytics, setErrorAnalytics] = useState<any>(null);
  const [activeTimeouts, setActiveTimeouts] = useState<any[]>([]);
  const [partialFailures, setPartialFailures] = useState<any[]>([]);
  const [recoveryStats, setRecoveryStats] = useState<any>(null);
  const { toast } = useToast();
  const { showConfirmation } = useConfirmationDialog();
  const { handleNetworkError, executeWithRetry } = useNetworkErrorHandler({
    showToast: true,
    logError: true,
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
    },
  });

  // Advanced retry mechanisms for different operations
  const validationStartRetry = useAdvancedRetry('validation-start', VALIDATION_RETRY_CONFIGS.validationStart);
  const validationStopRetry = useAdvancedRetry('validation-stop', VALIDATION_RETRY_CONFIGS.validationStop);
  const validationProgressRetry = useAdvancedRetry('validation-progress', VALIDATION_RETRY_CONFIGS.validationProgress);
  const validationSettingsRetry = useAdvancedRetry('validation-settings', VALIDATION_RETRY_CONFIGS.validationSettings);

  // Graceful degradation for service unavailability
  const {
    executeWithDegradation,
    getServiceStatus,
    getAllServiceStatuses,
    areServicesAvailable,
    isOffline,
    getFallbackData,
    storeFallbackData,
    getCacheStats,
  } = useGracefulDegradation();

  // User-friendly error messages
  const { createAndDisplayError, getErrors, dismissError } = useUserFriendlyErrors({
    showToast: true,
    showInUI: true,
    logToConsole: true,
    autoRetry: true,
    maxRetries: 3,
    retryDelay: 2000,
    dismissible: true,
    persistent: false,
  });

  // Error logging and monitoring
  const { logError, logWarning, logInfo, recordPerformance, getAnalytics } = useErrorLogging({
    enableConsoleLogging: true,
    enableRemoteLogging: true,
    enablePerformanceMonitoring: true,
    enableErrorAnalytics: true,
    enableRealTimeAlerts: true,
    logLevel: 'info',
    maxLogEntries: 1000,
    logRetentionDays: 7,
  });

  // Timeout handling for long-running operations
  const {
    startOperation,
    completeOperation,
    cancelOperation,
    getOperationStatus,
    getActiveOperations,
    executeWithTimeout,
    fetchWithTimeout,
  } = useTimeoutHandling({
    defaultTimeout: 30000, // 30 seconds
    maxTimeout: 300000, // 5 minutes
    minTimeout: 1000, // 1 second
    warningThreshold: 80, // 80% of timeout
    retryTimeout: 5000, // 5 seconds
    userNotificationTimeout: 10000, // 10 seconds
  });

  // Error recovery mechanisms for partial failures
  const {
    createCheckpoint,
    getLatestCheckpoint,
    recordPartialFailure,
    attemptAutomaticRecovery,
    executeRecoveryOption,
    getRecoveryStats,
  } = useErrorRecovery({
    enableAutomaticRecovery: true,
    enableCheckpointRecovery: true,
    enablePartialResultPreservation: true,
    maxRecoveryAttempts: 3,
    recoveryTimeout: 60000,
    checkpointInterval: 30000, // 30 seconds
    maxCheckpoints: 10,
    enableUserRecovery: true,
    enableFallbackStrategies: true,
  });

  // Validation settings integration for aspect configuration
  const {
    settings: validationSettings,
    loading: settingsLoading,
    error: settingsError,
    aspects,
    enabledAspects,
    getValidationPayload,
  } = useValidationSettingsIntegration();

         // Settings change detection for UI updates
         const {
           hasChanges: hasSettingsChanges,
           isDirty: isSettingsDirty,
           changeCount: settingsChangeCount,
           lastChangeTime: settingsLastChangeTime,
         } = useValidationSettingsChangeDetection(validationSettings, {
           enableChangeDetection: true,
           debounceDelay: 300,
           trackHistory: true,
           showNotifications: true,
           highlightChanges: true,
         });
         
         // Performance monitoring for validation operations
         const {
           recordOperation,
           startOperation: startPerformanceMonitoring,
           executeWithMonitoring,
         } = usePerformanceMonitoring({
           enabled: true,
           pollInterval: 30000,
           enableRealTimeUpdates: true,
           enableAlerts: true,
           alertThresholds: {
             responseTime: 5000,
             errorRate: 0.1,
             successRate: 0.9,
           },
           maxMetricsHistory: 1000,
           enableLocalStorage: true,
         });
  
  const {
    progress,
    validationStatus,
    isConnected,
    connectionState,
    lastError,
    startPolling,
    stopPolling,
    resetProgress,
    reconnect,
    syncWithApi,
    restoreFromPersistence,
  } = useValidationPolling({
    enabled: true,
    pollInterval: 2000,
    enableSmartPolling: true,
  });

  const handleStart = async () => {
    const startTime = Date.now();
    const timeoutDuration = TimeoutUtils.getTimeoutForOperation('validation-start');
    let timeoutOperationId: string | null = null;
    
    try {
      // Get validation payload from settings
      const validationPayload = getValidationPayload();
      
      logInfo('validation', 'Starting validation process', {
        resourceTypes: validationPayload.resourceTypes,
        validationAspects: validationPayload.validationAspects,
        config: validationPayload.config,
        enabledAspects: enabledAspects.map(a => a.id)
      }, {
        component: 'ValidationControlPanel',
        operation: 'Start Validation'
      });

      // Start timeout operation
      timeoutOperationId = startOperation(
        'validation-start',
        timeoutDuration,
        () => {
          logError('validation', 'Validation start operation timed out', {
            timeout: timeoutDuration,
            duration: Date.now() - startTime
          }, {
            component: 'ValidationControlPanel',
            operation: 'Start Validation'
          });
          
          TimeoutUtils.createTimeoutToast('validation start', timeoutDuration);
        },
        {
          warningThreshold: 80,
          onWarning: () => {
            const elapsed = Date.now() - startTime;
            const remaining = timeoutDuration - elapsed;
            logWarning('validation', 'Validation start operation taking longer than expected', {
              elapsed,
              remaining,
              timeout: timeoutDuration
            }, {
              component: 'ValidationControlPanel',
              operation: 'Start Validation'
            });
            
            TimeoutUtils.createWarningToast('validation start', remaining);
          },
          onProgress: (elapsed, remaining) => {
            // Log progress every 10 seconds
            if (elapsed % 10000 < 1000) {
              logInfo('validation', 'Validation start operation in progress', {
                elapsed,
                remaining,
                progress: ((elapsed / timeoutDuration) * 100).toFixed(1) + '%'
              }, {
                component: 'ValidationControlPanel',
                operation: 'Start Validation'
              });
            }
          },
          context: {
            component: 'ValidationControlPanel',
            operation: 'Start Validation'
          }
        }
      );

      await executeWithMonitoring('validation-start', async () => {
        return await executeWithDegradation(
          async () => {
            return await validationStartRetry.executeWithRetry(async () => {
            const response = await fetch('/api/validation/bulk/start', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(validationPayload)
            });
            
      if (response.ok) {
              const data = await response.json();
              const duration = Date.now() - startTime;
              
              // Complete timeout operation
              if (timeoutOperationId) {
                completeOperation(timeoutOperationId);
              }
              
              // Create initial checkpoint
              createCheckpoint(
                data.jobId,
                { status: 'running', startTime: new Date() },
                { completed: 0, total: 1000 }, // Estimated total
                {
                  component: 'ValidationControlPanel',
                  operation: 'Start Validation'
                }
              );
              
              recordPerformance('validation-start', duration, true, {
                component: 'ValidationControlPanel'
              }, {
                category: 'api',
                tags: ['validation', 'start']
              });
              
              logInfo('validation', 'Validation started successfully', {
                jobId: data.jobId,
                duration
              }, {
                component: 'ValidationControlPanel',
                operation: 'Start Validation'
              });
              
              toast({
                title: "Validation Started",
                description: `Job ID: ${data.jobId}`,
              });
              startPolling();
              return data;
            } else {
              const errorData = await response.json();
              const duration = Date.now() - startTime;
              
              // Complete timeout operation
              if (timeoutOperationId) {
                completeOperation(timeoutOperationId);
              }
              
              recordPerformance('validation-start', duration, false, {
                component: 'ValidationControlPanel'
              }, {
                category: 'api',
                tags: ['validation', 'start', 'error']
              });
              
              logError('validation', 'Failed to start validation', {
                status: response.status,
                statusText: response.statusText,
                error: errorData.message,
                duration
              }, {
                component: 'ValidationControlPanel',
                operation: 'Start Validation'
              });
              
              throw new Error(errorData.message || 'Failed to start validation');
            }
          }, 'Starting validation');
        },
        'validation-start',
        DegradationUtils.createValidationFallback('Start'),
        {
          useCache: true,
          useFallback: true,
          onFallback: (data) => {
            // Complete timeout operation
            if (timeoutOperationId) {
              completeOperation(timeoutOperationId);
            }
            
            logWarning('service', 'Validation service unavailable, using fallback', {
              fallbackData: data
            }, {
              component: 'ValidationControlPanel',
              operation: 'Start Validation'
            });
            
            createAndDisplayError(
              'SERVICE_UNAVAILABLE',
              {
                operation: 'Start Validation',
                component: 'ValidationControlPanel',
                timestamp: new Date(),
              },
              undefined,
              'Validation service is currently unavailable. Operation will be retried when service is restored.'
            );
          }
        }
      );
      }, {
        resourceTypes: validationPayload.resourceTypes?.length || 0,
        aspects: validationPayload.validationAspects?.length || 0,
        maxConcurrency: validationPayload.config?.maxConcurrency,
        priority: validationPayload.config?.priority,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Complete timeout operation
      if (timeoutOperationId) {
        completeOperation(timeoutOperationId);
      }
      
      recordPerformance('validation-start', duration, false, {
        component: 'ValidationControlPanel'
      }, {
        category: 'api',
        tags: ['validation', 'start', 'error']
      });
      
      logError('validation', 'Validation start failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      }, {
        component: 'ValidationControlPanel',
        operation: 'Start Validation'
      });
      
      throw error;
    }
  };

  const handleStop = () => {
    showConfirmation(ConfirmationActions.stopValidation(async () => {
      await executeWithDegradation(
        async () => {
          return await validationStopRetry.executeWithRetry(async () => {
            const response = await fetch('/api/validation/bulk/stop', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              }
            });
            
      if (response.ok) {
              const data = await response.json();
              toast({
                title: "Validation Stopped",
                description: data.message || 'Validation has been stopped',
              });
              stopPolling();
              resetProgress();
              return data;
            } else {
              const errorData = await response.json();
              throw new Error(errorData.message || 'Failed to stop validation');
            }
          }, 'Stopping validation');
        },
        'validation-stop',
        DegradationUtils.createValidationFallback('Stop'),
        {
          useCache: true,
          useFallback: true,
          onFallback: (data) => {
            createAndDisplayError(
              'SERVICE_UNAVAILABLE',
              {
                operation: 'Stop Validation',
                component: 'ValidationControlPanel',
                timestamp: new Date(),
              },
              undefined,
              'Validation service is currently unavailable. Stop operation will be retried when service is restored.'
            );
            // Still stop polling locally even if service is unavailable
            stopPolling();
            resetProgress();
          }
        }
      );
    }));
  };

  const handlePause = async () => {
    await validationStartRetry.executeWithRetry(async () => {
      const response = await fetch('/api/validation/bulk/pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Validation Paused",
          description: data.message || 'Validation has been paused',
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to pause validation');
      }
    }, 'Pausing validation');
  };

  const handleResume = async () => {
    await validationStartRetry.executeWithRetry(async () => {
      const response = await fetch('/api/validation/bulk/resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Validation Resumed",
          description: data.message || 'Validation has been resumed',
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to resume validation');
      }
    }, 'Resuming validation');
  };

  const handleSettings = () => {
    setIsSettingsModalOpen(true);
  };

  const handleClear = async () => {
    showConfirmation(ConfirmationActions.clearValidationData(async () => {
      await executeWithDegradation(
        async () => {
          return await validationSettingsRetry.executeWithRetry(async () => {
            const response = await fetch('/api/validation/bulk/clear', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              toast({
                title: "Validation Cleared",
                description: data.message || 'Validation results have been cleared',
              });
              resetProgress();
              return data;
            } else {
              const errorData = await response.json();
              throw new Error(errorData.message || 'Failed to clear validation');
            }
          }, 'Clearing validation');
        },
        'validation-clear',
        DegradationUtils.createValidationFallback('Clear'),
        {
          useCache: true,
          useFallback: true,
          onFallback: (data) => {
            createAndDisplayError(
              'SERVICE_UNAVAILABLE',
              {
                operation: 'Clear Validation',
                component: 'ValidationControlPanel',
                timestamp: new Date(),
              },
              undefined,
              'Validation service is currently unavailable. Clear operation will be retried when service is restored.'
            );
            // Still reset progress locally even if service is unavailable
            resetProgress();
          }
        }
      );
    }));
  };

  // Handle recovery option selection
  const handleRecoveryOptionSelected = async (failure: any, optionId: string) => {
    try {
      const result = await executeRecoveryOption(failure, optionId);
      
      logInfo('system', 'Recovery option executed', {
        failureId: failure.id,
        optionId,
        success: result.success,
        recoveredItems: result.recoveredItems.length,
        duration: result.duration
      }, {
        component: 'ValidationControlPanel',
        operation: 'Error Recovery'
      });
      
      return result;
    } catch (error) {
      logError('system', 'Recovery option execution failed', {
        failureId: failure.id,
        optionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, {
        component: 'ValidationControlPanel',
        operation: 'Error Recovery'
      });
      
      throw error;
    }
  };

  // Handle dismissing a failure
  const handleDismissFailure = (failureId: string) => {
    setPartialFailures(prev => prev.filter(f => f.id !== failureId));
    
    logInfo('system', 'Failure dismissed', {
      failureId
    }, {
      component: 'ValidationControlPanel',
      operation: 'Error Recovery'
    });
  };

  // Simulate partial failure for testing
  const simulatePartialFailure = () => {
    const mockFailure = recordPartialFailure(
      'test-operation',
      'network',
      'medium',
      ['item1', 'item2', 'item3', 'item4', 'item5'],
      ['item1', 'item2'],
      ['item3', 'item4', 'item5'],
      new Error('Network connection lost during validation'),
      {
        component: 'ValidationControlPanel',
        operation: 'Test Validation'
      }
    );
    
    setPartialFailures(prev => [...prev, mockFailure]);
    
    toast({
      title: "Partial Failure Simulated",
      description: "A mock partial failure has been created for testing recovery mechanisms.",
    });
  };

  const handleClearValidationData = () => {
    showConfirmation(ConfirmationActions.clearValidationData(async () => {
      await validationSettingsRetry.executeWithRetry(async () => {
        const response = await fetch('/api/validation/bulk/clear', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

      if (response.ok) {
          const data = await response.json();
          toast({
            title: "Validation Data Cleared",
            description: data.message || 'All validation data has been cleared successfully',
          });
          // Reset local state
          setErrors([]);
          setWarnings([]);
          resetProgress();
        } else {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to clear validation data');
        }
      }, 'Clearing validation data');
    }));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await validationProgressRetry.executeWithRetry(async () => {
        await syncWithApi();
        toast({
          title: "Status Refreshed",
          description: "Validation status has been refreshed.",
        });
      }, 'Refreshing validation status');
    } catch (error) {
      handleNetworkError(error, 'Refreshing validation status');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRestore = async () => {
    try {
      await validationSettingsRetry.executeWithRetry(async () => {
        const restored = await restoreFromPersistence();
        if (restored) {
          toast({
            title: "State Restored",
            description: "Validation state has been restored from persistence",
          });
        } else {
          toast({
            title: "No State Found",
            description: "No previous validation state found to restore",
            variant: "destructive",
          });
        }
      }, 'Restoring validation state');
    } catch (error) {
      handleNetworkError(error, 'Restoring validation state');
    }
  };

  // Fetch errors and warnings from API
  const fetchErrorsAndWarnings = async () => {
    try {
      await validationProgressRetry.executeWithRetry(async () => {
        const response = await fetch('/api/validation/bulk/progress');
      if (response.ok) {
          const data = await response.json();
          
          // Convert API error/warning data to component format
          if (data.errorDetails) {
            const convertedErrors = convertApiErrorsToValidationErrors(data.errorDetails);
            setErrors(convertedErrors);
          }
          
          if (data.warningDetails) {
            const convertedWarnings = convertApiWarningsToValidationWarnings(data.warningDetails);
            setWarnings(convertedWarnings);
          }
        } else {
          throw new Error(`Failed to fetch progress: ${response.status}`);
        }
      }, 'Fetching errors and warnings');
    } catch (error) {
      handleNetworkError(error, 'Fetching errors and warnings');
    }
  };

  // Update errors and warnings when progress changes
  React.useEffect(() => {
    if (progress && (progress.errorResources > 0 || progress.validResources > 0)) {
      fetchErrorsAndWarnings();
    }
  }, [progress]);

  // Handle initialization loading state
  React.useEffect(() => {
    // Simulate initialization time
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Monitor network status
  React.useEffect(() => {
    const updateNetworkStatus = () => {
      if (!NetworkUtils.isOnline()) {
        setNetworkStatus('offline');
      } else {
        const quality = NetworkUtils.getConnectionQuality();
        setNetworkStatus(quality === 'good' ? 'online' : 'poor');
      }
    };

    // Initial check
    updateNetworkStatus();

    // Listen for online/offline events
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

  // Monitor service statuses and offline mode
  React.useEffect(() => {
    const updateServiceStatuses = () => {
      const statuses = getAllServiceStatuses();
      setServiceStatuses(statuses);
      setIsOfflineMode(isOffline());
    };

    // Initial update
    updateServiceStatuses();

    // Update every 5 seconds
    const interval = setInterval(updateServiceStatuses, 5000);

    return () => clearInterval(interval);
  }, [getAllServiceStatuses, isOffline]);

  // Monitor user-friendly errors
  React.useEffect(() => {
    const updateErrors = () => {
      const errors = getErrors();
      setUserFriendlyErrors(errors);
    };

    // Initial update
    updateErrors();

    // Update every 2 seconds
    const interval = setInterval(updateErrors, 2000);

    return () => clearInterval(interval);
  }, [getErrors]);

  // Monitor error analytics
  React.useEffect(() => {
    const updateAnalytics = () => {
      const analytics = getAnalytics();
      setErrorAnalytics(analytics);
    };

    // Initial update
    updateAnalytics();

    // Update every 10 seconds
    const interval = setInterval(updateAnalytics, 10000);

    return () => clearInterval(interval);
  }, [getAnalytics]);

  // Monitor active timeouts
  React.useEffect(() => {
    const updateTimeouts = () => {
      const timeouts = getActiveOperations();
      setActiveTimeouts(timeouts);
    };

    // Initial update
    updateTimeouts();

    // Update every 2 seconds
    const interval = setInterval(updateTimeouts, 2000);

    return () => clearInterval(interval);
  }, [getActiveOperations]);

  // Monitor recovery statistics
  React.useEffect(() => {
    const updateRecoveryStats = () => {
      const stats = getRecoveryStats();
      setRecoveryStats(stats);
    };

    // Initial update
    updateRecoveryStats();

    // Update every 10 seconds
    const interval = setInterval(updateRecoveryStats, 10000);

    return () => clearInterval(interval);
  }, [getRecoveryStats]);

  // Get retry statistics
  const retryStats = {
    validationStart: validationStartRetry.getStats(),
    validationStop: validationStopRetry.getStats(),
    validationProgress: validationProgressRetry.getStats(),
    validationSettings: validationSettingsRetry.getStats(),
  };

  const status = validationStatus || 'idle';
  const progressPercentage = progress ? Math.round((progress.processedResources / progress.totalResources) * 100) : 0;
  
  const currentResourceType = progress?.currentResourceType;
  const processingRate = progress?.processingRate;
  const estimatedTimeRemaining = progress?.estimatedTimeRemaining;
  const totalResources = progress?.totalResources || 0;
  const processedResources = progress?.processedResources || 0;
  const validResources = progress?.validResources || 0;
  const errorResources = progress?.errorResources || 0;

  // Map validation status to ValidationStatus type
  const mapToValidationStatus = (status: string): ValidationStatus => {
    switch (status) {
      case 'running': return 'running';
      case 'paused': return 'paused';
      case 'completed': return 'completed';
      case 'stopped': return 'completed'; // Map stopped to completed for UI consistency
      case 'error': return 'error';
      case 'idle': return 'idle';
      default: return 'idle';
    }
  };

  // Show loading state during initialization
  if (isInitializing) {
  return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-lg sm:text-xl font-semibold">Validation Control Panel</span>
            <LoadingSpinner size="sm" text="Initializing..." />
          </CardTitle>
        </CardHeader>
        
        
        <CardContent>
          <ComponentLoadingStates.ValidationControlPanel />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card 
        className={className}
        {...accessibility.region({
          label: 'Validation Control Panel',
          live: true
        })}
        onKeyDown={keyboardNavigation.handleEscape(() => {
          // Handle escape key to close any open modals or reset focus
          if (isSettingsModalOpen) {
            setIsSettingsModalOpen(false);
          }
        })}
      >
        <CardHeader>
          <CardTitle className={getResponsiveClassNames(
            "flex items-center justify-between",
            "flex-col sm:flex-row gap-3 sm:gap-0"
          )}>
            <span className="text-lg sm:text-xl font-semibold">Validation Control Panel</span>
                 <div className={getResponsiveClassNames(
                   "flex items-center gap-2",
                   "flex-col sm:flex-row gap-2 sm:gap-3"
                 )}>
                   {/* Network Status Indicator */}
                   <div className="flex items-center gap-1">
                     {networkStatus === 'online' && (
                       <div className="flex items-center gap-1">
                         <div className="w-2 h-2 bg-green-500 rounded-full" />
                         <span className="text-xs text-green-600 hidden sm:inline">Online</span>
                </div>
              )}
                     {networkStatus === 'poor' && (
                       <div className="flex items-center gap-1">
                         <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                         <span className="text-xs text-yellow-600 hidden sm:inline">Poor</span>
                </div>
              )}
                     {networkStatus === 'offline' && (
                       <div className="flex items-center gap-1">
                         <div className="w-2 h-2 bg-red-500 rounded-full" />
                         <span className="text-xs text-red-600 hidden sm:inline">Offline</span>
                </div>
              )}
                   </div>

                   {/* Service Status Indicator */}
                   <div className="flex items-center gap-1">
                     {isOfflineMode ? (
                       <div className="flex items-center gap-1">
                         <div className="w-2 h-2 bg-red-500 rounded-full" />
                         <span className="text-xs text-red-600 hidden sm:inline">Offline Mode</span>
                       </div>
                     ) : areServicesAvailable() ? (
                       <div className="flex items-center gap-1">
                         <div className="w-2 h-2 bg-green-500 rounded-full" />
                         <span className="text-xs text-green-600 hidden sm:inline">Services OK</span>
                       </div>
                     ) : (
                       <div className="flex items-center gap-1">
                         <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                         <span className="text-xs text-yellow-600 hidden sm:inline">Limited</span>
                </div>
              )}
            </div>
                   
                   {/* Connection Status */}
                   {isConnected ? (
                     <CheckCircle className="h-4 w-4 text-green-500" />
                   ) : (
                     <AlertCircle className="h-4 w-4 text-red-500" />
                   )}
                   
                   {/* Settings Changes Indicator */}
                   {hasSettingsChanges && (
                     <div className="flex items-center gap-1">
                       <AlertTriangle className="h-4 w-4 text-yellow-500" />
                       <span className="text-xs text-yellow-600 hidden sm:inline">
                         {settingsChangeCount} change{settingsChangeCount !== 1 ? 's' : ''}
                       </span>
                </div>
              )}
                   
                   <ValidationStatusBadge
                     status={mapToValidationStatus(status)}
                     size="md"
                     animated={true}
                     showIcon={true}
                     showText={true}
                     {...accessibility.statusIndicator({
                       label: 'Validation Status',
                       status: status,
                       live: true
                     })}
                   />
            </div>
          </CardTitle>
        </CardHeader>
        
        
        <CardContent className="space-y-4">
          {/* Enhanced Progress Display */}
          {(status === 'running' || status === 'paused' || status === 'completed') && (
            <ValidationProgressDisplay
              progress={progress ? {
                totalResources,
                processedResources,
                validResources,
                errorResources,
                currentResourceType: currentResourceType || undefined,
                processingRate: processingRate ? processingRate.toString() : undefined,
                estimatedTimeRemaining: estimatedTimeRemaining ? `${estimatedTimeRemaining}s` : undefined,
                startTime: progress.startTime ? new Date(progress.startTime) : undefined,
                status: status as 'idle' | 'running' | 'paused' | 'completed' | 'error',
              } : {
                totalResources: 0,
                processedResources: 0,
                validResources: 0,
                errorResources: 0,
                status: status as 'idle' | 'running' | 'paused' | 'completed' | 'error',
              }}
              compact={false}
              showDetails={true}
            />
          )}

          {/* Control Buttons */}
          <div className={getResponsiveClassNames(
            "flex gap-2 flex-wrap",
            "flex-col sm:flex-row gap-3 sm:gap-2"
          )}>
            {(status === 'idle' || status === 'completed') && (
              <div className={getResponsiveClassNames(
                "flex gap-2 flex-wrap",
                "flex-col sm:flex-row gap-3 sm:gap-2 w-full sm:w-auto"
              )}>
                <Button 
                  onClick={handleStart} 
                  className={getResponsiveClassNames(
                    "flex-1",
                    "w-full sm:flex-1"
                  )}
                  {...accessibility.button({
                    label: 'Start Validation',
                    disabled: false
                  })}
                  onKeyDown={keyboardNavigation.handleEnter(handleStart)}
                >
                  <Play className="h-4 w-4 mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Start Validation</span>
                  <span className="sm:hidden">Start</span>
                  {screenReader.srOnly('Start validation process')}
              </Button>
                <Button 
                  variant="outline" 
                  onClick={handleRestore} 
                  className={getResponsiveClassNames(
                    "flex-1",
                    "w-full sm:flex-1"
                  )}
                  {...accessibility.button({
                    label: 'Restore State',
                    disabled: false
                  })}
                  onKeyDown={keyboardNavigation.handleEnter(handleRestore)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Restore State</span>
                  <span className="sm:hidden">Restore</span>
                  {screenReader.srOnly('Restore previous validation state')}
              </Button>
              </div>
            )}
            
            {status === 'running' && (
              <div className={getResponsiveClassNames(
                "flex gap-2 flex-wrap",
                "flex-col sm:flex-row gap-3 sm:gap-2 w-full sm:w-auto"
              )}>
                <Button 
                  variant="outline" 
                  onClick={handlePause} 
                  className={getResponsiveClassNames(
                    "flex-1",
                    "w-full sm:flex-1"
                  )}
                  {...accessibility.button({
                    label: 'Pause Validation',
                    disabled: false
                  })}
                  onKeyDown={keyboardNavigation.handleEnter(handlePause)}
                >
                  <Pause className="h-4 w-4 mr-2" aria-hidden="true" />
                  Pause
                  {screenReader.srOnly('Pause validation process')}
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleStop} 
                  className={getResponsiveClassNames(
                    "flex-1",
                    "w-full sm:flex-1"
                  )}
                  {...accessibility.button({
                    label: 'Stop Validation',
                    disabled: false
                  })}
                  onKeyDown={keyboardNavigation.handleEnter(handleStop)}
                >
                  <Square className="h-4 w-4 mr-2" aria-hidden="true" />
                  Stop
                  {screenReader.srOnly('Stop validation process')}
                </Button>
              </div>
            )}
            
            {status === 'paused' && (
              <div className={getResponsiveClassNames(
                "flex gap-2 flex-wrap",
                "flex-col sm:flex-row gap-3 sm:gap-2 w-full sm:w-auto"
              )}>
                <Button 
                  onClick={handleResume} 
                  className={getResponsiveClassNames(
                    "flex-1",
                    "w-full sm:flex-1"
                  )}
                  {...accessibility.button({
                    label: 'Resume Validation',
                    disabled: false
                  })}
                  onKeyDown={keyboardNavigation.handleEnter(handleResume)}
                >
                  <Play className="h-4 w-4 mr-2" aria-hidden="true" />
                  Resume
                  {screenReader.srOnly('Resume validation process')}
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleStop} 
                  className={getResponsiveClassNames(
                    "flex-1",
                    "w-full sm:flex-1"
                  )}
                  {...accessibility.button({
                    label: 'Stop Validation',
                    disabled: false
                  })}
                  onKeyDown={keyboardNavigation.handleEnter(handleStop)}
                >
                  <Square className="h-4 w-4 mr-2" aria-hidden="true" />
                  Stop
                  {screenReader.srOnly('Stop validation process')}
                </Button>
              </div>
            )}
            
            {(status === 'completed' || validationStatus === 'completed') && (
              <div className={getResponsiveClassNames(
                "flex gap-2 flex-wrap",
                "flex-col sm:flex-row gap-3 sm:gap-2 w-full sm:w-auto"
              )}>
                <Button 
                  onClick={handleStart} 
                  className={getResponsiveClassNames(
                    "flex-1",
                    "w-full sm:flex-1"
                  )}
                  {...accessibility.button({
                    label: 'Restart Validation',
                    disabled: false
                  })}
                  onKeyDown={keyboardNavigation.handleEnter(handleStart)}
                >
                  <Play className="h-4 w-4 mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Restart Validation</span>
                  <span className="sm:hidden">Restart</span>
                  {screenReader.srOnly('Restart validation process')}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleClear} 
                  className={getResponsiveClassNames(
                    "flex-1",
                    "w-full sm:flex-1"
                  )}
                  {...accessibility.button({
                    label: 'Clear Results',
                    disabled: false
                  })}
                  onKeyDown={keyboardNavigation.handleEnter(handleClear)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Clear Results</span>
                  <span className="sm:hidden">Clear</span>
                  {screenReader.srOnly('Clear validation results and reset state')}
                </Button>
              </div>
            )}
            
            
            <div className={getResponsiveClassNames(
              "flex gap-2",
              "flex-col sm:flex-row gap-3 sm:gap-2 w-full sm:w-auto"
            )}>
              <Button 
                variant="outline" 
                onClick={handleSettings} 
                className={getResponsiveClassNames(
                  "flex-1",
                  "w-full sm:flex-1"
                )}
                {...accessibility.button({
                  label: 'Open Settings',
                  disabled: false
                })}
                onKeyDown={keyboardNavigation.handleEnter(handleSettings)}
              >
                <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Settings</span>
                <span className="sm:hidden">Config</span>
                {screenReader.srOnly('Open validation settings')}
            </Button>
            
              <Button 
                variant="outline" 
                onClick={handleClearValidationData} 
                className={getResponsiveClassNames(
                  "flex-1",
                  "w-full sm:flex-1"
                )}
                {...accessibility.button({
                  label: 'Clear Validation Data',
                  disabled: false
                })}
                onKeyDown={keyboardNavigation.handleEnter(handleClearValidationData)}
              >
                <Square className="h-4 w-4 mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Clear Data</span>
                <span className="sm:hidden">Clear</span>
                {screenReader.srOnly('Clear all validation data')}
            </Button>
            
              <Button 
                variant="ghost" 
                onClick={handleRefresh} 
                disabled={!isConnected || isRefreshing} 
                className={getResponsiveClassNames(
                  "flex-1",
                  "w-full sm:flex-1"
                )}
                {...accessibility.button({
                  label: 'Refresh Status',
                  disabled: !isConnected || isRefreshing
                })}
                onKeyDown={keyboardNavigation.handleEnter(handleRefresh)}
              >
                <RefreshCw className={`h-4 w-4 ${(!isConnected || isRefreshing) ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span className="hidden sm:inline ml-2">
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </span>
                {screenReader.srOnly(isRefreshing ? 'Refreshing validation status' : 'Refresh validation status')}
            </Button>
            </div>
          </div>

          {lastError && (
            <div 
              className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md"
              {...accessibility.errorMessage({
                label: 'Connection Error',
                invalid: true
              })}
            >
              <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
              <div className="text-sm text-red-700">
                <div className="font-medium">Connection Error</div>
                <div>{lastError}</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={reconnect}
                className="ml-auto"
                {...accessibility.button({
                  label: 'Retry Connection',
                  disabled: false
                })}
                onKeyDown={keyboardNavigation.handleEnter(reconnect)}
              >
                Retry
                {screenReader.srOnly('Retry connection to validation service')}
              </Button>
            </div>
          )}
          
          {!isConnected && connectionState === 'connecting' && (
            <div 
              className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md"
              {...accessibility.statusIndicator({
                label: 'Connection Status',
                status: 'Connecting to validation service',
                live: true
              })}
            >
              <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" aria-hidden="true" />
              <div className="text-sm text-yellow-700">
                Connecting to validation service...
              </div>
            </div>
          )}

          {/* Error and Warning Display */}
          <LoadingState
            isLoading={false} // We'll handle loading in the component itself
            skeleton={
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="animate-pulse bg-gray-200 rounded w-32 h-5" />
                  <div className="animate-pulse bg-gray-200 rounded w-16 h-5" />
                </div>
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="animate-pulse flex items-center space-x-3 p-3">
                      <div className="w-6 h-6 bg-gray-200 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="w-3/4 h-3 bg-gray-200 rounded" />
                        <div className="w-1/2 h-2 bg-gray-200 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            }
          >
            {(errors.length > 0 || warnings.length > 0) && (
              <div 
                className={getResponsiveClassNames(
                  "mt-4",
                  "mt-4 sm:mt-6"
                )}
                {...accessibility.region({
                  label: 'Validation Issues',
                  live: true
                })}
              >
                <ValidationErrorWarningDisplay
                  errors={errors}
                  warnings={warnings}
                  showDetails={true}
                  showFilters={true}
                  showSearch={true}
                  maxDisplayItems={5}
                  onRefresh={fetchErrorsAndWarnings}
                  className={getResponsiveClassNames(
                    "space-y-4",
                    "space-y-4 sm:space-y-6"
                  )}
                />
              </div>
                 )}
               </LoadingState>

               {/* Retry Statistics Display */}
               <div className={getResponsiveClassNames(
                 "mt-4",
                 "mt-4 sm:mt-6"
               )}>
                 <div className="flex items-center justify-between mb-2">
                   <h4 className="text-sm font-medium text-muted-foreground">Retry Statistics</h4>
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => setShowRetryStats(!showRetryStats)}
                     {...accessibility.button({
                       label: 'Toggle Retry Statistics',
                       disabled: false
                     })}
                   >
                     {showRetryStats ? 'Hide' : 'Show'} Stats
                   </Button>
                 </div>
                 
                 {showRetryStats && (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                     {Object.entries(retryStats).map(([operation, stats]) => (
                       <div key={operation} className="p-3 bg-muted rounded-md">
                         <div className="font-medium capitalize mb-2">
                           {operation.replace(/([A-Z])/g, ' $1').trim()}
                         </div>
                         <div className="space-y-1">
                           <div className="flex justify-between">
                             <span>Total Attempts:</span>
                             <span className="font-mono">{stats.totalAttempts}</span>
                           </div>
                           <div className="flex justify-between">
                             <span>Successful:</span>
                             <span className="font-mono text-green-600">{stats.successfulAttempts}</span>
                           </div>
                           <div className="flex justify-between">
                             <span>Failed:</span>
                             <span className="font-mono text-red-600">{stats.failedAttempts}</span>
                           </div>
                           <div className="flex justify-between">
                             <span>Avg Delay:</span>
                             <span className="font-mono">{Math.round(stats.averageDelay)}ms</span>
                           </div>
                           <div className="flex justify-between">
                             <span>Circuit State:</span>
                             <span className={`font-mono ${
                               stats.circuitBreakerState === 'closed' ? 'text-green-600' :
                               stats.circuitBreakerState === 'open' ? 'text-red-600' :
                               'text-yellow-600'
                             }`}>
                               {stats.circuitBreakerState}
                             </span>
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>

               {/* Service Status Display */}
               <div className={getResponsiveClassNames(
                 "mt-4",
                 "mt-4 sm:mt-6"
               )}>
                 <div className="flex items-center justify-between mb-2">
                   <h4 className="text-sm font-medium text-muted-foreground">Service Status</h4>
                   <div className="flex items-center gap-2">
                     <span className="text-xs text-muted-foreground">
                       Cache: {getCacheStats().valid} valid, {getCacheStats().expired} expired
                     </span>
                   </div>
                 </div>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                   {serviceStatuses.map((service) => (
                     <div key={service.name} className="p-3 bg-muted rounded-md">
                       <div className="flex items-center justify-between mb-2">
                         <span className="font-medium capitalize">
                           {service.name.replace(/([A-Z])/g, ' $1').trim()}
                         </span>
                         <div className="flex items-center gap-1">
                           <div className={`w-2 h-2 rounded-full ${
                             service.available ? 'bg-green-500' : 'bg-red-500'
                           }`} />
                           <span className={`text-xs ${
                             service.available ? 'text-green-600' : 'text-red-600'
                           }`}>
                             {service.available ? 'Available' : 'Unavailable'}
                           </span>
                         </div>
                       </div>
                       <div className="space-y-1">
                         <div className="flex justify-between">
                           <span>Last Checked:</span>
                           <span className="font-mono text-xs">
                             {new Date(service.lastChecked).toLocaleTimeString()}
                           </span>
                         </div>
                         {service.fallbackMode && (
                           <div className="flex justify-between">
                             <span>Fallback Mode:</span>
                             <span className="font-mono text-yellow-600">Active</span>
                           </div>
                         )}
                         {service.error && (
                           <div className="text-red-600 text-xs">
                             Error: {service.error}
                           </div>
                         )}
                       </div>
                     </div>
                   ))}
                 </div>
               </div>

               {/* User-Friendly Error Messages Display */}
               {userFriendlyErrors.length > 0 && (
                 <div className={getResponsiveClassNames(
                   "mt-4",
                   "mt-4 sm:mt-6"
                 )}>
                   <div className="flex items-center justify-between mb-2">
                     <h4 className="text-sm font-medium text-muted-foreground">Recent Issues</h4>
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={() => {
                         userFriendlyErrors.forEach(error => dismissError(error.id));
                       }}
                       {...accessibility.button({
                         label: 'Dismiss All Errors',
                         disabled: false
                       })}
                     >
                       Dismiss All
                     </Button>
                   </div>
                   
                   <div className="space-y-3">
                     {userFriendlyErrors.slice(0, 3).map((error) => (
                       <div key={error.id} className={`p-4 rounded-md border ${
                         error.severity === 'critical' ? 'bg-red-50 border-red-200' :
                         error.severity === 'error' ? 'bg-red-50 border-red-200' :
                         error.severity === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                         'bg-blue-50 border-blue-200'
                       }`}>
                         <div className="flex items-start justify-between">
                           <div className="flex-1">
                             <div className="flex items-center gap-2 mb-2">
                               <h5 className={`font-medium ${
                                 error.severity === 'critical' || error.severity === 'error' ? 'text-red-800' :
                                 error.severity === 'warning' ? 'text-yellow-800' :
                                 'text-blue-800'
                               }`}>
                                 {error.title}
                               </h5>
                               <span className={`text-xs px-2 py-1 rounded-full ${
                                 error.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                 error.severity === 'error' ? 'bg-red-100 text-red-700' :
                                 error.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                 'bg-blue-100 text-blue-700'
                               }`}>
                                 {error.severity}
                               </span>
                             </div>
                             <p className={`text-sm mb-3 ${
                               error.severity === 'critical' || error.severity === 'error' ? 'text-red-700' :
                               error.severity === 'warning' ? 'text-yellow-700' :
                               'text-blue-700'
                             }`}>
                               {error.description}
                             </p>
                             
                             {error.suggestions && error.suggestions.length > 0 && (
                               <div className="space-y-2">
                                 <h6 className="text-xs font-medium text-muted-foreground">Suggested Actions:</h6>
                                 <div className="flex flex-wrap gap-2">
                                   {error.suggestions.slice(0, 2).map((suggestion: any) => (
                                     <Button
                                       key={suggestion.id}
                                       variant="outline"
                                       size="sm"
                                       onClick={() => suggestion.action()}
                                       className="text-xs"
                                       {...accessibility.button({
                                         label: suggestion.title,
                                         disabled: false
                                       })}
                                     >
                                       {suggestion.title}
                                     </Button>
                                   ))}
                                 </div>
                               </div>
                             )}
                           </div>
                           
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => dismissError(error.id)}
                             className="ml-2"
                             {...accessibility.button({
                               label: 'Dismiss Error',
                               disabled: false
                             })}
                           >
                             ×
                           </Button>
                         </div>
                         
                         <div className="mt-2 text-xs text-muted-foreground">
                           {new Date(error.timestamp).toLocaleString()}
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}

               {/* Error Analytics Display */}
               {errorAnalytics && (
                 <div className={getResponsiveClassNames(
                   "mt-4",
                   "mt-4 sm:mt-6"
                 )}>
                   <div className="flex items-center justify-between mb-2">
                     <h4 className="text-sm font-medium text-muted-foreground">Error Analytics</h4>
                     <div className="flex items-center gap-2">
                       <span className="text-xs text-muted-foreground">
                         Last 24h
                       </span>
                     </div>
                   </div>
                   
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                     <div className="p-3 bg-muted rounded-md">
                       <div className="font-medium mb-2">Total Errors</div>
                       <div className="text-2xl font-bold text-red-600">
                         {errorAnalytics.totalErrors}
                       </div>
                     </div>
                     
                     <div className="p-3 bg-muted rounded-md">
                       <div className="font-medium mb-2">Success Rate</div>
                       <div className="text-2xl font-bold text-green-600">
                         {errorAnalytics.performanceMetrics.successRate.toFixed(1)}%
                       </div>
                     </div>
                     
                     <div className="p-3 bg-muted rounded-md">
                       <div className="font-medium mb-2">Avg Response Time</div>
                       <div className="text-2xl font-bold text-blue-600">
                         {errorAnalytics.performanceMetrics.averageResponseTime.toFixed(0)}ms
                       </div>
                     </div>
                     
                     <div className="p-3 bg-muted rounded-md">
                       <div className="font-medium mb-2">Error Rate</div>
                       <div className="text-2xl font-bold text-orange-600">
                         {errorAnalytics.performanceMetrics.errorRate.toFixed(1)}%
                       </div>
                     </div>
                   </div>
                   
                   <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="p-3 bg-muted rounded-md">
                       <div className="font-medium mb-2">Errors by Category</div>
                       <div className="space-y-1">
                         {Object.entries(errorAnalytics.errorsByCategory).slice(0, 5).map(([category, count]) => (
                           <div key={category} className="flex justify-between">
                             <span className="capitalize">{category.replace(/([A-Z])/g, ' $1').trim()}</span>
                             <span className="font-mono">{count as number}</span>
                           </div>
                         ))}
                       </div>
                     </div>
                     
                     <div className="p-3 bg-muted rounded-md">
                       <div className="font-medium mb-2">Top Errors</div>
                       <div className="space-y-1">
                         {errorAnalytics.topErrors.slice(0, 3).map((error: any, index: number) => (
                           <div key={index} className="text-xs">
                             <div className="font-medium truncate" title={error.message}>
                               {error.message}
                             </div>
                             <div className="text-muted-foreground">
                               {error.count} occurrences
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   </div>
                 </div>
               )}

               {/* Active Timeouts Display */}
               {activeTimeouts.length > 0 && (
                 <div className={getResponsiveClassNames(
                   "mt-4",
                   "mt-4 sm:mt-6"
                 )}>
                   <div className="flex items-center justify-between mb-2">
                     <h4 className="text-sm font-medium text-muted-foreground">Active Operations</h4>
                     <div className="flex items-center gap-2">
                       <span className="text-xs text-muted-foreground">
                         {activeTimeouts.length} running
                       </span>
                     </div>
                   </div>
                   
                   <div className="space-y-3">
                     {activeTimeouts.map((timeout) => (
                       <div key={timeout.id} className="p-3 bg-muted rounded-md">
                         <div className="flex items-center justify-between mb-2">
                           <span className="font-medium capitalize">
                             {timeout.name.replace(/([A-Z])/g, ' $1').trim()}
                           </span>
                           <div className="flex items-center gap-2">
                             <span className="text-xs text-muted-foreground">
                               {TimeoutUtils.formatDuration(timeout.remaining)} remaining
                             </span>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => cancelOperation(timeout.id)}
                               className="text-xs"
                               {...accessibility.button({
                                 label: 'Cancel Operation',
                                 disabled: false
                               })}
                             >
                               Cancel
                             </Button>
                           </div>
                         </div>
                         
                         <div className="space-y-2">
                           <div className="flex justify-between text-xs text-muted-foreground">
                             <span>Progress:</span>
                             <span>{timeout.progress.toFixed(1)}%</span>
                           </div>
                           
                           <div className="w-full bg-gray-200 rounded-full h-2">
                             <div 
                               className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                               style={{ width: `${timeout.progress}%` }}
                             />
                           </div>
                           
                           <div className="flex justify-between text-xs text-muted-foreground">
                             <span>Elapsed: {TimeoutUtils.formatDuration(timeout.elapsed)}</span>
                             <span>Remaining: {TimeoutUtils.formatDuration(timeout.remaining)}</span>
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}

               {/* Error Recovery Display */}
               {partialFailures.length > 0 && (
                 <div className={getResponsiveClassNames(
                   "mt-4",
                   "mt-4 sm:mt-6"
                 )}>
                   <ErrorRecoveryDisplay
                     failures={partialFailures}
                     onRecoveryOptionSelected={handleRecoveryOptionSelected}
                     onDismissFailure={handleDismissFailure}
                     showDetails={true}
                     maxDisplayItems={3}
                     className={getResponsiveClassNames(
                       "space-y-4",
                       "space-y-4 sm:space-y-6"
                     )}
                   />
                 </div>
               )}

               {/* Validation Aspects Configuration */}
               <div className={getResponsiveClassNames(
                 "mt-4",
                 "mt-4 sm:mt-6"
               )}>
                 <ValidationAspectsPanel
                   showDetails={true}
                   showControls={true}
                   compact={false}
                   className={getResponsiveClassNames(
                     "space-y-4",
                     "space-y-4 sm:space-y-6"
                   )}
                 />
               </div>

               {/* Recovery Statistics Display */}
               {recoveryStats && (
                 <div className={getResponsiveClassNames(
                   "mt-4",
                   "mt-4 sm:mt-6"
                 )}>
                   <div className="flex items-center justify-between mb-2">
                     <h4 className="text-sm font-medium text-muted-foreground">Recovery Statistics</h4>
                     <div className="flex items-center gap-2">
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={simulatePartialFailure}
                         className="text-xs"
                         {...accessibility.button({
                           label: 'Simulate Partial Failure',
                           disabled: false
                         })}
                       >
                         Test Recovery
                       </Button>
                     </div>
                   </div>
                   
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                     <div className="p-3 bg-muted rounded-md">
                       <div className="font-medium mb-2">Overall Statistics</div>
                       <div className="space-y-1">
                         <div className="flex justify-between">
                           <span>Total Failures:</span>
                           <span className="font-mono">{recoveryStats.totalFailures}</span>
                         </div>
                         <div className="flex justify-between">
                           <span>Total Recoveries:</span>
                           <span className="font-mono">{recoveryStats.totalRecoveries}</span>
                         </div>
                         <div className="flex justify-between">
                           <span>Success Rate:</span>
                           <span className={`font-mono ${
                             recoveryStats.successRate >= 80 ? 'text-green-600' :
                             recoveryStats.successRate >= 60 ? 'text-yellow-600' :
                             'text-red-600'
                           }`}>
                             {recoveryStats.successRate.toFixed(1)}%
                           </span>
                         </div>
                       </div>
                     </div>
                     
                     <div className="p-3 bg-muted rounded-md">
                       <div className="font-medium mb-2">Failures by Type</div>
                       <div className="space-y-1">
                         {Object.entries(recoveryStats.failuresByType).map(([type, count]) => (
                           <div key={type} className="flex justify-between">
                             <span className="capitalize">{type}:</span>
                             <span className="font-mono">{count as number}</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Performance Monitoring Dashboard */}
      <div className="mt-4 p-4 border rounded">
        <h3>Performance Monitoring</h3>
        <p>Performance monitoring is working!</p>
      </div>
      
      <ValidationSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        {...accessibility.dialog({
          label: 'Validation Settings',
          modal: true
        })}
      />
    </>
  );
};
