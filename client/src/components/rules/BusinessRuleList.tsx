/**
 * Business Rule List Component
 * Task 9.1: Rule management UI for listing, filtering, and managing rules
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  AlertCircle,
  Check,
  Code2,
  Copy,
  Edit,
  MoreVertical,
  Plus,
  Search,
  Trash,
  X,
} from 'lucide-react';
import { BusinessRule } from './BusinessRuleEditor';

/**
 * Props for the BusinessRuleList component
 */
interface BusinessRuleListProps {
  rules: BusinessRule[];
  onCreateRule?: () => void;
  onEditRule?: (rule: BusinessRule) => void;
  onDeleteRule?: (ruleId: string) => void;
  onToggleRule?: (ruleId: string, enabled: boolean) => void;
  onDuplicateRule?: (rule: BusinessRule) => void;
  isLoading?: boolean;
}

/**
 * BusinessRuleList Component
 * 
 * Displays a list of business rules with filtering, sorting, and management actions
 */
export function BusinessRuleList({
  rules,
  onCreateRule,
  onEditRule,
  onDeleteRule,
  onToggleRule,
  onDuplicateRule,
  isLoading = false,
}: BusinessRuleListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  /**
   * Filter rules based on search and filters
   */
  const filteredRules = rules.filter((rule) => {
    // Search filter
    const matchesSearch =
      searchQuery === '' ||
      rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.fhirPathExpression.toLowerCase().includes(searchQuery.toLowerCase());

    // Category filter
    const matchesCategory =
      filterCategory === 'all' || rule.category === filterCategory;

    // Severity filter
    const matchesSeverity =
      filterSeverity === 'all' || rule.severity === filterSeverity;

    // Status filter
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'enabled' && rule.enabled) ||
      (filterStatus === 'disabled' && !rule.enabled);

    return matchesSearch && matchesCategory && matchesSeverity && matchesStatus;
  });

  /**
   * Get unique categories from rules
   */
  const categories = Array.from(
    new Set(rules.map((r) => r.category).filter(Boolean))
  );

  /**
   * Severity badge component
   */
  const SeverityBadge = ({ severity }: { severity: string }) => {
    const variants = {
      error: 'destructive',
      warning: 'secondary',
      info: 'outline',
    };

    const colors = {
      error: '',
      warning: 'bg-yellow-500 text-white',
      info: '',
    };

    return (
      <Badge
        variant={variants[severity as keyof typeof variants] as any}
        className={colors[severity as keyof typeof colors]}
      >
        {severity}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5" />
              Business Rules
            </CardTitle>
            <CardDescription>
              Manage custom validation rules for FHIR resources
            </CardDescription>
          </div>
          <Button onClick={onCreateRule}>
            <Plus className="h-4 w-4 mr-1" />
            Create Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search rules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category!}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="enabled">Enabled</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            Showing {filteredRules.length} of {rules.length} rules
          </p>
          {(searchQuery || filterCategory !== 'all' || filterSeverity !== 'all' || filterStatus !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setFilterCategory('all');
                setFilterSeverity('all');
                setFilterStatus('all');
              }}
            >
              <X className="h-3 w-3 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Rules Table */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading rules...
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="text-center py-8">
            <Code2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {searchQuery || filterCategory !== 'all' || filterSeverity !== 'all' || filterStatus !== 'all'
                ? 'No rules match your filters'
                : 'No business rules yet'}
            </p>
            {!searchQuery && filterCategory === 'all' && (
              <Button onClick={onCreateRule}>
                <Plus className="h-4 w-4 mr-1" />
                Create Your First Rule
              </Button>
            )}
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Resource Types</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{rule.name}</div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {rule.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {rule.resourceTypes.slice(0, 2).map((rt) => (
                          <Badge key={rt} variant="secondary" className="text-xs">
                            {rt}
                          </Badge>
                        ))}
                        {rule.resourceTypes.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{rule.resourceTypes.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={rule.severity} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked) =>
                            onToggleRule?.(rule.id!, checked)
                          }
                        />
                        {rule.enabled ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onEditRule?.(rule)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDuplicateRule?.(rule)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDeleteRule?.(rule.id!)}
                            className="text-destructive"
                          >
                            <Trash className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


