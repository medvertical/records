// ============================================================================
// Validation Statistics Card
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Target,
  TrendingUp,
  Database,
  AlertTriangle
} from 'lucide-react';
import { ValidationStats } from '@shared/types/dashboard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ValidationAspectBreakdownChart } from './validation-aspect-breakdown-chart';
import { useEffect } from 'react';

interface ValidationStatsCardProps {
  data?: ValidationStats | null;
  isLoading?: boolean;
  error?: string | null;
  lastUpdated?: Date;
}

export function ValidationStatsCard({ 
  data, 
  isLoading = false, 
  error = null, 
  lastUpdated 
}: ValidationStatsCardProps) {
  const queryClient = useQueryClient();
  
  // Fetch current validation settings for aspect indicators
  const { data: validationSettings } = useQuery({
    queryKey: ['validation-settings'],
    queryFn: async () => {
      const response = await fetch('/api/validation/settings');
      if (!response.ok) {
        throw new Error(`Failed to fetch validation settings: ${response.statusText}`);
      }
      const data = await response.json();
      // API returns settings directly, not wrapped in a 'settings' property
      if (!data || typeof data !== 'object') {
        console.warn('[ValidationStatsCard] Invalid validation settings data received:', data);
        return {};
      }
      return data;
    },
    refetchInterval: 5000 // Refresh every 5 seconds to show real-time updates
  });

  // Listen for settings changes to trigger immediate UI updates
  useEffect(() => {
    const handleSettingsChanged = (event: CustomEvent) => {
      console.log('[ValidationStatsCard] Settings changed, invalidating cache');
      queryClient.invalidateQueries({ queryKey: ['validation-settings'] });
    };

    window.addEventListener('settingsChanged', handleSettingsChanged as EventListener);

    return () => {
      window.removeEventListener('settingsChanged', handleSettingsChanged as EventListener);
    };
  }, [queryClient]);

  // Only show loading state if we truly have no data and are actively loading
  // Don't show loading during refetches when we have previous data
  const computedLoading = isLoading && !data && !error;
  
  if (computedLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Validation Statistics
          </CardTitle>
          <CardDescription>Loading validation data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Validation Statistics
          </CardTitle>
          <CardDescription>Error loading validation data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 text-sm">{error}</div>
        </CardContent>
      </Card>
    );
  }

  // Create safe data with proper fallbacks
  const fallbackData: ValidationStats = {
    totalValidated: 0,
    validResources: 0,
    errorResources: 0,
    warningResources: 0,
    unvalidatedResources: 0,
    validationCoverage: 0,
    validationProgress: 0,
    resourceTypeBreakdown: {}
  };

  const safeData: ValidationStats = {
    ...fallbackData,
    ...(data ?? {}),
    resourceTypeBreakdown: data?.resourceTypeBreakdown ?? fallbackData.resourceTypeBreakdown,
    lastValidationRun: data?.lastValidationRun ? new Date(data.lastValidationRun) : fallbackData.lastValidationRun
  };

  const formatNumber = (num: number | undefined) => (num || 0).toLocaleString();
  const formatPercentage = (num: number | undefined) => (num || 0).toFixed(1);

  // Calculate success rate
  const successRate = (safeData.totalValidated || 0) > 0 
    ? ((safeData.validResources || 0) / (safeData.totalValidated || 0)) * 100 
    : 0;

  return (
    <Card className="transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Validation Statistics
        </CardTitle>
        <CardDescription>
          Validation results from local database
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary Statistics */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Validated Resources</div>
              <div className="text-2xl font-bold">{formatNumber(safeData.totalValidated)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Success Rate</div>
              <div className="text-2xl font-bold text-green-600">
                {formatPercentage(successRate)}%
              </div>
            </div>
          </div>

          {/* Validation Coverage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Validation Coverage</span>
              <span className="text-sm font-bold text-blue-600">
                {formatPercentage(safeData.validationCoverage)}%
            </span>
          </div>
            <Progress value={safeData.validationCoverage || 0} className="w-full h-2" />
            <div className="text-xs text-muted-foreground mt-1">
              Percentage of validated resources that are valid
            </div>
          </div>

          {/* Validation Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Validation Progress</span>
              <span className="text-sm font-bold text-purple-600">
                {formatPercentage(safeData.validationProgress)}%
            </span>
          </div>
            <Progress value={safeData.validationProgress || 0} className="w-full h-2" />
            <div className="text-xs text-muted-foreground mt-1">
              Percentage of server resources that have been validated
            </div>
          </div>

          {/* Active Validation Aspects */}
          {validationSettings && (
            <div>
              <div className="text-sm font-medium mb-2">Active Validation Aspects</div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(validationSettings).map(([aspect, config]: [string, any]) => {
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
              <div className="text-xs text-muted-foreground mt-1">
                Only enabled aspects are shown in validation results
              </div>
            </div>
          )}

          {/* Resource Status Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-lg font-bold text-green-600">
                  {formatNumber(safeData.validResources)}
                </div>
                <div className="text-xs text-muted-foreground">Valid</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <div className="text-lg font-bold text-red-600">
                  {formatNumber(safeData.errorResources)}
                </div>
                <div className="text-xs text-muted-foreground">Errors</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="text-lg font-bold text-yellow-600">
                  {formatNumber(safeData.warningResources)}
                </div>
                <div className="text-xs text-muted-foreground">Warnings</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-950/30 rounded-lg">
              <Database className="h-5 w-5 text-gray-500" />
              <div>
                <div className="text-lg font-bold text-gray-600">
                  {formatNumber(safeData.unvalidatedResources)}
                </div>
                <div className="text-xs text-muted-foreground">Unvalidated</div>
              </div>
            </div>
          </div>

          {/* Resource Type Breakdown */}
          {safeData.resourceTypeBreakdown && Object.keys(safeData.resourceTypeBreakdown).length > 0 && (
            <div>
              <div className="text-sm font-medium mb-3">Validation by Resource Type</div>
              <div className="space-y-3">
                {Object.entries(safeData.resourceTypeBreakdown)
                  .sort(([, a], [, b]) => b.total - a.total)
                  .slice(0, 8)
                  .map(([type, breakdown]) => (
                    <div key={type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{type}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatNumber(breakdown.validated)}/{formatNumber(breakdown.total)} validated
                        </div>
                      </div>
                      
                      {/* Validation Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Validation Progress</span>
                          <span className="font-medium">{formatPercentage(breakdown.validationRate || 0)}%</span>
                        </div>
                        <Progress 
                          value={breakdown.validationRate || 0} 
                          className="w-full h-1.5"
                        />
                      </div>
                      
                      {/* Success Rate Bar */}
                      {breakdown.validated > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Success Rate</span>
                            <span className={`font-medium ${
                              (breakdown.successRate || 0) > 80 ? 'text-green-600' : 
                              (breakdown.successRate || 0) > 60 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {formatPercentage(breakdown.successRate || 0)}%
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div 
                              className={`h-1.5 rounded-full transition-all duration-500 ${
                                (breakdown.successRate || 0) > 80 ? 'bg-green-500' : 
                                (breakdown.successRate || 0) > 60 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${breakdown.successRate || 0}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Status Breakdown */}
                      {breakdown.validated > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-muted-foreground">{formatNumber(breakdown.valid)} valid</span>
                          </div>
                          {breakdown.errors > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <span className="text-muted-foreground">{formatNumber(breakdown.errors)} errors</span>
                            </div>
                          )}
                          {breakdown.warnings > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                              <span className="text-muted-foreground">{formatNumber(breakdown.warnings)} warnings</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Validation Aspect Breakdown Chart */}
          {safeData.aspectBreakdown && Object.keys(safeData.aspectBreakdown).length > 0 && (
            <div>
              <div className="text-sm font-medium mb-3">Validation by Aspect</div>
              <ValidationAspectBreakdownChart 
                aspectBreakdown={safeData.aspectBreakdown}
                isLoading={false}
                error={null}
              />
            </div>
          )}

          {/* Last Validation Run */}
          {safeData.lastValidationRun && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Last validation: {safeData.lastValidationRun?.toLocaleString()}</span>
            </div>
          )}

          {/* Data Freshness */}
          {lastUpdated && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Data updated: {lastUpdated.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
