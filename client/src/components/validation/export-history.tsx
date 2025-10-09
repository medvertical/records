import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  FileText, 
  Calendar, 
  Check, 
  X,
  Clock,
  Loader2,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ExportJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalRecords: number;
  processedRecords: number;
  createdAt: string;
  completedAt?: string;
  format: string;
  compressed: boolean;
  fileSize?: number;
  error?: string;
  filters: {
    severities?: string[];
    aspects?: string[];
    dateRange?: { start: string; end: string };
  };
}

export function ExportHistory() {
  const { toast } = useToast();
  const [exports, setExports] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadExports();
    // Poll for updates every 5 seconds if there are active exports
    const interval = setInterval(() => {
      if (exports.some(e => e.status === 'queued' || e.status === 'processing')) {
        loadExports();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [exports]);

  const loadExports = async () => {
    try {
      const response = await fetch('/api/validation/export/jobs');
      if (!response.ok) throw new Error('Failed to load exports');
      const data = await response.json();
      setExports(data.jobs || []);
    } catch (error) {
      console.error('Error loading exports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDownload = async (jobId: string) => {
    try {
      const response = await fetch(`/api/validation/export/${jobId}/download`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${jobId}.json.gz`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Downloaded',
        description: 'The export file has been downloaded successfully.',
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to download export file.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      const response = await fetch(`/api/validation/export/${jobId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Delete failed');
      
      setExports(exports.filter(e => e.id !== jobId));
      toast({
        title: 'Export Deleted',
        description: 'The export has been deleted successfully.',
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete export.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case 'queued':
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Queued</Badge>;
      case 'failed':
        return <Badge className="bg-red-500"><X className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Export History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-fhir-blue" />
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
              <FileText className="h-5 w-5" />
              Export History
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              View and manage your validation export jobs
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true);
              loadExports();
            }}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {exports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No exports found</p>
            <p className="text-sm">Export validation results to see them here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {exports.map((exportJob) => (
              <div
                key={exportJob.id}
                className="border rounded-lg p-4 space-y-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(exportJob.status)}
                      <Badge variant="outline" className="text-xs">
                        {exportJob.format.toUpperCase()}
                      </Badge>
                      {exportJob.compressed && (
                        <Badge variant="outline" className="text-xs">
                          Compressed
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(exportJob.createdAt), 'PPp')}
                      </div>
                      {exportJob.completedAt && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Completed {format(new Date(exportJob.completedAt), 'PPp')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {exportJob.status === 'completed' && (
                      <Button
                        size="sm"
                        onClick={() => handleDownload(exportJob.id)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(exportJob.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Progress Bar */}
                {(exportJob.status === 'processing' || exportJob.status === 'queued') && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{exportJob.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-fhir-blue h-2 rounded-full transition-all duration-300"
                        style={{ width: `${exportJob.progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {exportJob.processedRecords} / {exportJob.totalRecords} records
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Records:</span>{' '}
                    <span className="font-medium">{exportJob.totalRecords}</span>
                  </div>
                  {exportJob.fileSize && (
                    <div>
                      <span className="text-muted-foreground">Size:</span>{' '}
                      <span className="font-medium">{formatFileSize(exportJob.fileSize)}</span>
                    </div>
                  )}
                  {exportJob.filters.severities && exportJob.filters.severities.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Severities:</span>{' '}
                      <span className="font-medium">{exportJob.filters.severities.join(', ')}</span>
                    </div>
                  )}
                  {exportJob.filters.aspects && exportJob.filters.aspects.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Aspects:</span>{' '}
                      <span className="font-medium">{exportJob.filters.aspects.length}</span>
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {exportJob.status === 'failed' && exportJob.error && (
                  <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    <span className="font-medium">Error:</span> {exportJob.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

