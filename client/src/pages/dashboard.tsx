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
import { useValidationSSE, ValidationProgress as SSEValidationProgress } from '@/hooks/use-validation-sse';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { useServerData } from '@/hooks/use-server-data';
import { ServerStatsCard } from '@/components/dashboard/server-stats-card';
import { ValidationStatsCard } from '@/components/dashboard/validation-stats-card';
import { useState, useEffect } from 'react';
import { Link } from 'wouter';

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
  const isServerConnected = Boolean(activeServer && serverStatus?.connected);

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
    enableRealTimeUpdates: true,
    refetchInterval: 300000, // 5 minutes (reduced for better performance)
    enableCaching: true,
    enabled: isServerConnected
  });

  // Validation state management
  const [isValidationRunning, setIsValidationRunning] = useState(false);
  const [isValidationPaused, setIsValidationPaused] = useState(false);
  const [isValidationInitializing, setIsValidationInitializing] = useState(false);
  const [validationProgress, setValidationProgress] = useState<SSEValidationProgress | null>(null);
  const [lastFetchUpdate, setLastFetchUpdate] = useState<number>(0);
  const [currentResourceType, setCurrentResourceType] = useState<string>('');
  const [nextResourceType, setNextResourceType] = useState<string>('');
  
  // Track paused time for accurate elapsed time calculation
  const [pausedAt, setPausedAt] = useState<Date | null>(null);
  const [totalPausedTime, setTotalPausedTime] = useState<number>(0);

  // SSE for real-time validation updates
  const { isConnected, progress, validationStatus, currentServer } = useValidationSSE(isServerConnected);

  // Note: Settings change notifications are now handled via SSE through the useValidationSSE hook
  // No need for separate event listeners - SSE handles everything

  // Get current validation progress from server (using fetch for now)
  const [currentValidationProgress, setCurrentValidationProgress] = useState<ValidationProgress | null>(null);
  const [recentErrors, setRecentErrors] = useState([]);

  useEffect(() => {
    if (!isServerConnected) {
      setValidationProgress(null);
      setIsValidationRunning(false);
      setIsValidationPaused(false);
      setIsValidationInitializing(false);
    }
  }, [isServerConnected]);

  // Fetch validation progress (fallback when SSE is not connected)
  useEffect(() => {
    if (!isServerConnected) {
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
          
          // Always update processing blocks from fetch data (SSE doesn't provide this)
          setCurrentResourceType(data.currentResourceType || '');
          setNextResourceType(data.nextResourceType || '');
          
          // Only sync frontend state if SSE is not connected
          // This prevents fetch from overriding real-time SSE updates
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

    const interval = setInterval(fetchValidationProgress, 5000); // 5 seconds for processing blocks
    fetchValidationProgress(); // Initial fetch
    return () => clearInterval(interval);
  }, [isConnected, isServerConnected]);

  // Fetch recent errors
  useEffect(() => {
    if (!isServerConnected) {
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

    const interval = setInterval(fetchRecentErrors, 30000); // Reduced from 10s to 30s
    fetchRecentErrors(); // Initial fetch
    return () => clearInterval(interval);
  }, [isServerConnected]);

  // ========================================================================
  // Effects
  // ========================================================================

  // SSE progress updates (real-time during validation)
  useEffect(() => {
    if (progress) {
      console.log('SSE progress received:', progress);
      // Use SSE progress directly (startTime is already a string)
      setValidationProgress(progress);
      
      // Always update status from SSE - it's real-time and more accurate than fetch
      // SSE updates should take precedence over periodic fetch updates
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
      
      // Update last fetch time to prevent fetch from overriding SSE updates
      setLastFetchUpdate(Date.now());
    }
  }, [progress, currentResourceType, nextResourceType]);

  // SSE status updates
  useEffect(() => {
    // Always process SSE status updates - they are real-time and more accurate
    // SSE updates should take precedence over periodic fetch updates
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
      // Track when validation was paused via SSE
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
    
    // Update last fetch time to prevent fetch from overriding SSE updates
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

      {/* Server Switching Indicator */}
      {currentServer && currentServer.id && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-blue-500" />
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Connected to: {currentServer.name}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                {currentServer.url}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-green-600 dark:text-green-400">SSE Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-red-600 dark:text-red-400">SSE Disconnected</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Real-time Validation Control Panel */}
      {currentServer && (
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
                <Button onClick={handleStartValidation} size="sm" className="gap-2">
                  <Play className="h-4 w-4" />
                  Start Validation
                </Button>
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Processing: {currentValidationProgress.processedResources?.toLocaleString() || 0} / {currentValidationProgress.totalResources?.toLocaleString() || 0}
                    </span>
                    <span className="text-sm font-bold text-blue-600">
                      {Math.min(100, (currentValidationProgress.processedResources / currentValidationProgress.totalResources) * 100).toFixed(1)}%
                    </span>
                  </div>
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
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-muted-foreground mb-4">Validation engine is idle</div>
              <div className="text-sm text-muted-foreground">
                Click "Start Validation" to begin processing resources
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* No Server Connected State */}
      {!currentServer && (
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No FHIR Server Connected</h3>
            <p className="text-sm text-gray-500 text-center mb-6 max-w-md">
              Connect to a FHIR server to view dashboard statistics, browse resources, and run validation.
            </p>
            <div className="flex gap-3">
              <Button 
                variant="default" 
                onClick={() => window.location.href = '/settings'}
                className="gap-2"
              >
                <Server className="h-4 w-4" />
                Connect Server
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/settings'}
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Separated Statistics Cards */}
      {currentServer && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* FHIR Server Statistics */}
          <ServerStatsCard 
            data={fhirServerStats!}
            isLoading={isFhirServerLoading}
            error={fhirServerError}
            lastUpdated={lastUpdated || undefined}
          />

          {/* Validation Statistics */}
          <ValidationStatsCard 
            data={validationStats!}
            isLoading={isValidationLoading}
            error={validationError}
            lastUpdated={lastUpdated || undefined}
          />
        </div>
      )}

      {/* Recent Activity */}
      {currentServer && recentErrors && recentErrors.length > 0 && (
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
