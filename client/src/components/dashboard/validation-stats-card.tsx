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

interface ValidationStatsCardProps {
  data: ValidationStats;
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
  if (isLoading) {
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

  const formatNumber = (num: number | undefined) => (num || 0).toLocaleString();
  const formatPercentage = (num: number | undefined) => (num || 0).toFixed(1);

  // Calculate success rate
  const successRate = data.totalValidated > 0 
    ? (data.validResources / data.totalValidated) * 100 
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
              <div className="text-2xl font-bold">{formatNumber(data.totalValidated)}</div>
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
                {formatPercentage(data.validationCoverage)}%
              </span>
            </div>
            <Progress value={data.validationCoverage} className="w-full h-2" />
            <div className="text-xs text-muted-foreground mt-1">
              Percentage of validated resources that are valid
            </div>
          </div>

          {/* Validation Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Validation Progress</span>
              <span className="text-sm font-bold text-purple-600">
                {formatPercentage(data.validationProgress)}%
              </span>
            </div>
            <Progress value={data.validationProgress} className="w-full h-2" />
            <div className="text-xs text-muted-foreground mt-1">
              Percentage of server resources that have been validated
            </div>
          </div>

          {/* Resource Status Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-lg font-bold text-green-600">
                  {formatNumber(data.validResources)}
                </div>
                <div className="text-xs text-muted-foreground">Valid</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <div className="text-lg font-bold text-red-600">
                  {formatNumber(data.errorResources)}
                </div>
                <div className="text-xs text-muted-foreground">Errors</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="text-lg font-bold text-yellow-600">
                  {formatNumber(data.warningResources)}
                </div>
                <div className="text-xs text-muted-foreground">Warnings</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-950/30 rounded-lg">
              <Database className="h-5 w-5 text-gray-500" />
              <div>
                <div className="text-lg font-bold text-gray-600">
                  {formatNumber(data.unvalidatedResources)}
                </div>
                <div className="text-xs text-muted-foreground">Unvalidated</div>
              </div>
            </div>
          </div>

          {/* Resource Type Breakdown */}
          {data.resourceTypeBreakdown && Object.keys(data.resourceTypeBreakdown).length > 0 && (
            <div>
              <div className="text-sm font-medium mb-3">Validation by Resource Type</div>
              <div className="space-y-2">
                {Object.entries(data.resourceTypeBreakdown)
                  .sort(([, a], [, b]) => b.total - a.total)
                  .slice(0, 5)
                  .map(([type, breakdown]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{type}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-16 bg-muted rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-500 ${
                              (breakdown.successRate || 0) > 80 ? 'bg-green-500' : 
                              (breakdown.successRate || 0) > 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${breakdown.successRate || 0}%` }}
                          />
                        </div>
                        <div className="text-sm text-muted-foreground w-12 text-right">
                          {formatPercentage(breakdown.successRate || 0)}%
                        </div>
                        <div className="text-xs text-muted-foreground w-16 text-right">
                          {formatNumber(breakdown.validated)}/{formatNumber(breakdown.total)}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Last Validation Run */}
          {data.lastValidationRun && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Last validation: {data.lastValidationRun.toLocaleString()}</span>
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
