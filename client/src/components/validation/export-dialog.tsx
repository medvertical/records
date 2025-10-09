/**
 * Validation Results Export Dialog
 * 
 * Allows users to export validation results with filters.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface ExportFilters {
  serverId?: number;
  resourceType?: string;
  severity?: string[];
  aspects?: string[];
  dateFrom?: string;
  dateTo?: string;
  format?: 'json' | 'csv';
  includeResources?: boolean;
  compress?: boolean;
}

interface ExportDialogProps {
  serverId?: number;
  resourceType?: string;
  trigger?: React.ReactNode;
}

export function ExportDialog({ serverId, resourceType, trigger }: ExportDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<ExportFilters>({
    serverId,
    resourceType,
    severity: [],
    aspects: [],
    format: 'json',
    includeResources: false,
    compress: true,
  });

  const exportMutation = useMutation({
    mutationFn: async (exportFilters: ExportFilters) => {
      const response = await fetch('/api/validation/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportFilters),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.downloadUrl) {
        // Trigger download
        window.location.href = data.downloadUrl;
        
        toast({
          title: 'Export completed',
          description: `${data.totalRecords} validation results exported successfully`,
        });
        
        setOpen(false);
      } else if (data.jobId) {
        toast({
          title: 'Export started',
          description: 'Large export job started. You will be notified when ready.',
        });
        
        setOpen(false);
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Export failed',
        description: error.message || 'Failed to export validation results',
        variant: 'destructive',
      });
    },
  });

  const handleExport = () => {
    exportMutation.mutate(filters);
  };

  const handleSeverityToggle = (severity: string) => {
    setFilters((prev) => ({
      ...prev,
      severity: prev.severity?.includes(severity)
        ? prev.severity.filter((s) => s !== severity)
        : [...(prev.severity || []), severity],
    }));
  };

  const handleAspectToggle = (aspect: string) => {
    setFilters((prev) => ({
      ...prev,
      aspects: prev.aspects?.includes(aspect)
        ? prev.aspects.filter((a) => a !== aspect)
        : [...(prev.aspects || []), aspect],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Validation Results</DialogTitle>
          <DialogDescription>
            Configure and export validation results with optional filters
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select
              value={filters.format}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, format: value as 'json' | 'csv' }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Severity Filter */}
          <div className="space-y-2">
            <Label>Filter by Severity</Label>
            <div className="flex flex-wrap gap-2">
              {['error', 'warning', 'information'].map((severity) => (
                <div key={severity} className="flex items-center space-x-2">
                  <Checkbox
                    id={`severity-${severity}`}
                    checked={filters.severity?.includes(severity)}
                    onCheckedChange={() => handleSeverityToggle(severity)}
                  />
                  <label
                    htmlFor={`severity-${severity}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
                  >
                    {severity}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Aspects Filter */}
          <div className="space-y-2">
            <Label>Filter by Validation Aspect</Label>
            <div className="flex flex-wrap gap-2">
              {['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'].map(
                (aspect) => (
                  <div key={aspect} className="flex items-center space-x-2">
                    <Checkbox
                      id={`aspect-${aspect}`}
                      checked={filters.aspects?.includes(aspect)}
                      onCheckedChange={() => handleAspectToggle(aspect)}
                    />
                    <label
                      htmlFor={`aspect-${aspect}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
                    >
                      {aspect}
                    </label>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, dateTo: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Additional Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeResources"
                checked={filters.includeResources}
                onCheckedChange={(checked) =>
                  setFilters((prev) => ({ ...prev, includeResources: !!checked }))
                }
              />
              <label
                htmlFor="includeResources"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Include full FHIR resources in export
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="compress"
                checked={filters.compress}
                onCheckedChange={(checked) =>
                  setFilters((prev) => ({ ...prev, compress: !!checked }))
                }
              />
              <label
                htmlFor="compress"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Compress export (gzip)
              </label>
            </div>
          </div>

          {/* Export Info */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Export will include:</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Validation results and messages</li>
              <li>• Resource metadata (type, ID, server)</li>
              <li>• Validation timestamps and settings</li>
              {filters.includeResources && <li>• Full FHIR resources</li>}
              {filters.compress && <li>• Compressed with gzip</li>}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={exportMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exportMutation.isPending}
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

