import { useState } from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, ExternalLink, AlertTriangle, Info, CheckCircle } from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useValidationGroupMembers, type ValidationGroupMember } from '@/hooks/use-validation-groups';
import type { ValidationAspect } from '@/components/filters';

// ============================================================================
// Types
// ============================================================================

interface GroupMembersProps {
  signature: string;
  serverId?: number;
  resourceType?: string;
  onBack?: () => void;
}

// ============================================================================
// Helper Components
// ============================================================================

function AspectStatusBadge({ 
  aspect, 
  isValid, 
  errorCount, 
  warningCount, 
  informationCount 
}: { 
  aspect: ValidationAspect;
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  informationCount: number;
}) {
  const labels: Record<ValidationAspect, string> = {
    structural: 'Struct',
    profile: 'Profile',
    terminology: 'Term',
    reference: 'Ref',
    businessRule: 'Business',
    metadata: 'Meta',
  };

  const getColor = () => {
    if (errorCount > 0) return 'bg-red-100 text-red-800 border-red-200';
    if (warningCount > 0) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (informationCount > 0) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getIcon = () => {
    if (errorCount > 0) return <AlertTriangle className="h-3 w-3" />;
    if (warningCount > 0) return <AlertTriangle className="h-3 w-3" />;
    if (informationCount > 0) return <Info className="h-3 w-3" />;
    return <CheckCircle className="h-3 w-3" />;
  };

  const getCounts = () => {
    const parts = [];
    if (errorCount > 0) parts.push(`${errorCount}E`);
    if (warningCount > 0) parts.push(`${warningCount}W`);
    if (informationCount > 0) parts.push(`${informationCount}I`);
    return parts.join(' ');
  };

  return (
    <Badge variant="outline" className={`${getColor()} text-xs font-mono gap-1`}>
      {getIcon()}
      <span>{labels[aspect]}</span>
      {getCounts() && <span className="ml-1">({getCounts()})</span>}
    </Badge>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function GroupMembersSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Pagination Component
// ============================================================================

function Pagination({ 
  page, 
  totalPages, 
  hasNext, 
  hasPrevious, 
  onPageChange 
}: {
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <div className="text-sm text-gray-600">
        Page {page} of {totalPages}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrevious}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GroupMembers({ 
  signature, 
  serverId, 
  resourceType: initialResourceType,
  onBack 
}: GroupMembersProps) {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [resourceTypeFilter, setResourceTypeFilter] = useState(initialResourceType);

  const { data, isLoading, error } = useValidationGroupMembers({
    signature,
    serverId,
    resourceType: resourceTypeFilter,
    page,
    pageSize,
    enabled: !!signature,
  });

  const handleNavigateToDetail = (member: ValidationGroupMember) => {
    setLocation(`/resources/${member.resourceType}/${member.fhirId}`);
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setLocation('/validation/groups');
    }
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Error Loading Group Members</CardTitle>
          <CardDescription>{error.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setPage(1)}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Groups
          </Button>
          <div className="h-6 w-px bg-gray-300" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Resources with this message
            </h2>
            <p className="text-sm text-gray-500">
              {data?.pagination.total || 0} resources affected
            </p>
          </div>
        </div>

        {/* Resource Type Filter */}
        {data?.filters && (
          <select
            value={resourceTypeFilter || ''}
            onChange={(e) => {
              setResourceTypeFilter(e.target.value || undefined);
              setPage(1);
            }}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Resource Types</option>
            {/* TODO: Get available resource types from statistics */}
          </select>
        )}
      </div>

      {/* Members Table */}
      {isLoading ? (
        <GroupMembersSkeleton />
      ) : !data || data.data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No resources found for this message group.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Resource</TableHead>
                <TableHead className="w-[150px]">Resource ID</TableHead>
                <TableHead>Validation Aspects</TableHead>
                <TableHead className="w-[180px]">Validated At</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((member) => (
                <TableRow
                  key={`${member.resourceType}-${member.fhirId}`}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleNavigateToDetail(member)}
                >
                  <TableCell>
                    <Badge variant="secondary">{member.resourceType}</Badge>
                  </TableCell>
                  
                  <TableCell>
                    <code className="text-xs text-gray-700">{member.fhirId}</code>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {member.perAspect.map((aspectData) => (
                        <AspectStatusBadge
                          key={aspectData.aspect}
                          aspect={aspectData.aspect}
                          isValid={aspectData.isValid}
                          errorCount={aspectData.errorCount}
                          warningCount={aspectData.warningCount}
                          informationCount={aspectData.informationCount}
                        />
                      ))}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {new Date(member.validatedAt).toLocaleString()}
                    </span>
                  </TableCell>
                  
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigateToDetail(member);
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {data.pagination && (
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              hasNext={data.pagination.hasNext}
              hasPrevious={data.pagination.hasPrevious}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
