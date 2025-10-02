// ============================================================================
// Validation Settings Impact Component
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Settings, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  CheckCircle, 
  AlertCircle, 
  AlertTriangle,
  Info,
  BarChart3
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

interface ValidationSettingsImpactProps {
  validationStats?: any;
  isLoading?: boolean;
  error?: string | null;
}

export function ValidationSettingsImpact({ 
  validationStats, 
  isLoading = false, 
  error = null 
}: ValidationSettingsImpactProps) {
  const queryClient = useQueryClient();
  
  // Fetch current validation settings
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
        console.warn('[ValidationSettingsImpact] Invalid validation settings data received:', data);
        return {};
      }
      return data;
    },
    refetchInterval: 5000 // Refresh every 5 seconds to show real-time updates
  });

  // Listen for settings changes to trigger immediate UI updates
  useEffect(() => {
    const handleSettingsChanged = (event: CustomEvent) => {
      console.log('[ValidationSettingsImpact] Settings changed, invalidating cache');
      queryClient.invalidateQueries({ queryKey: ['validation-settings'] });
    };

    window.addEventListener('settingsChanged', handleSettingsChanged as EventListener);

    return () => {
      window.removeEventListener('settingsChanged', handleSettingsChanged as EventListener);
    };
  }, [queryClient]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Validation Settings Impact
          </CardTitle>
          <CardDescription>Loading settings impact analysis...</CardDescription>
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
            Validation Settings Impact
          </CardTitle>
          <CardDescription>Error loading settings impact analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 text-sm">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!validationSettings || !validationStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Validation Settings Impact
          </CardTitle>
          <CardDescription>No settings or validation data available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Settings className="h-8 w-8 mx-auto mb-2" />
            No validation settings or statistics data to analyze
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate impact metrics
  const enabledAspects = Object.values(validationSettings).filter((config: any) => config?.enabled === true).length;
  const totalAspects = Object.keys(validationSettings).length;
  const disabledAspects = totalAspects - enabledAspects;

  // Calculate potential impact on statistics
  const currentValidResources = validationStats.validResources || 0;
  const currentErrorResources = validationStats.errorResources || 0;
  const currentWarningResources = validationStats.warningResources || 0;
  const currentTotalValidated = validationStats.totalValidated || 0;

  // Estimate impact if all aspects were enabled (showing more errors/warnings)
  const estimatedErrorIncrease = disabledAspects > 0 ? Math.round(currentErrorResources * 0.3) : 0;
  const estimatedWarningIncrease = disabledAspects > 0 ? Math.round(currentWarningResources * 0.4) : 0;
  const estimatedValidDecrease = estimatedErrorIncrease + estimatedWarningIncrease;

  // Calculate current validation coverage
  const currentCoverage = currentTotalValidated > 0 
    ? ((currentValidResources) / currentTotalValidated) * 100 
    : 0;

  // Calculate estimated coverage if all aspects were enabled
  const estimatedCoverage = currentTotalValidated > 0 
    ? ((currentValidResources - estimatedValidDecrease) / currentTotalValidated) * 100 
    : 0;

  const formatAspectName = (aspect: string) => {
    return aspect.replace(/([A-Z])/g, ' $1').trim();
  };

  const getImpactIcon = (impact: 'increase' | 'decrease' | 'neutral') => {
    switch (impact) {
      case 'increase':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'decrease':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      case 'neutral':
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getImpactColor = (impact: 'increase' | 'decrease' | 'neutral') => {
    switch (impact) {
      case 'increase':
        return 'text-red-600';
      case 'decrease':
        return 'text-green-600';
      case 'neutral':
        return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Validation Settings Impact
        </CardTitle>
        <CardDescription>
          Analysis of how validation settings affect overall statistics (no re-validation needed)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Current Settings Overview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Current Validation Configuration</span>
              <Badge variant={enabledAspects === totalAspects ? "default" : "secondary"}>
                {enabledAspects}/{totalAspects} aspects enabled
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(validationSettings).map(([aspect, config]: [string, any]) => {
                const aspectName = formatAspectName(aspect);
                const isEnabled = config?.enabled === true;
                
                return (
                  <div key={aspect} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded-md">
                    <span className="text-sm font-medium">{aspectName}</span>
                    <Badge 
                      variant={isEnabled ? "default" : "secondary"}
                      className={isEnabled ? "bg-green-100 text-green-800" : ""}
                    >
                      {isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Impact Analysis */}
          <div>
            <div className="text-sm font-medium mb-3">Impact Analysis</div>
            
            <div className="space-y-4">
              {/* Validation Coverage Impact */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Validation Coverage</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{currentCoverage.toFixed(1)}%</span>
                  {disabledAspects > 0 && (
                    <>
                      <span className="text-gray-400">→</span>
                      <span className={`text-sm font-medium ${getImpactColor('decrease')}`}>
                        {estimatedCoverage.toFixed(1)}%
                      </span>
                      {getImpactIcon('decrease')}
                    </>
                  )}
                </div>
              </div>

              {/* Error Count Impact */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">Error Resources</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{currentErrorResources.toLocaleString()}</span>
                  {disabledAspects > 0 && (
                    <>
                      <span className="text-gray-400">→</span>
                      <span className={`text-sm font-medium ${getImpactColor('increase')}`}>
                        {(currentErrorResources + estimatedErrorIncrease).toLocaleString()}
                      </span>
                      {getImpactIcon('increase')}
                    </>
                  )}
                </div>
              </div>

              {/* Warning Count Impact */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">Warning Resources</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{currentWarningResources.toLocaleString()}</span>
                  {disabledAspects > 0 && (
                    <>
                      <span className="text-gray-400">→</span>
                      <span className={`text-sm font-medium ${getImpactColor('increase')}`}>
                        {(currentWarningResources + estimatedWarningIncrease).toLocaleString()}
                      </span>
                      {getImpactIcon('increase')}
                    </>
                  )}
                </div>
              </div>

              {/* Valid Resources Impact */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Valid Resources</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{currentValidResources.toLocaleString()}</span>
                  {disabledAspects > 0 && (
                    <>
                      <span className="text-gray-400">→</span>
                      <span className={`text-sm font-medium ${getImpactColor('decrease')}`}>
                        {(currentValidResources - estimatedValidDecrease).toLocaleString()}
                      </span>
                      {getImpactIcon('decrease')}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar for Coverage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Validation Coverage Progress</span>
              <span className="text-sm font-bold text-blue-600">
                {currentCoverage.toFixed(1)}%
              </span>
            </div>
            <Progress value={currentCoverage} className="w-full h-2" />
            {disabledAspects > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                Enabling all aspects would reduce coverage to ~{estimatedCoverage.toFixed(1)}%
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="pt-4 border-t">
            <div className="text-sm text-gray-600">
              <strong>Note:</strong> This analysis shows estimated impact based on current validation results. 
              Enabling more aspects would reveal additional validation issues, potentially reducing the 
              number of resources marked as "valid" but providing more comprehensive validation coverage.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
