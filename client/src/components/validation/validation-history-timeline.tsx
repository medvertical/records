import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ValidationEvent {
  id: string;
  timestamp: string;
  resourceType: string;
  resourceId: string;
  status: 'success' | 'warning' | 'error';
  errorCount: number;
  warningCount: number;
  infoCount: number;
  totalIssues: number;
  score?: number;
  aspects: string[];
  duration?: number;
}

export function ValidationHistoryTimeline() {
  const [events, setEvents] = useState<ValidationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'warning' | 'error'>('all');

  useEffect(() => {
    loadHistory();
    // Refresh every 30 seconds
    const interval = setInterval(loadHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      // TODO: Replace with real API call to /api/validation/history
      // const response = await fetch('/api/validation/history?limit=10');
      // const data = await response.json();
      // setEvents(data.events || []);
      
      // Mock data for demonstration
      const mockEvents: ValidationEvent[] = [
        {
          id: '1',
          timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
          resourceType: 'Patient',
          resourceId: 'patient-123',
          status: 'success',
          errorCount: 0,
          warningCount: 0,
          infoCount: 2,
          totalIssues: 2,
          score: 98,
          aspects: ['structural', 'profile', 'terminology'],
          duration: 1200
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
          resourceType: 'Observation',
          resourceId: 'obs-456',
          status: 'warning',
          errorCount: 0,
          warningCount: 3,
          infoCount: 1,
          totalIssues: 4,
          score: 85,
          aspects: ['structural', 'profile', 'terminology', 'metadata'],
          duration: 1500
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
          resourceType: 'Encounter',
          resourceId: 'enc-789',
          status: 'error',
          errorCount: 2,
          warningCount: 1,
          infoCount: 0,
          totalIssues: 3,
          score: 65,
          aspects: ['structural', 'reference'],
          duration: 800
        },
        {
          id: '4',
          timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
          resourceType: 'Patient',
          resourceId: 'patient-456',
          status: 'success',
          errorCount: 0,
          warningCount: 1,
          infoCount: 3,
          totalIssues: 4,
          score: 92,
          aspects: ['structural', 'profile', 'metadata'],
          duration: 1100
        }
      ];
      setEvents(mockEvents);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500">Success</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">Warning</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getScoreTrend = (score?: number) => {
    if (!score) return null;
    if (score >= 90) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (score >= 70) return <Minus className="h-4 w-4 text-yellow-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    return event.status === filter;
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Validation History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-fhir-blue" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Validation History Timeline
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Recent validation events and results
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button
                variant={filter === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter('all')}
                className="h-7 px-2"
              >
                All
              </Button>
              <Button
                variant={filter === 'success' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter('success')}
                className="h-7 px-2"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Success
              </Button>
              <Button
                variant={filter === 'warning' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter('warning')}
                className="h-7 px-2"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Warning
              </Button>
              <Button
                variant={filter === 'error' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter('error')}
                className="h-7 px-2"
              >
                <XCircle className="h-3 w-3 mr-1" />
                Error
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadHistory}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No validation events found</p>
            <p className="text-sm">Validation history will appear here</p>
          </div>
        ) : (
          <div className="relative space-y-4">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

            {filteredEvents.map((event, index) => (
              <div key={event.id} className="relative pl-14">
                {/* Timeline dot */}
                <div className="absolute left-3 top-3 w-6 h-6 rounded-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center">
                  {getStatusIcon(event.status)}
                </div>

                {/* Event card */}
                <div className={cn(
                  "border rounded-lg p-4 space-y-3 bg-white dark:bg-gray-800/50",
                  "hover:shadow-md transition-shadow"
                )}>
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {event.resourceType}/{event.resourceId}
                        </span>
                        {getStatusBadge(event.status)}
                        {event.score && (
                          <div className="flex items-center gap-1">
                            {getScoreTrend(event.score)}
                            <span className="text-xs font-medium">
                              Score: {event.score}%
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(event.timestamp), 'PPp')}
                        {event.duration && (
                          <span className="ml-2">
                            • Duration: {event.duration}ms
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="flex items-center gap-4 text-xs">
                    {event.errorCount > 0 && (
                      <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                        <XCircle className="h-3 w-3" />
                        <span>{event.errorCount} Error{event.errorCount > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {event.warningCount > 0 && (
                      <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{event.warningCount} Warning{event.warningCount > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {event.infoCount > 0 && (
                      <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                        <Info className="h-3 w-3" />
                        <span>{event.infoCount} Info</span>
                      </div>
                    )}
                  </div>

                  {/* Aspects */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {event.aspects.map(aspect => (
                      <Badge key={aspect} variant="outline" className="text-xs">
                        {aspect}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

