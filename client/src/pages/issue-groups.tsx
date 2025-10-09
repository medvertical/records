import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, AlertTriangle, Info, Search, Filter } from 'lucide-react';

interface ValidationMessageGroup {
  signature: string;
  aspect: string;
  severity: string;
  code: string;
  canonicalPath: string;
  sampleText: string;
  totalResources: number;
}

interface GroupsResponse {
  groups: ValidationMessageGroup[];
  total: number;
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

function getAspectBadgeColor(aspect: string): string {
  const colors: Record<string, string> = {
    structural: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    profile: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    terminology: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    reference: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    businessRule: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    metadata: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  };
  return colors[aspect] || 'bg-gray-100 text-gray-800';
}

export default function IssueGroupsPage() {
  const [, navigate] = useLocation();
  const [serverId] = useState(1); // TODO: Get from active server context
  const [filters, setFilters] = useState({
    aspect: '',
    severity: '',
    code: '',
    path: '',
  });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('count:desc');
  const pageSize = 25;

  // Build query params
  const queryParams = new URLSearchParams({
    serverId: serverId.toString(),
    page: page.toString(),
    size: pageSize.toString(),
    sort,
    ...(filters.aspect && { aspect: filters.aspect }),
    ...(filters.severity && { severity: filters.severity }),
    ...(filters.code && { code: filters.code }),
    ...(filters.path && { path: filters.path }),
  });

  const { data, isLoading, error } = useQuery<GroupsResponse>({
    queryKey: ['/api/validation/issues/groups', serverId, filters, page, sort],
    queryFn: async () => {
      const response = await fetch(`/api/validation/issues/groups?${queryParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch validation groups');
      }
      return response.json();
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const handleGroupClick = (signature: string) => {
    navigate(`/issue-groups/${signature}`);
  };

  const handleResetFilters = () => {
    setFilters({
      aspect: '',
      severity: '',
      code: '',
      path: '',
    });
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Validation Issues by Message</h1>
          <p className="text-muted-foreground">
            Group and triage validation issues by identical message signatures
          </p>
        </div>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>
            Filter validation issue groups by aspect, severity, code, or path
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Aspect</label>
              <Select value={filters.aspect} onValueChange={(value) => setFilters({ ...filters, aspect: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All aspects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All aspects</SelectItem>
                  <SelectItem value="structural">Structural</SelectItem>
                  <SelectItem value="profile">Profile</SelectItem>
                  <SelectItem value="terminology">Terminology</SelectItem>
                  <SelectItem value="reference">Reference</SelectItem>
                  <SelectItem value="businessRule">Business Rules</SelectItem>
                  <SelectItem value="metadata">Metadata</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Severity</label>
              <Select value={filters.severity} onValueChange={(value) => setFilters({ ...filters, severity: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All severities</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="information">Information</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Error Code</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="e.g. required"
                  value={filters.code}
                  onChange={(e) => setFilters({ ...filters, code: e.target.value })}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Path</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="e.g. patient.name"
                  value={filters.path}
                  onChange={(e) => setFilters({ ...filters, path: e.target.value })}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button onClick={handleResetFilters} variant="outline" size="sm">
              Reset Filters
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <label className="text-sm font-medium">Sort by:</label>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count:desc">Count (High to Low)</SelectItem>
                  <SelectItem value="count:asc">Count (Low to High)</SelectItem>
                  <SelectItem value="severity:desc">Severity (High to Low)</SelectItem>
                  <SelectItem value="severity:asc">Severity (Low to High)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Card */}
      <Card>
        <CardHeader>
          <CardTitle>Issue Groups</CardTitle>
          <CardDescription>
            {data && `${data.total} unique validation issue${data.total !== 1 ? 's' : ''} found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="text-muted-foreground">Loading issue groups...</div>
            </div>
          )}

          {error && (
            <div className="flex justify-center py-8 text-destructive">
              <AlertCircle className="h-5 w-5 mr-2" />
              Error loading issue groups: {error.message}
            </div>
          )}

          {data && data.groups.length === 0 && (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Info className="h-5 w-5 mr-2" />
              No validation issues found with current filters
            </div>
          )}

          {data && data.groups.length > 0 && (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Severity</TableHead>
                    <TableHead className="w-[120px]">Aspect</TableHead>
                    <TableHead className="w-[120px]">Code</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="w-[100px] text-right">Resources</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.groups.map((group) => (
                    <TableRow
                      key={group.signature}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleGroupClick(group.signature)}
                    >
                      <TableCell>
                        <Badge variant={getSeverityBadgeVariant(group.severity)} className="flex items-center gap-1 w-fit">
                          {getSeverityIcon(group.severity)}
                          {group.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getAspectBadgeColor(group.aspect)}>
                          {group.aspect}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{group.code || 'N/A'}</code>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{group.sampleText}</div>
                          <div className="text-xs text-muted-foreground">Path: {group.canonicalPath}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="font-mono">
                          {group.totalResources}
                        </Badge>
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

