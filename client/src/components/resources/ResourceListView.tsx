import { useLocation } from 'wouter';
import { ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ValidationStatusIndicator, 
  type ResourceValidationStatus 
} from '@/components/validation/ValidationStatusIndicator';
import { getShortId } from "@/lib/resource-utils";

// ============================================================================
// Types
// ============================================================================

export interface Resource {
  id: number;
  resourceType: string;
  fhirId: string;
  validationStatus: ResourceValidationStatus;
  lastModified?: string;
}

interface ResourceListViewProps {
  resources: Resource[];
  isLoading?: boolean;
  onResourceClick?: (resource: Resource) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (resourceKey: string, selected: boolean) => void;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function ResourceListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
          <Skeleton className="h-12 w-12" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="text-center py-12 border rounded-lg bg-gray-50">
      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No resources found</h3>
      <p className="text-sm text-gray-500 mb-4">
        Try adjusting your filters or select a different resource type.
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ResourceListView({ 
  resources, 
  isLoading, 
  onResourceClick,
  selectionMode = false,
  selectedIds = new Set(),
  onSelectionChange,
}: ResourceListViewProps) {
  const [, setLocation] = useLocation();

  const handleResourceClick = (resource: Resource) => {
    // In selection mode, don't navigate on row click
    if (selectionMode) return;
    
    if (onResourceClick) {
      onResourceClick(resource);
    } else {
      setLocation(`/resources/${resource.resourceType}/${resource.fhirId}`);
    }
  };

  const getResourceKey = (resource: Resource) => {
    return `${resource.resourceType}/${resource.fhirId}`;
  };

  const handleCheckboxChange = (resource: Resource, checked: boolean) => {
    if (onSelectionChange) {
      onSelectionChange(getResourceKey(resource), checked);
    }
  };

  if (isLoading) {
    return <ResourceListSkeleton />;
  }

  if (resources.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {selectionMode && (
              <TableHead className="w-[50px]"></TableHead>
            )}
            <TableHead className="w-[150px]">Resource Type</TableHead>
            <TableHead className="w-[200px]">Resource ID</TableHead>
            <TableHead>Validation Status</TableHead>
            <TableHead className="w-[180px]">Last Modified</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resources.map((resource) => {
            const resourceKey = getResourceKey(resource);
            const isSelected = selectedIds.has(resourceKey);
            
            return (
              <TableRow
                key={resourceKey}
                className={`${selectionMode ? '' : 'cursor-pointer'} hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                onClick={() => handleResourceClick(resource)}
              >
                {/* Checkbox (Selection Mode) */}
                {selectionMode && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleCheckboxChange(resource, checked as boolean)}
                    />
                  </TableCell>
                )}

                {/* Resource Type */}
                <TableCell>
                  <Badge variant="secondary" className="font-mono">
                    {resource.resourceType}
                  </Badge>
                </TableCell>

                {/* Resource ID */}
                <TableCell>
                  <code className="text-sm text-gray-700">{getShortId(resource.fhirId)}</code>
                </TableCell>

                {/* Validation Status */}
                <TableCell>
                  <ValidationStatusIndicator 
                    status={resource.validationStatus} 
                    variant="compact"
                  />
                </TableCell>

                {/* Last Modified */}
                <TableCell>
                  <span className="text-sm text-gray-600">
                    {resource.lastModified 
                      ? new Date(resource.lastModified).toLocaleString()
                      : '—'
                    }
                  </span>
                </TableCell>

                {/* Action Button */}
                <TableCell>
                  {!selectionMode && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResourceClick(resource);
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
