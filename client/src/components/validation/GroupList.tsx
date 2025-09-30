import { useState } from 'react';
import { useLocation } from 'wouter';
import { AlertTriangle, Info, ChevronRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ValidationGroup } from '@/hooks/use-validation-groups';
import type { ValidationSeverity, ValidationAspect } from '@/components/filters';

// ============================================================================
// Types
// ============================================================================

interface GroupListProps {
  groups: ValidationGroup[];
  isLoading?: boolean;
  onGroupSelect?: (signature: string) => void;
}

// ============================================================================
// Helper Components
// ============================================================================

function SeverityIcon({ severity }: { severity: ValidationSeverity }) {
  switch (severity) {
    case 'error':
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case 'information':
      return <Info className="h-4 w-4 text-blue-600" />;
  }
}

function SeverityBadge({ severity }: { severity: ValidationSeverity }) {
  const colors = {
    error: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    information: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  return (
    <Badge variant="outline" className={colors[severity]}>
      {severity}
    </Badge>
  );
}

function AspectBadge({ aspect }: { aspect: ValidationAspect }) {
  const labels: Record<ValidationAspect, string> = {
    structural: 'Structural',
    profile: 'Profile',
    terminology: 'Terminology',
    reference: 'Reference',
    businessRule: 'Business',
    metadata: 'Metadata',
  };

  return (
    <Badge variant="secondary" className="font-mono text-xs">
      {labels[aspect]}
    </Badge>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function GroupListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GroupList({ groups, isLoading, onGroupSelect }: GroupListProps) {
  const [, setLocation] = useLocation();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const handleGroupClick = (signature: string) => {
    if (onGroupSelect) {
      onGroupSelect(signature);
    } else {
      // Navigate to group members view
      setLocation(`/validation/groups/${encodeURIComponent(signature)}`);
    }
  };

  if (isLoading) {
    return <GroupListSkeleton />;
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No message groups found</h3>
        <p className="text-sm text-gray-500">
          Try adjusting your filters or validate resources to see groups.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Severity</TableHead>
            <TableHead className="w-[120px]">Aspect</TableHead>
            <TableHead className="w-[120px]">Code</TableHead>
            <TableHead>Canonical Path</TableHead>
            <TableHead>Sample Message</TableHead>
            <TableHead className="w-[100px] text-right">Resources</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <TableRow
              key={group.signature}
              className="cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => handleGroupClick(group.signature)}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  <SeverityIcon severity={group.severity} />
                  <SeverityBadge severity={group.severity} />
                </div>
              </TableCell>
              
              <TableCell>
                <AspectBadge aspect={group.aspect} />
              </TableCell>
              
              <TableCell>
                {group.code ? (
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {group.code}
                  </code>
                ) : (
                  <span className="text-gray-400 text-xs">—</span>
                )}
              </TableCell>
              
              <TableCell>
                <code className="text-xs text-gray-700">
                  {group.canonicalPath}
                </code>
              </TableCell>
              
              <TableCell>
                <div className="max-w-md">
                  <p className="text-sm text-gray-600 truncate" title={group.sampleMessageText}>
                    {group.sampleMessageText}
                  </p>
                </div>
              </TableCell>
              
              <TableCell className="text-right">
                <Badge variant="outline" className="font-semibold">
                  {group.totalResources}
                </Badge>
              </TableCell>
              
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGroupClick(group.signature);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
