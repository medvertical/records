import { useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ValidationStatusIndicator, 
  type ResourceValidationStatus 
} from '@/components/validation/ValidationStatusIndicator';

// ============================================================================
// Types
// ============================================================================

export interface VirtualizedResource {
  id: number;
  resourceType: string;
  fhirId: string;
  validationStatus: ResourceValidationStatus;
  lastModified?: string;
}

interface VirtualizedResourceListProps {
  resources: VirtualizedResource[];
  onResourceClick?: (resource: VirtualizedResource) => void;
  height?: number;
}

// ============================================================================
// Row Component
// ============================================================================

interface RowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    resources: VirtualizedResource[];
    onResourceClick: (resource: VirtualizedResource) => void;
  };
}

function Row({ index, style, data }: RowProps) {
  const resource = data.resources[index];
  
  return (
    <div
      style={style}
      className="flex items-center gap-4 px-4 border-b hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => data.onResourceClick(resource)}
    >
      {/* Resource Type */}
      <div className="w-[150px] flex-shrink-0">
        <Badge variant="secondary" className="font-mono">
          {resource.resourceType}
        </Badge>
      </div>

      {/* Resource ID */}
      <div className="w-[200px] flex-shrink-0">
        <code className="text-sm text-gray-700">{resource.fhirId}</code>
      </div>

      {/* Validation Status */}
      <div className="flex-1">
        <ValidationStatusIndicator 
          status={resource.validationStatus} 
          variant="compact"
        />
      </div>

      {/* Last Modified */}
      <div className="w-[180px] flex-shrink-0">
        <span className="text-sm text-gray-600">
          {resource.lastModified 
            ? new Date(resource.lastModified).toLocaleString()
            : '—'
          }
        </span>
      </div>

      {/* Action Button */}
      <div className="w-[80px] flex-shrink-0 flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={(e) => {
            e.stopPropagation();
            data.onResourceClick(resource);
          }}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function VirtualizedResourceList({ 
  resources, 
  onResourceClick,
  height = 600
}: VirtualizedResourceListProps) {
  const [, setLocation] = useLocation();
  const listRef = useRef<List>(null);

  const handleResourceClick = useCallback((resource: VirtualizedResource) => {
    if (onResourceClick) {
      onResourceClick(resource);
    } else {
      setLocation(`/resources/${resource.resourceType}/${resource.fhirId}`);
    }
  }, [onResourceClick, setLocation]);

  if (resources.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-gray-50">
        <p className="text-gray-500">No resources to display</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 border-b font-medium text-sm text-gray-700">
        <div className="w-[150px] flex-shrink-0">Resource Type</div>
        <div className="w-[200px] flex-shrink-0">Resource ID</div>
        <div className="flex-1">Validation Status</div>
        <div className="w-[180px] flex-shrink-0">Last Modified</div>
        <div className="w-[80px] flex-shrink-0"></div>
      </div>

      {/* Virtualized List */}
      <AutoSizer disableHeight>
        {({ width }) => (
          <List
            ref={listRef}
            height={height}
            itemCount={resources.length}
            itemSize={60} // Height of each row in pixels
            width={width}
            itemData={{
              resources,
              onResourceClick: handleResourceClick,
            }}
          >
            {Row}
          </List>
        )}
      </AutoSizer>
    </div>
  );
}
