// ============================================================================
// New Dashboard Component - Using Separated Data Sources
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Database, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  TrendingUp, 
  Play, 
  Pause, 
  Square,
  Zap,
  Timer,
  Target,
  Server,
  Wifi,
  WifiOff,
  RefreshCw,
  Settings
} from 'lucide-react';
import { useValidationPolling, ValidationProgress as PollingValidationProgress } from '@/hooks/use-validation-polling';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { useServerData } from '@/hooks/use-server-data';
import { useValidationSettingsPolling } from '@/hooks/use-validation-settings-polling';
import { ServerStatsCard } from '@/components/dashboard/server-stats-card';
import { ValidationStatsCard } from '@/components/dashboard/validation-stats-card';
import { ValidationSettingsImpact } from '@/components/dashboard/validation-settings-impact';
import ValidationQueueManagement from '@/components/validation/validation-queue-management';
import IndividualResourceProgress from '@/components/validation/individual-resource-progress';
import ValidationCancellationRetry from '@/components/validation/validation-cancellation-retry';
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

interface ValidationProgress {
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  currentResourceType?: string;
  nextResourceType?: string;
  startTime: Date;
  estimatedTimeRemaining?: number;
  isComplete: boolean;
  errors: string[];
  status: 'not_running' | 'running' | 'paused' | 'completed' | 'error';
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

export default function DashboardNew() {
  // Use our new centralized dashboard data hook
  const { activeServer, serverStatus } = useServerData();

          // Enable validation settings polling for real-time updates
          useValidationSettingsPolling({
            enabled: true,
            pollingInterval: 5000, // Poll every 5 seconds
            invalidateCache: true, // Invalidate dashboard cache when settings change
            showNotifications: false // Don't show notifications for automatic polling
          });

  // Fetch current validation settings for progress indicators
  const { data: validationSettings } = useQuery({
    queryKey: ['validation-settings'],
    queryFn: async () => {
      const response = await fetch('/api/validation/settings');
      const data = await response.json();
      return data.settings;
    },
    refetchInterval: 5000 // Refresh every 5 seconds to show real-time updates
  });

  const {
    fhirServerStats,
    validationStats,
    combinedData,
    isLoading,
    isFhirServerLoading,
    isValidationLoading,
    error,
    fhirServerError,
    validationError,
    refetch,
    refetchFhirServer,
    refetchValidation,
    lastUpdated,
    isStale
  } = useDashboardData({
    enableRealTimeUpdates: true, // Enable real-time updates for settings changes
    refetchInterval: 10000, // Poll every 10 seconds for dashboard data updates
    enableCaching: true,
    enabled: true // Enable dashboard data fetching
  });

  // Debug logging in useEffect to avoid re-render issues - reduced dependencies
  useEffect(() => {
    console.log('[Dashboard] Component mounted/updated');
    console.log('[Dashboard] Server data:', { activeServer, serverStatus });
  }, [activeServer?.id]); // Only log when server changes

  // Validation state management
  const [isValidationRunning, setIsValidationRunning] = useState(false);
  const [isValidationPaused, setIsValidationPaused] = useState(false);
  const [isValidationInitializing, setIsValidationInitializing] = useState(false);
  const [validationProgress, setValidationProgress] = useState<PollingValidationProgress | null>(null);
  const [lastFetchUpdate, setLastFetchUpdate] = useState<number>(0);
  const [currentResourceType, setCurrentResourceType] = useState<string>('');
  const [nextResourceType, setNextResourceType] = useState<string>('');
  
  // Track paused time for accurate elapsed time calculation
  const [pausedAt, setPausedAt] = useState<Date | null>(null);
  const [totalPausedTime, setTotalPausedTime] = useState<number>(0);

  // Polling for validation updates (MVP mode) - AUTOMATIC with 3-second intervals
  const { 
    isConnected, 
    connectionState, 
    progress, 
    validationStatus, 
    currentServer,
    connectionAttempts,
    lastConnectedAt,
    reconnect
  } = useValidationPolling({
    enabled: true, // Enable automatic polling for live updates
    pollInterval: 3000, // 3 seconds for live updates
    hasActiveServer: Boolean(activeServer)
  });

  // Note: Validation updates are now handled via polling through the useValidationPolling hook
  // No need for separate fetch logic - polling handles everything

  // Get current validation progress from server (using fetch for now)
  const [currentValidationProgress, setCurrentValidationProgress] = useState<ValidationProgress | null>(null);
  const [recentErrors, setRecentErrors] = useState([]);

  useEffect(() => {
    if (!activeServer) {
      setValidationProgress(null);
      setIsValidationRunning(false);
      setIsValidationPaused(false);
      setIsValidationInitializing(false);
    }
  }, [activeServer]);

  // Fetch validation progress (fallback when polling is not connected)
  useEffect(() => {
    if (!activeServer) {
      setCurrentValidationProgress(null);
      setCurrentResourceType('');
      setNextResourceType('');
      return;
    }

    const fetchValidationProgress = async () => {
      try {
        const response = await fetch('/api/validation/bulk/progress');
        if (response.ok) {
          const data = await response.json();
          // Convert startTime string to Date
          if (data.startTime) {
            data.startTime = new Date(data.startTime);
          }
          setCurrentValidationProgress(data);
          
          // Always update processing blocks from fetch data (polling doesn't provide this)
          setCurrentResourceType(data.currentResourceType || '');
          setNextResourceType(data.nextResourceType || '');
          
          // Only sync frontend state if polling is not connected
          // This prevents fetch from overriding polling updates
          if (!isConnected) {
            setIsValidationRunning(data.status === 'running');
            setIsValidationPaused(data.status === 'paused');
            setIsValidationInitializing(false);
            setLastFetchUpdate(Date.now());
          }
        }
      } catch (error) {
        console.error('Failed to fetch validation progress:', error);
      }
    };

    // Only fetch once on mount - no automatic polling
    fetchValidationProgress();
    // No interval - only fetch manually when refresh button is clicked
  }, [isConnected, activeServer]);

  // Fetch recent errors
  useEffect(() => {
    if (!activeServer) {
      setRecentErrors([]);
      return;
    }

    const fetchRecentErrors = async () => {
      try {
        const response = await fetch('/api/validation/errors/recent');
        if (response.ok) {
          const data = await response.json();
          setRecentErrors(data);
        }
      } catch (error) {
        console.error('Failed to fetch recent errors:', error);
      }
    };

    // Only fetch once on mount - no automatic polling
    fetchRecentErrors();
    // No interval - only fetch manually when refresh button is clicked
  }, [activeServer]);

  // ========================================================================
  // Effects
  // ========================================================================

  // Polling progress updates (near real-time during validation)
  useEffect(() => {
    if (progress) {
      console.log('Polling progress received:', progress);
      // Use polling progress directly (startTime is already a Date)
      setValidationProgress(progress);
      
      // Always update status from polling - it's more accurate than fetch
      // Polling updates should take precedence over periodic fetch updates
      if (progress.status === 'running') {
        setIsValidationRunning(true);
        setIsValidationPaused(false);
      } else if (progress.status === 'paused') {
        setIsValidationRunning(false);
        setIsValidationPaused(true);
      } else if (progress.isComplete || progress.status === 'completed') {
        setIsValidationRunning(false);
        setIsValidationPaused(false);
      }
      
      // Update last fetch time to prevent fetch from overriding polling updates
      setLastFetchUpdate(Date.now());
    }
  }, [progress, currentResourceType, nextResourceType]);

  // Polling status updates
  useEffect(() => {
    // Always process polling status updates - they are more accurate than fetch
    // Polling updates should take precedence over periodic fetch updates
    if (validationStatus === 'running') {
      setIsValidationInitializing(false);
      setIsValidationRunning(true);
      setIsValidationPaused(false);
      // Clear paused time tracking when running
      if (pausedAt) {
        const pauseDuration = Date.now() - pausedAt.getTime();
        setTotalPausedTime(prev => prev + pauseDuration);
        setPausedAt(null);
      }
    } else if (validationStatus === 'paused') {
      setIsValidationInitializing(false);
      setIsValidationRunning(false);
      setIsValidationPaused(true);
      // Track when validation was paused via polling
      if (!pausedAt) {
        setPausedAt(new Date());
      }
    } else if (validationStatus === 'completed') {
      setIsValidationInitializing(false);
      setIsValidationRunning(false);
      setIsValidationPaused(false);
      // Reset paused time tracking when completed
      setPausedAt(null);
      setTotalPausedTime(0);
    } else if (validationStatus === 'error') {
      setIsValidationInitializing(false);
      setIsValidationRunning(false);
      setIsValidationPaused(false);
      // Reset paused time tracking on error
      setPausedAt(null);
      setTotalPausedTime(0);
    }
    
    // Update last fetch time to prevent fetch from overriding polling updates
    setLastFetchUpdate(Date.now());
  }, [validationStatus]);

  // ========================================================================
  // Validation Control Handlers
  // ========================================================================

  const handleStartValidation = async () => {
    setIsValidationInitializing(true);
    setIsValidationRunning(false);
    setIsValidationPaused(false);
    setValidationProgress(null);
    // Reset paused time tracking for new validation
    setPausedAt(null);
    setTotalPausedTime(0);
    
    try {
      const response = await fetch('/api/validation/bulk/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 200 })
      });
      
      if (!response.ok) {
        setIsValidationInitializing(false);
        console.error('Failed to start validation');
      }
    } catch (error) {
      console.error('Failed to start validation:', error);
      setIsValidationInitializing(false);
    }
  };

  const handlePauseValidation = async () => {
    try {
      const response = await fetch('/api/validation/bulk/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        setIsValidationInitializing(false);
        setIsValidationRunning(false);
        setIsValidationPaused(true);
        // Track when validation was paused
        setPausedAt(new Date());
        console.log('Validation paused successfully');
      } else {
        const errorData = await response.json();
        console.error('Failed to pause validation:', response.status, errorData);
        
        // If validation is already paused or not running, sync the state
        if (response.status === 400 && (
          errorData.message?.includes('No validation is currently running') ||
          errorData.message?.includes('Validation is already paused')
        )) {
          console.log('Validation is already paused or not running, syncing state...');
          // Fetch current status to sync state
          const progressResponse = await fetch('/api/validation/bulk/progress');
          if (progressResponse.ok) {
            const progressData = await progressResponse.json();
            setIsValidationRunning(progressData.status === 'running');
            setIsValidationPaused(progressData.status === 'paused');
            setIsValidationInitializing(false);
            // Track when validation was paused
            if (progressData.status === 'paused') {
              setPausedAt(new Date());
            }
          }
        }
      }
    } catch (error) {
      console.error('Error pausing validation:', error);
    }
  };

  const handleResumeValidation = async () => {
    try {
      // First check the current validation status
      const progressResponse = await fetch('/api/validation/bulk/progress');
      if (progressResponse.ok) {
        const progressData = await progressResponse.json();
        
        // If validation is not paused, start it instead
        if (progressData.status !== 'paused') {
          console.log('Validation is not paused, starting new validation instead');
          handleStartValidation();
          return;
        }
      }
      
      const response = await fetch('/api/validation/bulk/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        setIsValidationInitializing(false);
        setIsValidationRunning(true);
        setIsValidationPaused(false);
        // Accumulate paused time when resuming
        if (pausedAt) {
          const pauseDuration = Date.now() - pausedAt.getTime();
          setTotalPausedTime(prev => prev + pauseDuration);
          setPausedAt(null);
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to resume validation:', errorText);
        
        // If resume fails because validation is not paused, try starting instead
        if (response.status === 400 && errorText.includes('No paused validation')) {
          console.log('No paused validation found, starting new validation instead');
          handleStartValidation();
        }
      }
    } catch (error) {
      console.error('Failed to resume validation:', error);
    }
  };

  const handleStopValidation = async () => {
    try {
      const response = await fetch('/api/validation/bulk/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        setIsValidationInitializing(false);
        setIsValidationRunning(false);
        setIsValidationPaused(false);
        setValidationProgress(null);
        // Reset paused time tracking when stopping
        setPausedAt(null);
        setTotalPausedTime(0);
        // Refresh validation stats after stopping
        refetchValidation();
      }
    } catch (error) {
      console.error('Failed to stop validation:', error);
    }
  };

  const handleRevalidateAll = async () => {
    setIsValidationInitializing(true);
    setIsValidationRunning(false);
    setIsValidationPaused(false);
    setValidationProgress(null);
    // Reset paused time tracking for new validation
    setPausedAt(null);
    setTotalPausedTime(0);
    
    try {
      // Use the bulk start endpoint with force revalidation flag
      const response = await fetch('/api/validation/bulk/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          batchSize: 200,
          forceRevalidation: true // Force revalidation of all resources
        })
      });
      
      if (!response.ok) {
        setIsValidationInitializing(false);
        console.error('Failed to start revalidation');
      } else {
        console.log('Revalidation started successfully - all resources will be revalidated');
      }
    } catch (error) {
      console.error('Failed to start revalidation:', error);
      setIsValidationInitializing(false);
    }
  };

  // ========================================================================
  // Utility Functions
  // ========================================================================

  const formatElapsedTime = (startTime: Date) => {
    const now = Date.now();
    const start = new Date(startTime).getTime();
    let elapsed = now - start;
    
    // Subtract total paused time
    elapsed -= totalPausedTime;
    
    // If currently paused, subtract the current pause duration
    if (isValidationPaused && pausedAt) {
      elapsed -= (now - pausedAt.getTime());
    }
    
    // Ensure elapsed time doesn't go negative
    elapsed = Math.max(0, elapsed);
    
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const formatTimeRemaining = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours < 24) {
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h`;
    }
    
    return `${days}d`;
  };

  // Calculate processing rate only when validation is running, accounting for paused time
  const processingRate = (() => {
    if (!currentValidationProgress || !isValidationRunning) return 0;
    
    const now = Date.now();
    const start = new Date(currentValidationProgress.startTime).getTime();
    let elapsedSeconds = (now - start) / 1000;
    
    // Subtract total paused time
    elapsedSeconds -= totalPausedTime / 1000;
    
    // If currently paused, subtract the current pause duration
    if (isValidationPaused && pausedAt) {
      elapsedSeconds -= (now - pausedAt.getTime()) / 1000;
    }
    
    // Ensure elapsed time doesn't go negative
    elapsedSeconds = Math.max(0, elapsedSeconds);
    
    if (elapsedSeconds > 0) {
      return Math.round((currentValidationProgress.processedResources / elapsedSeconds) * 60);
    }
    
    return 0;
  })();

  // Calculate estimated time remaining - use server value if available, otherwise calculate client-side
  const estimatedMinutesRemaining = (() => {
    if (currentValidationProgress?.estimatedTimeRemaining) {
      return Math.round(currentValidationProgress.estimatedTimeRemaining / 1000 / 60);
    }
    
    // Fallback: calculate client-side if server doesn't provide it
    if (currentValidationProgress && isValidationRunning && currentValidationProgress.processedResources > 0) {
      const now = Date.now();
      const start = new Date(currentValidationProgress.startTime).getTime();
      let elapsedSeconds = (now - start) / 1000;
      
      // Subtract total paused time
      elapsedSeconds -= totalPausedTime / 1000;
      
      // If currently paused, subtract the current pause duration
      if (isValidationPaused && pausedAt) {
        elapsedSeconds -= (now - pausedAt.getTime()) / 1000;
      }
      
      // Ensure elapsed time doesn't go negative
      elapsedSeconds = Math.max(0, elapsedSeconds);
      
      if (elapsedSeconds > 0) {
        const processingRate = currentValidationProgress.processedResources / elapsedSeconds; // resources per second
        const remainingResources = currentValidationProgress.totalResources - currentValidationProgress.processedResources;
        const estimatedMs = (remainingResources / processingRate) * 1000;
        return Math.round(estimatedMs / 1000 / 60);
      }
    }
    
    return null;
  })();

  // ========================================================================
  // Render
  // ========================================================================


  return (
    <div className="p-6 space-y-6">
      {/* Header with Data Freshness Indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            FHIR server statistics and validation progress
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
              {isStale && (
                <Badge variant="outline" className="text-orange-600 border-orange-200">
                  Stale
                </Badge>
              )}
            </div>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refetch}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Connection Status Indicator */}
      {activeServer && (
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${
            connectionState === 'connected' ? 'bg-green-500' :
            connectionState === 'connecting' ? 'bg-yellow-500 animate-pulse' :
            connectionState === 'error' ? 'bg-red-500' :
            'bg-gray-400'
          }`} />
          <span className="text-muted-foreground">
            Polling: {connectionState === 'connected' ? 'Connected' :
                     connectionState === 'connecting' ? 'Connecting...' :
                     connectionState === 'error' ? `Error (${connectionAttempts} attempts)` :
                     'Disconnected'}
          </span>
          {lastConnectedAt && connectionState === 'connected' && (
            <span className="text-muted-foreground">
              • Last update: {lastConnectedAt.toLocaleTimeString()}
            </span>
          )}
          {connectionState === 'error' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={reconnect}
              className="ml-2 h-6 px-2 text-xs"
            >
              Retry
            </Button>
          )}
        </div>
      )}

      {/* Real-time Validation Control Panel */}
      {activeServer && (
        <Card className={`border-2 transition-colors duration-300 ${
          isValidationRunning 
            ? 'border-green-500 bg-green-50/50 dark:border-green-400 dark:bg-green-950/20' 
            : isValidationPaused
            ? 'border-orange-500 bg-orange-50/50 dark:border-orange-400 dark:bg-orange-950/20'
            : isValidationInitializing
            ? 'border-yellow-500 bg-yellow-50/50 dark:border-yellow-400 dark:bg-yellow-950/20'
            : 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20'
        }`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className={`h-5 w-5 transition-colors duration-300 ${
                  isValidationRunning ? 'text-green-500 animate-pulse' : 
                  isValidationPaused ? 'text-orange-500' :
                  isValidationInitializing ? 'text-yellow-500' : 'text-blue-500'
                }`} />
                Validation Engine
                {isValidationInitializing ? (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 animate-pulse">
                    INITIALIZING
                  </Badge>
                ) : isValidationRunning ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 animate-pulse">
                    RUNNING
                  </Badge>
                ) : isValidationPaused ? (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                    PAUSED
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>
                Real-time validation progress and system control
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {!isValidationRunning && !isValidationPaused && !isValidationInitializing && (
                <>
                  <Button onClick={handleStartValidation} size="sm" className="gap-2">
                    <Play className="h-4 w-4" />
                    Start Validation
                  </Button>
                  <Button onClick={handleRevalidateAll} size="sm" variant="outline" className="gap-2 border-blue-500 text-blue-600 hover:bg-blue-50">
                    <RefreshCw className="h-4 w-4" />
                    Revalidate All
                  </Button>
                </>
              )}
              
              {(isValidationRunning && !isValidationPaused) && (
                <Button onClick={handlePauseValidation} variant="outline" size="sm" className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50">
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
              )}
              
              {isValidationPaused && (
                <Button onClick={handleResumeValidation} size="sm" className="gap-2 bg-green-600 hover:bg-green-700">
                  <Play className="h-4 w-4" />
                  Resume
                </Button>
              )}

              {(isValidationRunning || isValidationPaused || isValidationInitializing) && (
                <Button onClick={handleStopValidation} variant="outline" size="sm" className="gap-2 border-red-500 text-red-600 hover:bg-red-50">
                  <Square className="h-4 w-4" />
                  Stop
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(isValidationRunning || isValidationPaused || isValidationInitializing) ? (
            <div className="space-y-4">
              {/* Primary Progress Bar */}
              {currentValidationProgress && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Processing: {currentValidationProgress.processedResources?.toLocaleString() || 0} / {currentValidationProgress.totalResources?.toLocaleString() || 0}
                    </span>
                    <span className="text-sm font-bold text-blue-600">
                      {Math.min(100, (currentValidationProgress.processedResources / currentValidationProgress.totalResources) * 100).toFixed(1)}%
                    </span>
                  </div>
                  
                  {/* Current Resource Type Display */}
                  {currentValidationProgress.currentResourceType && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        <Database className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                          Currently processing: <span className="font-bold">{currentValidationProgress.currentResourceType}</span>
                        </span>
                        {currentValidationProgress.nextResourceType && currentValidationProgress.nextResourceType !== currentValidationProgress.currentResourceType && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">
                            → Next: {currentValidationProgress.nextResourceType}
                          </span>
                        )}
                      </div>
                      
                      {/* Validation Aspects Progress */}
                      <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Validation Aspects</div>
                        <div className="flex flex-wrap gap-2">
                          {validationSettings && Object.entries(validationSettings).map(([aspect, config]: [string, any]) => {
                            if (typeof config === 'object' && config.enabled !== undefined) {
                              const aspectNames = {
                                structural: 'Structural',
                                profile: 'Profile',
                                terminology: 'Terminology',
                                reference: 'Reference',
                                businessRule: 'Business Rules',
                                metadata: 'Metadata'
                              };
                              const aspectName = aspectNames[aspect as keyof typeof aspectNames] || aspect;
                              const isEnabled = config.enabled;
                              const severity = config.severity || 'warning';
                              
                              return (
                                <div
                                  key={aspect}
                                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                    isEnabled 
                                      ? severity === 'error' 
                                        ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300' 
                                        : severity === 'warning'
                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300'
                                        : 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                  }`}
                                >
                                  <div className={`w-2 h-2 rounded-full ${
                                    isEnabled 
                                      ? severity === 'error' 
                                        ? 'bg-red-500 animate-pulse' 
                                        : severity === 'warning'
                                        ? 'bg-yellow-500 animate-pulse'
                                        : 'bg-green-500 animate-pulse'
                                      : 'bg-gray-400'
                                  }`} />
                                  {aspectName}
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <Progress 
                    value={Math.min(100, (currentValidationProgress.processedResources / currentValidationProgress.totalResources) * 100)} 
                    className="w-full h-3" 
                  />
                </div>
              )}

              {/* Live Statistics Grid */}
              {currentValidationProgress && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <div className="text-lg font-bold">{currentValidationProgress.validResources?.toLocaleString() || 0}</div>
                      <div className="text-xs text-muted-foreground">Valid</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <div className="text-lg font-bold">{currentValidationProgress.errorResources?.toLocaleString() || 0}</div>
                      <div className="text-xs text-muted-foreground">Errors</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <Timer className="h-5 w-5 text-blue-500" />
                    <div>
                      <div className="text-lg font-bold">
                        {currentValidationProgress.startTime ? formatElapsedTime(currentValidationProgress.startTime) : 'N/A'}
                      </div>
                      <div className="text-xs text-muted-foreground">Elapsed</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                    <Target className="h-5 w-5 text-orange-500" />
                    <div>
                      <div className="text-lg font-bold">
                        {estimatedMinutesRemaining ? formatTimeRemaining(estimatedMinutesRemaining) : 'Calc...'}
                      </div>
                      <div className="text-xs text-muted-foreground">Remaining</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Processing Rate and Current Activity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                  <div>
                    <div className="text-lg font-bold">{processingRate}/min</div>
                    <div className="text-xs text-muted-foreground">Processing Rate</div>
                  </div>
                </div>
                
                {/* Validation Aspects Status */}
                <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg">
                  <Settings className="h-5 w-5 text-indigo-500" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                      Active Validation Aspects
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {validationSettings && Object.entries(validationSettings).map(([aspect, config]: [string, any]) => {
                        const isEnabled = config?.enabled === true;
                        const aspectName = aspect.replace(/([A-Z])/g, ' $1').trim();
                        return (
                          <span
                            key={aspect}
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              isEnabled 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            }`}
                          >
                            {aspectName}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="space-y-2" style={{ 
                  contain: 'layout style paint',
                  transform: 'translateZ(0)',
                  backfaceVisibility: 'hidden',
                  perspective: '1000px',
                  filter: 'none',
                  minHeight: '60px'
                }}>
                  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg" style={{ 
                    transition: 'none !important',
                    willChange: 'auto',
                    contain: 'layout style paint',
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden',
                    isolation: 'isolate',
                    position: 'relative',
                    zIndex: 1,
                    filter: 'none',
                    animation: 'none !important',
                    display: (currentResourceType || nextResourceType) ? 'flex' : 'none'
                  }}>
                    <Zap className="h-5 w-5 text-blue-500" style={{ 
                      transition: 'none !important',
                      willChange: 'auto',
                      animation: 'none !important'
                    }} />
                    <div className="min-w-0 flex-1" style={{ 
                      contain: 'layout style',
                      transform: 'translateZ(0)',
                      filter: 'none'
                    }}>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="text-sm font-medium truncate">{currentResourceType || 'Starting...'}</div>
                          <div className="text-xs text-muted-foreground">Currently Processing</div>
                        </div>
                        {nextResourceType && (
                          <div className="flex-1 border-l border-blue-200 dark:border-blue-800 pl-4">
                            <div className="text-sm font-medium truncate">{nextResourceType}</div>
                            <div className="text-xs text-muted-foreground">Next</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Show status when paused */}
              {isValidationPaused && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full" />
                    <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                      Validation Paused - {validationProgress?.validResources || 0} resources validated, {validationProgress?.errorResources || 0} errors
                    </span>
                  </div>
                  {/* Retry Statistics */}
                  {validationProgress?.retryStatistics && (
                    <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                      Retry Stats: {validationProgress.retryStatistics.totalRetryAttempts} total attempts, 
                      {validationProgress.retryStatistics.successfulRetries} successful, 
                      {validationProgress.retryStatistics.resourcesWithRetries} resources retried
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Idle State Header */}
              <div className="text-center py-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full" />
                  <span className="text-lg font-medium text-gray-700 dark:text-gray-300">Validation Engine Idle</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Ready to validate FHIR resources on your connected server
                </p>
              </div>

              {/* Quick Stats */}
              {fhirServerStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {fhirServerStats.totalResources?.toLocaleString() || '0'}
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">Total Resources</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {fhirServerStats.resourceTypes?.length || '0'}
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400">Resource Types</div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {validationStats?.validResources || '0'}
                    </div>
                    <div className="text-xs text-purple-600 dark:text-purple-400">Valid Resources</div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {validationStats?.errorResources || '0'}
                    </div>
                    <div className="text-xs text-orange-600 dark:text-orange-400">Error Resources</div>
                  </div>
                </div>
              )}

              {/* Validation History & Last Run Statistics */}
              {validationStats && (
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Last Validation Run
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Total Processed:</span>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {((validationStats.validResources || 0) + (validationStats.errorResources || 0)).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Success Rate:</span>
                      <div className="font-medium text-green-600 dark:text-green-400">
                        {validationStats.validResources && validationStats.errorResources 
                          ? `${Math.round((validationStats.validResources / (validationStats.validResources + validationStats.errorResources)) * 100)}%`
                          : '0%'
                        }
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Last Updated:</span>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {validationStats.lastValidated 
                          ? new Date(validationStats.lastValidated).toLocaleDateString()
                          : 'Never'
                        }
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Average Score:</span>
                      <div className="font-medium text-blue-600 dark:text-blue-400">
                        {validationStats.averageValidationScore 
                          ? `${Math.round(validationStats.averageValidationScore)}%`
                          : 'N/A'
                        }
                      </div>
                    </div>
                  </div>
                  
                  {/* Resource Type Breakdown */}
                  {validationStats.resourceTypeBreakdown && Object.keys(validationStats.resourceTypeBreakdown).length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Resource Type Breakdown</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(validationStats.resourceTypeBreakdown)
                          .sort(([,a], [,b]) => (b as any).count - (a as any).count)
                          .slice(0, 6)
                          .map(([resourceType, stats]: [string, any]) => (
                          <div key={resourceType} className="bg-white dark:bg-gray-800 rounded p-2 text-xs">
                            <div className="font-medium text-gray-900 dark:text-gray-100">{resourceType}</div>
                            <div className="text-gray-600 dark:text-gray-400">
                              {stats.count} resources
                            </div>
                            <div className="text-green-600 dark:text-green-400">
                              {stats.successRate ? `${Math.round(stats.successRate)}%` : 'N/A'} success
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Current Settings Summary */}
              {validationSettings && (
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Current Validation Settings
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Active Aspects:</span>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {Object.entries(validationSettings)
                          .filter(([key, value]) => 
                            ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'].includes(key) && 
                            value && typeof value === 'object' && (value as any).enabled
                          ).length} of 6
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Batch Size:</span>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {validationSettings.batchProcessingSettings?.defaultBatchSize || 200}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Resource Filtering:</span>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {validationSettings.resourceTypeFilterSettings?.enabled ? 'Enabled' : 'Disabled'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Resource Type Counts & Validation Readiness */}
              {fhirServerStats && fhirServerStats.resourceTypeCounts && (
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Resource Type Analysis
                  </h3>
                  
                  {/* Top Resource Types */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Top Resource Types</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(fhirServerStats.resourceTypeCounts)
                        .sort(([,a], [,b]) => (b as number) - (a as number))
                        .slice(0, 6)
                        .map(([resourceType, count]: [string, number]) => (
                        <div key={resourceType} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded p-2 text-sm">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{resourceType}</span>
                          <span className="text-gray-600 dark:text-gray-400">{count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Validation Readiness Status */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Validation Readiness</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${activeServer ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {activeServer ? 'Server Connected' : 'No Server'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${validationSettings ? 'bg-green-500' : 'bg-yellow-500'}`} />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {validationSettings ? 'Settings Configured' : 'Default Settings'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${fhirServerStats.totalResources > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {fhirServerStats.totalResources > 0 ? 'Resources Available' : 'No Resources'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Quick Actions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button 
                    onClick={handleStartValidation}
                    disabled={isValidationInitializing}
                    className="h-12 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Full Validation
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleRevalidateAll}
                    disabled={isValidationInitializing}
                    className="h-12"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Revalidate All Resources
                  </Button>
                </div>
              </div>

              {/* Next Steps */}
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Next Steps
                </h3>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Configure validation aspects in the header dropdown</li>
                  <li>• Set resource type filters to focus on specific types</li>
                  <li>• Adjust batch processing settings for optimal performance</li>
                  <li>• Monitor validation progress in real-time once started</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Separated Statistics Cards */}
      {activeServer && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* FHIR Server Statistics */}
          <ServerStatsCard 
            data={fhirServerStats}
            isLoading={isFhirServerLoading}
            error={fhirServerError}
            lastUpdated={lastUpdated || undefined}
          />

          {/* Validation Statistics */}
          <ValidationStatsCard 
            data={validationStats}
            isLoading={isValidationLoading}
            error={validationError}
            lastUpdated={lastUpdated || undefined}
          />
        </div>
      )}

      {/* Retry Statistics */}
      {activeServer && validationProgress?.retryStatistics && (
        <Card className="transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Retry Statistics
            </CardTitle>
            <CardDescription>
              Validation retry performance and success metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {validationProgress.retryStatistics.totalRetryAttempts}
                </div>
                <div className="text-sm text-muted-foreground">Total Retry Attempts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {validationProgress.retryStatistics.successfulRetries}
                </div>
                <div className="text-sm text-muted-foreground">Successful Retries</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {validationProgress.retryStatistics.failedRetries}
                </div>
                <div className="text-sm text-muted-foreground">Failed Retries</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {validationProgress.retryStatistics.averageRetriesPerResource}
                </div>
                <div className="text-sm text-muted-foreground">Avg Retries/Resource</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-700">
                  {validationProgress.retryStatistics.resourcesWithRetries}
                </div>
                <div className="text-sm text-muted-foreground">Resources with Retries</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-700">
                  {validationProgress.retryStatistics.totalRetryDurationMs}ms
                </div>
                <div className="text-sm text-muted-foreground">Total Retry Duration</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Settings Impact Analysis */}
      {activeServer && (
        <div className="grid gap-6">
          <ValidationSettingsImpact 
            validationStats={validationStats}
            isLoading={isValidationLoading}
            error={validationError}
          />
        </div>
      )}

      {/* Validation Queue Management */}
      {activeServer && (
        <div className="grid gap-6">
          <ValidationQueueManagement />
        </div>
      )}

      {/* Individual Resource Progress Tracking */}
      {activeServer && (
        <div className="grid gap-6">
          <IndividualResourceProgress />
        </div>
      )}

      {/* Enhanced Cancellation and Retry Management */}
      {activeServer && (
        <div className="grid gap-6">
          <ValidationCancellationRetry />
        </div>
      )}

      {/* Recent Activity */}
      {activeServer && recentErrors && recentErrors.length > 0 && (
        <Card className="transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Square className="h-5 w-5" />
              Recent Validation Activity
            </CardTitle>
            <CardDescription>
              Latest validation results and error reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentErrors.slice(0, 5).map((error: any, idx: number) => (
                <div key={error.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {error.isValid ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <div className="text-sm font-medium">
                        {error.resourceType} - {error.fhirResourceId?.slice(0, 8)}...
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {error.errorCount} errors, {error.warningCount} warnings
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">
                      {new Date(error.validatedAt).toLocaleTimeString()}
                    </div>
                    <Link href={`/resources/${error.resourceId}`}>
                      <Button variant="ghost" size="sm" className="text-xs h-6 px-2">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Dashboard Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-red-600 text-sm">{error}</div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refetch}
              className="mt-2 gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
