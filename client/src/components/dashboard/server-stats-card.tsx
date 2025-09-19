// ============================================================================
// FHIR Server Statistics Card
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Server, 
  Database, 
  Wifi, 
  WifiOff, 
  Clock,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { FhirServerStats } from '@shared/types/dashboard';
import { useState, useEffect } from 'react';

interface ServerStatsCardProps {
  data?: FhirServerStats | null;
  isLoading?: boolean;
  error?: string | null;
  lastUpdated?: Date;
}

export function ServerStatsCard({ 
  data, 
  isLoading = false, 
  error = null, 
  lastUpdated 
}: ServerStatsCardProps) {
  // Only show loading state if we truly have no data and are actively loading
  // Don't show loading during refetches when we have previous data
  const computedLoading = isLoading && !data && !error;
  
  if (computedLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            FHIR Server Statistics
          </CardTitle>
          <CardDescription>Loading server information...</CardDescription>
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
            FHIR Server Statistics
          </CardTitle>
          <CardDescription>Error loading server data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 text-sm">{error}</div>
        </CardContent>
      </Card>
    );
  }

  // Create safe data with proper fallbacks
  const fallbackData: FhirServerStats = {
    totalResources: 0,
    resourceCounts: {},
    serverInfo: {
      version: 'Unknown',
      connected: false,
      lastChecked: new Date(0),
    },
    resourceBreakdown: []
  };

  const safeData: FhirServerStats = {
    ...fallbackData,
    ...(data ?? {}),
    serverInfo: {
      ...fallbackData.serverInfo,
      ...(data?.serverInfo ?? {}),
      lastChecked: data?.serverInfo?.lastChecked ? new Date(data.serverInfo.lastChecked) : fallbackData.serverInfo.lastChecked
    },
    resourceBreakdown: Array.isArray(data?.resourceBreakdown) ? data!.resourceBreakdown : fallbackData.resourceBreakdown,
    resourceCounts: data?.resourceCounts ?? fallbackData.resourceCounts
  };
  const [fhirVersionInfo, setFhirVersionInfo] = useState<{
    version: string | null;
    isR5: boolean;
    totalResourceTypes: number;
    priorityResourceTypes: string[];
  } | null>(null);

  // Fetch FHIR version information - DISABLED for performance
  // Only fetch when explicitly requested via refresh button
  // useEffect(() => {
  //   const fetchVersionInfo = async () => {
  //     try {
  //       const response = await fetch('/api/dashboard/fhir-version-info');
  //       if (response.ok) {
  //         const info = await response.json();
  //         setFhirVersionInfo(info);
  //       }
  //     } catch (error) {
  //       console.error('Failed to fetch FHIR version info:', error);
  //     }
  //   };
  //
  //   fetchVersionInfo();
  // }, []);

  const formatNumber = (num: number) => num.toLocaleString();
  const formatPercentage = (num: number | undefined) => (num || 0).toFixed(1);

  return (
    <Card className="transition-all duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              FHIR Server Statistics
            </CardTitle>
            <CardDescription>
              Real-time data from the connected FHIR server
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <Badge variant="default">
              Connected
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Server Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">FHIR Version</div>
              <div className="text-lg font-mono flex items-center gap-2">
                {safeData.serverInfo.version || 'Unknown'}
                {fhirVersionInfo && (
                  <Badge variant={fhirVersionInfo.isR5 ? 'default' : 'secondary'} className="text-xs">
                    {fhirVersionInfo.isR5 ? 'R5' : 'R4'}
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Total Resources</div>
              <div className="text-2xl font-bold">{formatNumber(safeData.totalResources || 0)}</div>
            </div>
          </div>

          {/* FHIR Version Details */}
          {fhirVersionInfo && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-blue-600" />
                <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  FHIR {fhirVersionInfo.isR5 ? 'R5' : 'R4'} Resource Types
                </div>
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300">
                Scanning {fhirVersionInfo.totalResourceTypes} resource types 
                ({(fhirVersionInfo.priorityResourceTypes || []).length} priority types first)
              </div>
            </div>
          )}

          {/* Connection Status */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Wifi className="h-5 w-5 text-green-500" />
            <div className="flex-1">
              <div className="text-sm font-medium">
                Server Online
              </div>
              <div className="text-xs text-muted-foreground">
                Last checked: {safeData.serverInfo.lastChecked ? 
                  (typeof (safeData.serverInfo as any)?.lastChecked === 'string' ? 
                    new Date((safeData.serverInfo as any)?.lastChecked).toLocaleTimeString() : 
                    (safeData.serverInfo as any)?.lastChecked.toLocaleTimeString()
                  ) : 'Unknown'
                }
              </div>
            </div>
          </div>

          {/* Resource Distribution */}
          {safeData.resourceBreakdown && safeData.resourceBreakdown.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-3">Resource Distribution</div>
              <div className="space-y-2">
                {safeData.resourceBreakdown.slice(0, 6).map((item) => (
                  <div key={item.type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{item.type}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 bg-muted rounded-full h-1.5">
                        <div 
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, item.percentage)}%` }}
                        />
                      </div>
                      <div className="text-sm text-muted-foreground w-16 text-right">
                        {formatNumber(item.count)}
                      </div>
                      <div className="text-xs text-muted-foreground w-12 text-right">
                        {formatPercentage(item.percentage)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Freshness */}
          {lastUpdated && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Data updated: {lastUpdated ? 
                (typeof lastUpdated === 'string' ? 
                  new Date(lastUpdated).toLocaleTimeString() : 
                  lastUpdated.toLocaleTimeString()
                ) : 'Unknown'
              }</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
