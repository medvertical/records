import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, X, Filter } from 'lucide-react';
import { SeverityIcon } from '@/components/ui/severity-icon';
import type { SeverityLevel } from '@/components/ui/severity-icon';

// ============================================================================
// Types
// ============================================================================

export interface ValidationFilters {
  aspects: string[];
  severities: string[];
  hasIssuesOnly: boolean;
}

export interface ValidationSummary {
  totalResources: number;
  validatedCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  aspectBreakdown?: {
    aspect: string;
    percentage: number;
    issueCount: number;
  }[];
  aspectStats?: {
    [aspectId: string]: {
      valid: number;
      invalid: number;
      warnings: number;
      total: number;
    };
  };
  severityStats?: {
    [severityId: string]: {
      count: number;
      resourceCount: number;
    };
  };
}

interface ValidationReportAndFiltersProps {
  validationSummary: ValidationSummary;
  filters: ValidationFilters;
  onFilterChange: (filters: ValidationFilters) => void;
  onRevalidate: () => void;
  isRevalidating?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const VALIDATION_ASPECTS = [
  { id: 'structural', label: 'Structural', color: 'bg-blue-100 text-blue-800' },
  { id: 'profile', label: 'Profile', color: 'bg-purple-100 text-purple-800' },
  { id: 'terminology', label: 'Terminology', color: 'bg-green-100 text-green-800' },
  { id: 'reference', label: 'Reference', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'businessRule', label: 'Business Rules', color: 'bg-orange-100 text-orange-800' },
  { id: 'metadata', label: 'Metadata', color: 'bg-gray-100 text-gray-800' },
];

const SEVERITIES = [
  { id: 'error', label: 'Error', color: 'bg-red-100 text-red-800' },
  { id: 'warning', label: 'Warning', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'information', label: 'Information', color: 'bg-blue-100 text-blue-800' },
];

// ============================================================================
// Component
// ============================================================================

export function ValidationReportAndFilters({
  validationSummary,
  filters,
  onFilterChange,
  onRevalidate,
  isRevalidating = false,
}: ValidationReportAndFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Handle aspect checkbox toggle
  const handleAspectToggle = (aspectId: string) => {
    const newAspects = filters.aspects.includes(aspectId)
      ? filters.aspects.filter(a => a !== aspectId)
      : [...filters.aspects, aspectId];
    
    onFilterChange({
      ...filters,
      aspects: newAspects,
    });
  };

  // Handle severity checkbox toggle
  const handleSeverityToggle = (severityId: string) => {
    const newSeverities = filters.severities.includes(severityId)
      ? filters.severities.filter(s => s !== severityId)
      : [...filters.severities, severityId];
    
    onFilterChange({
      ...filters,
      severities: newSeverities,
    });
  };

  // Clear all filters
  const handleClearFilters = () => {
    onFilterChange({
      aspects: [],
      severities: [],
      hasIssuesOnly: false,
    });
  };

  const hasActiveFilters = filters.aspects.length > 0 || filters.severities.length > 0 || filters.hasIssuesOnly;
  const activeFilterCount = filters.aspects.length + filters.severities.length + (filters.hasIssuesOnly ? 1 : 0);

  return (
    <Card className="text-left">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-left">Validation Overview & Filters</CardTitle>
            {hasActiveFilters && (
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount} active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {isExpanded ? 'Hide' : 'Show'} Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRevalidate}
              disabled={isRevalidating}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRevalidating ? 'animate-spin' : ''}`} />
              Revalidate
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="text-left">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Validation Summary */}
          <div className="space-y-4 text-left">
            <div>
              <h3 className="font-semibold text-sm text-gray-700 mb-3 text-left">Current Page Summary</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg text-left">
                  <div className="text-2xl font-bold text-gray-900">{validationSummary.totalResources}</div>
                  <div className="text-xs text-gray-600 text-left">Total Resources</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg text-left">
                  <div className="text-2xl font-bold text-blue-900">{validationSummary.validatedCount}</div>
                  <div className="text-xs text-blue-600 text-left">Validated</div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg text-left">
                  <div className="text-2xl font-bold text-red-900">{validationSummary.errorCount}</div>
                  <div className="text-xs text-red-600 text-left">Errors</div>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg text-left">
                  <div className="text-2xl font-bold text-yellow-900">{validationSummary.warningCount}</div>
                  <div className="text-xs text-yellow-600 text-left">Warnings</div>
                </div>
              </div>
            </div>

            {validationSummary.aspectBreakdown && validationSummary.aspectBreakdown.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm text-gray-700 mb-2 text-left">Aspect Breakdown</h3>
                <div className="space-y-2">
                  {validationSummary.aspectBreakdown.map((aspect) => (
                    <div key={aspect.aspect} className="flex items-center justify-between text-sm text-left">
                      <span className="text-gray-700 text-left">{aspect.aspect}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {aspect.issueCount} issues
                        </Badge>
                        <span className="text-gray-600 font-medium">{aspect.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Filters (shown when expanded) */}
          {isExpanded && (
            <div className="space-y-4 text-left">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-700 text-left">Filter Options</h3>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="h-7 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>

              <Separator />

              {/* Aspect Filters */}
              <div className="text-left">
                <Label className="text-sm font-semibold text-gray-700 mb-2 block text-left">
                  Validation Aspects
                </Label>
                <div className="space-y-2">
                  {VALIDATION_ASPECTS.map((aspect) => {
                    const stats = validationSummary.aspectStats?.[aspect.id];
                    return (
                      <div key={aspect.id} className="flex items-center justify-between text-left">
                        <div className="flex items-center space-x-2 text-left">
                          <Checkbox
                            id={`aspect-${aspect.id}`}
                            checked={filters.aspects.includes(aspect.id)}
                            onCheckedChange={() => handleAspectToggle(aspect.id)}
                          />
                          <Label
                            htmlFor={`aspect-${aspect.id}`}
                            className="text-sm font-normal cursor-pointer text-left"
                          >
                            {aspect.label}
                          </Label>
                        </div>
                        {stats && stats.total > 0 && (
                          <div className="flex items-center gap-1">
                            {stats.valid > 0 && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                ✓ {stats.valid}
                              </Badge>
                            )}
                            {stats.invalid > 0 && (
                              <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                ✗ {stats.invalid}
                              </Badge>
                            )}
                            {stats.warnings > 0 && (
                              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                                ⚠ {stats.warnings}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Severity Filters */}
              <div className="text-left">
                <Label className="text-sm font-semibold text-gray-700 mb-2 block text-left">
                  Severities
                </Label>
                <div className="space-y-2">
                  {SEVERITIES.map((severity) => {
                    const stats = validationSummary.severityStats?.[severity.id];
                    return (
                      <div key={severity.id} className="flex items-center justify-between text-left">
                        <div className="flex items-center space-x-2 text-left">
                          <Checkbox
                            id={`severity-${severity.id}`}
                            checked={filters.severities.includes(severity.id)}
                            onCheckedChange={() => handleSeverityToggle(severity.id)}
                          />
                          <SeverityIcon severity={severity.id as SeverityLevel} className="h-4 w-4" />
                          <Label
                            htmlFor={`severity-${severity.id}`}
                            className="text-sm font-normal cursor-pointer text-left"
                          >
                            {severity.label}
                          </Label>
                        </div>
                        {stats && (stats.count > 0 || stats.resourceCount > 0) && (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {stats.count} issue{stats.count !== 1 ? 's' : ''}
                            </Badge>
                            <Badge variant="outline" className="text-xs text-gray-600">
                              {stats.resourceCount} resource{stats.resourceCount !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Has Issues Only Toggle */}
              <div className="flex items-center space-x-2 text-left">
                <Checkbox
                  id="hasIssuesOnly"
                  checked={filters.hasIssuesOnly}
                  onCheckedChange={(checked) =>
                    onFilterChange({
                      ...filters,
                      hasIssuesOnly: checked as boolean,
                    })
                  }
                />
                <Label
                  htmlFor="hasIssuesOnly"
                  className="text-sm font-normal cursor-pointer text-left"
                >
                  Only show resources with validation issues
                </Label>
              </div>
            </div>
          )}

          {/* Collapsed view: Show active filters as badges */}
          {!isExpanded && hasActiveFilters && (
            <div className="space-y-2 text-left">
              <h3 className="font-semibold text-sm text-gray-700 text-left">Active Filters</h3>
              <div className="flex flex-wrap gap-2">
                {filters.aspects.map((aspectId) => {
                  const aspect = VALIDATION_ASPECTS.find(a => a.id === aspectId);
                  return aspect ? (
                    <Badge key={aspectId} variant="secondary" className="text-xs">
                      {aspect.label}
                    </Badge>
                  ) : null;
                })}
                {filters.severities.map((severityId) => {
                  const severity = SEVERITIES.find(s => s.id === severityId);
                  return severity ? (
                    <Badge key={severityId} variant="secondary" className="text-xs">
                      {severity.label}
                    </Badge>
                  ) : null;
                })}
                {filters.hasIssuesOnly && (
                  <Badge variant="secondary" className="text-xs">
                    Issues Only
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

