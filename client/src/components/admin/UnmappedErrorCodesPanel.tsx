/**
 * UnmappedErrorCodesPanel Component
 * 
 * Task 5.13: Admin UI to view unmapped error codes
 * 
 * Features:
 * - Display unmapped HAPI error codes
 * - Usage frequency tracking
 * - Example messages for context
 * - Export for future mapping
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { AlertCircle, Download, RefreshCw, TrendingUp, Clock } from 'lucide-react';
import { apiRequest } from '../../lib/queryClient';

// ============================================================================
// Types
// ============================================================================

interface UnmappedCode {
  code: string;
  count: number;
  lastSeen: string;
  exampleMessage?: string;
}

interface ErrorMappingStats {
  totalMappings: number;
  coverageRate: number;
  unmappedCodes: UnmappedCode[];
}

// ============================================================================
// Component
// ============================================================================

export const UnmappedErrorCodesPanel: React.FC = () => {
  // Fetch statistics
  const { data: statsData, isLoading, refetch } = useQuery({
    queryKey: ['error-mapping-stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/validation/error-mapping/stats');
      return response.data as ErrorMappingStats;
    },
    refetchInterval: 30000 // Refresh every 30s
  });

  const handleExport = () => {
    if (!statsData?.unmappedCodes) return;

    const csv = [
      ['Code', 'Count', 'Last Seen', 'Example Message'].join(','),
      ...statsData.unmappedCodes.map(code => 
        [
          code.code,
          code.count,
          code.lastSeen,
          `"${(code.exampleMessage || '').replace(/"/g, '""')}"`
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unmapped-error-codes-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unmapped Error Codes</CardTitle>
          <CardDescription>Loading statistics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const unmappedCodes = statsData?.unmappedCodes || [];
  const coverageRate = statsData?.coverageRate || 0;

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Unmapped Error Codes</CardTitle>
              <CardDescription>
                HAPI error codes that need mapping definitions
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {unmappedCodes.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleExport}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Coverage Stats */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <p className="text-sm font-medium text-muted-foreground">Coverage Rate</p>
              </div>
              <p className="text-2xl font-bold">
                {coverageRate.toFixed(1)}%
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-1">Total Mappings</p>
              <p className="text-2xl font-bold">{statsData?.totalMappings || 0}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-1">Unmapped</p>
              <p className="text-2xl font-bold text-orange-600">{unmappedCodes.length}</p>
            </div>
          </div>

          {/* Coverage Alert */}
          {coverageRate < 90 && unmappedCodes.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {unmappedCodes.length} error codes need mapping definitions. 
                Target coverage: 95%+
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Unmapped Codes List */}
      {unmappedCodes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unmapped Error Codes</CardTitle>
            <CardDescription>
              Most frequently encountered unmapped codes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {unmappedCodes.map((code, index) => (
                <div 
                  key={code.code}
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        #{index + 1}
                      </Badge>
                      <span className="font-mono font-semibold">
                        {code.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        <span>{code.count}x</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(code.lastSeen).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {code.exampleMessage && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                      <p className="text-muted-foreground mb-1">Example Message:</p>
                      <p className="text-foreground">{code.exampleMessage}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No unmapped error codes</p>
              <p className="text-sm mt-1">
                All encountered HAPI error codes have mapping definitions
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UnmappedErrorCodesPanel;

