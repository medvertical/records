import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useRoute } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, AlertTriangle, Info, ArrowLeft, ExternalLink } from 'lucide-react';

interface GroupMember {
  resourceType: string;
  fhirId: string;
  validatedAt: string;
  perAspect: Array<{
    aspect: string;
    isValid: boolean;
    errorCount: number;
    warningCount: number;
    informationCount: number;
    score: number;
  }>;
}

interface GroupMembersResponse {
  members: GroupMember[];
  total: number;
}

interface GroupInfo {
  signature: string;
  aspect: string;
  severity: string;
  code: string;
  canonicalPath: string;
  sampleText: string;
  totalResources: number;
}

function getSeverityIcon(severity: string) {
  switch (severity.toLowerCase()) {
    case 'error':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    case 'information':
    case 'info':
      return <Info className="h-4 w-4 text-blue-500" />;
    default:
      return null;
  }
}

function getSeverityBadgeVariant(severity: string): "destructive" | "warning" | "secondary" | "default" {
  switch (severity.toLowerCase()) {
    case 'error':
      return 'destructive';
    case 'warning':
      return 'warning';
    case 'information':
    case 'info':
      return 'secondary';
    default:
      return 'default';
  }
}

export default function IssueGroupDetailPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/issue-groups/:signature');
  const signature = params?.signature || '';
  
  const [serverId] = useState(1); // TODO: Get from active server context
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Fetch group members
  const { data, isLoading, error } = useQuery<GroupMembersResponse>({
    queryKey: ['/api/validation/issues/groups', signature, 'resources', serverId, page],
    queryFn: async () => {
      const response = await fetch(
        `/api/validation/issues/groups/${signature}/resources?serverId=${serverId}&page=${page}&size=${pageSize}&sort=validatedAt:desc`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch group members');
      }
      return response.json();
    },
    enabled: !!signature,
  });

  // Fetch group info from the first member (assuming all have same message)
  const groupInfo: GroupInfo | null = null; // TODO: Would be better to fetch from groups endpoint

  const handleResourceClick = (resourceType: string, fhirId: string) => {
    navigate(`/resource/${resourceType}/${fhirId}?highlightSignature=${signature}`);
  };

  const handleBack = () => {
    navigate('/issue-groups');
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={handleBack} variant="outline" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Groups
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Issue Group Detail</h1>
          <p className="text-muted-foreground">
            Resources affected by this validation issue
          </p>
        </div>
      </div>

      {/* Group Info Card */}
      {data && data.members.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Issue Information</CardTitle>
            <CardDescription>
              Signature: <code className="text-xs bg-muted px-2 py-1 rounded">{signature}</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                This validation message appears in <strong>{data.total}</strong> resource{data.total !== 1 ? 's' : ''}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Affected Resources Card */}
      <Card>
        <CardHeader>
          <CardTitle>Affected Resources</CardTitle>
          <CardDescription>
            {data && `${data.total} resource${data.total !== 1 ? 's' : ''} with this validation issue`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="text-muted-foreground">Loading affected resources...</div>
            </div>
          )}

          {error && (
            <div className="flex justify-center py-8 text-destructive">
              <AlertCircle className="h-5 w-5 mr-2" />
              Error loading resources: {error.message}
            </div>
          )}

          {data && data.members.length === 0 && (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Info className="h-5 w-5 mr-2" />
              No resources found
            </div>
          )}

          {data && data.members.length > 0 && (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resource</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Validated At</TableHead>
                    <TableHead>Per-Aspect Status</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.members.map((member) => (
                    <TableRow
                      key={`${member.resourceType}/${member.fhirId}`}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleResourceClick(member.resourceType, member.fhirId)}
                    >
                      <TableCell>
                        <Badge variant="outline">{member.resourceType}</Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{member.fhirId}</code>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(member.validatedAt).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {member.perAspect.map((aspectResult) => (
                            <Badge
                              key={aspectResult.aspect}
                              variant={aspectResult.isValid ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {aspectResult.aspect}: {aspectResult.errorCount}E / {aspectResult.warningCount}W
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResourceClick(member.resourceType, member.fhirId);
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
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      variant="outline"
                      size="sm"
                    >
                      Previous
                    </Button>
                    <Button
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                      variant="outline"
                      size="sm"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

