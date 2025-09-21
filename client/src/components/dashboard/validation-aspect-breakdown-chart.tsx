// ============================================================================
// Validation Aspect Breakdown Chart
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle,
  Info,
  Settings,
  BarChart3
} from 'lucide-react';
import { ValidationAspectSummary } from '@shared/types/dashboard';

interface ValidationAspectBreakdownChartProps {
  aspectBreakdown: Record<string, ValidationAspectSummary>;
  isLoading?: boolean;
  error?: string | null;
}

export function ValidationAspectBreakdownChart({ 
  aspectBreakdown, 
  isLoading = false, 
  error = null 
}: ValidationAspectBreakdownChartProps) {
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Validation Aspect Breakdown
          </CardTitle>
          <CardDescription>Loading aspect breakdown data...</CardDescription>
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
            Validation Aspect Breakdown
          </CardTitle>
          <CardDescription>Error loading aspect breakdown data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 text-sm">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!aspectBreakdown || Object.keys(aspectBreakdown).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Validation Aspect Breakdown
          </CardTitle>
          <CardDescription>No aspect breakdown data available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Settings className="h-8 w-8 mx-auto mb-2" />
            No validation aspect data to display
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatAspectName = (aspect: string) => {
    return aspect.replace(/([A-Z])/g, ' $1').trim();
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return 'bg-green-100 dark:bg-green-900/30';
    if (score >= 70) return 'bg-yellow-100 dark:bg-yellow-900/30';
    if (score >= 50) return 'bg-orange-100 dark:bg-orange-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  };

  const getProgressColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 70) return 'bg-yellow-500';
    if (score >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Validation Aspect Breakdown
        </CardTitle>
        <CardDescription>
          Detailed breakdown of validation issues by aspect (filtered by enabled aspects)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(aspectBreakdown)
            .sort(([, a], [, b]) => b.score - a.score) // Sort by score descending
            .map(([aspect, breakdown]) => {
              const aspectName = formatAspectName(aspect);
              const scoreColor = getScoreColor(breakdown.score);
              const bgColor = getScoreBgColor(breakdown.score);
              const progressColor = getProgressColor(breakdown.score);
              
              return (
                <div key={aspect} className="space-y-2">
                  {/* Aspect Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{aspectName}</span>
                      <Badge 
                        variant={breakdown.enabled ? "default" : "secondary"}
                        className={breakdown.enabled ? "bg-green-100 text-green-800" : ""}
                      >
                        {breakdown.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <div className={`text-lg font-bold ${scoreColor}`}>
                      {breakdown.score.toFixed(0)}%
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <Progress 
                      value={breakdown.score} 
                      className="w-full h-2"
                      // Custom progress color would need to be implemented
                    />
                  </div>

                  {/* Issue Counts */}
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-red-500" />
                      <span className="text-red-600 font-medium">{breakdown.errorCount}</span>
                      <span className="text-gray-500">Errors</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                      <span className="text-yellow-600 font-medium">{breakdown.warningCount}</span>
                      <span className="text-gray-500">Warnings</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Info className="h-3 w-3 text-blue-500" />
                      <span className="text-blue-600 font-medium">{breakdown.informationCount}</span>
                      <span className="text-gray-500">Info</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-gray-500" />
                      <span className="text-gray-600 font-medium">{breakdown.issueCount}</span>
                      <span className="text-gray-500">Total</span>
                    </div>
                  </div>
                </div>
              );
            })}
          
          {/* Summary */}
          <div className="pt-4 border-t">
            <div className="text-sm text-gray-600">
              <strong>Note:</strong> Only enabled aspects are shown in validation results. 
              Disabled aspects are filtered out during validation result processing.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
