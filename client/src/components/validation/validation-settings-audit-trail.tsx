import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  History, 
  User, 
  Calendar, 
  Settings, 
  CheckCircle, 
  XCircle, 
  RotateCcw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface AuditTrailEntry {
  id: number;
  settingsId: number;
  version: number;
  action: 'created' | 'updated' | 'activated' | 'deactivated' | 'deleted' | 'migrated' | 'rolled_back';
  performedBy: string;
  performedAt: string;
  changeReason?: string;
  changes: {
    type: string;
    changes: Array<{
      field: string;
      action: string;
      previousValue?: any;
      newValue?: any;
    }>;
    summary?: {
      totalChanges: number;
      aspectChanges: number;
      serverChanges: number;
      otherChanges: number;
    };
  };
  metadata?: any;
}

interface AuditTrailStatistics {
  totalEntries: number;
  entriesByAction: Record<string, number>;
  entriesByUser: Record<string, number>;
  recentActivity: AuditTrailEntry[];
}

interface ValidationSettingsAuditTrailProps {
  settingsId?: number;
  className?: string;
}

export default function ValidationSettingsAuditTrail({ 
  settingsId, 
  className 
}: ValidationSettingsAuditTrailProps) {
  const [showStatistics, setShowStatistics] = useState(false);
  const [limit, setLimit] = useState(20);

  // Fetch audit trail history
  const { data: auditHistory, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['/api/validation/settings/audit-trail', settingsId, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (settingsId) params.append('settingsId', settingsId.toString());
      params.append('limit', limit.toString());
      
      const response = await fetch(`/api/validation/settings/audit-trail?${params}`);
      if (!response.ok) throw new Error('Failed to fetch audit trail');
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  // Fetch audit trail statistics
  const { data: statistics, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/validation/settings/audit-trail/statistics'],
    queryFn: async () => {
      const response = await fetch('/api/validation/settings/audit-trail/statistics');
      if (!response.ok) throw new Error('Failed to fetch audit trail statistics');
      return response.json();
    },
    staleTime: 60 * 1000, // 1 minute
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <Plus className="h-4 w-4" />;
      case 'updated':
        return <Settings className="h-4 w-4" />;
      case 'activated':
        return <Eye className="h-4 w-4" />;
      case 'deactivated':
        return <EyeOff className="h-4 w-4" />;
      case 'deleted':
        return <Trash2 className="h-4 w-4" />;
      case 'rolled_back':
        return <RotateCcw className="h-4 w-4" />;
      case 'migrated':
        return <RefreshCw className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created':
        return 'bg-green-50 text-green-600 border-green-200';
      case 'updated':
        return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'activated':
        return 'bg-green-50 text-green-600 border-green-200';
      case 'deactivated':
        return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'deleted':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'rolled_back':
        return 'bg-purple-50 text-purple-600 border-purple-200';
      case 'migrated':
        return 'bg-yellow-50 text-yellow-600 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const formatFieldName = (field: string) => {
    return field
      .replace('validationAspects.', '')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const renderChangeDetails = (changes: AuditTrailEntry['changes']) => {
    if (!changes.changes || changes.changes.length === 0) {
      return <span className="text-gray-500 text-sm">No detailed changes</span>;
    }

    return (
      <div className="space-y-2">
        {changes.summary && (
          <div className="text-xs text-gray-500">
            {changes.summary.totalChanges} total changes: {changes.summary.aspectChanges} aspects, {changes.summary.serverChanges} servers, {changes.summary.otherChanges} other
          </div>
        )}
        <div className="space-y-1">
          {changes.changes.slice(0, 5).map((change, index) => (
            <div key={index} className="text-xs">
              <span className="font-medium">{formatFieldName(change.field)}</span>
              <span className="text-gray-500 ml-2">({change.action})</span>
            </div>
          ))}
          {changes.changes.length > 5 && (
            <div className="text-xs text-gray-500">
              ... and {changes.changes.length - 5} more changes
            </div>
          )}
        </div>
      </div>
    );
  };

  if (historyLoading || statsLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <History className="h-5 w-5 mr-2" />
            Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const auditEntries: AuditTrailEntry[] = auditHistory?.data || [];
  const auditStats: AuditTrailStatistics = statistics?.data || {
    totalEntries: 0,
    entriesByAction: {},
    entriesByUser: {},
    recentActivity: []
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <History className="h-5 w-5 mr-2" />
            Audit Trail
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStatistics(!showStatistics)}
            >
              {showStatistics ? 'Hide' : 'Show'} Statistics
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchHistory()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Statistics Section */}
        {showStatistics && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-3">Audit Trail Statistics</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {auditStats.totalEntries}
                </div>
                <div className="text-sm text-gray-500">Total Entries</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-2">Actions by Type</div>
                <div className="space-y-1">
                  {Object.entries(auditStats.entriesByAction).slice(0, 3).map(([action, count]) => (
                    <div key={action} className="flex items-center justify-between text-xs">
                      <span className="capitalize">{action}</span>
                      <Badge variant="secondary" className="text-xs">
                        {count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-2">Top Users</div>
                <div className="space-y-1">
                  {Object.entries(auditStats.entriesByUser).slice(0, 3).map(([user, count]) => (
                    <div key={user} className="flex items-center justify-between text-xs">
                      <span className="truncate">{user}</span>
                      <Badge variant="secondary" className="text-xs">
                        {count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Audit Trail Entries */}
        <div className="space-y-4">
          {auditEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit trail entries found</p>
              {settingsId && (
                <p className="text-sm mt-2">No changes recorded for these settings yet</p>
              )}
            </div>
          ) : (
            auditEntries.map((entry) => (
              <div key={entry.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <Badge className={`${getActionColor(entry.action)} flex items-center space-x-1`}>
                      {getActionIcon(entry.action)}
                      <span className="capitalize">{entry.action.replace('_', ' ')}</span>
                    </Badge>
                    <div className="flex items-center text-sm text-gray-500">
                      <User className="h-4 w-4 mr-1" />
                      {entry.performedBy}
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      {formatDistanceToNow(new Date(entry.performedAt), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    v{entry.version}
                  </div>
                </div>

                {entry.changeReason && (
                  <div className="mb-3">
                    <div className="text-sm text-gray-600">
                      <strong>Reason:</strong> {entry.changeReason}
                    </div>
                  </div>
                )}

                <div className="text-sm">
                  {renderChangeDetails(entry.changes)}
                </div>

                <div className="mt-3 text-xs text-gray-400">
                  {format(new Date(entry.performedAt), 'PPpp')}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Load More Button */}
        {auditEntries.length >= limit && (
          <div className="mt-4 text-center">
            <Button
              variant="outline"
              onClick={() => setLimit(prev => prev + 20)}
            >
              Load More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
