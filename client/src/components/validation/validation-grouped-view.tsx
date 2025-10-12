import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ValidationError } from '@shared/schema';
import { ValidationIssueCard } from './validation-issue-card';
import { groupIssuesByCategoryAndSeverity, groupIssuesBy, getGroupKey, getCategoryInfo } from './validation-grouping-logic';

// ============================================================================
// Types
// ============================================================================

type GroupBy = 'category' | 'severity' | 'message' | 'path';

interface ValidationGroupedViewProps {
  issues: ValidationError[];
  groupBy: GroupBy;
  onResolutionAction: (issue: ValidationError, action: 'acknowledge' | 'resolve' | 'ignore') => void;
}

// ============================================================================
// Component
// ============================================================================

export function ValidationGroupedView({ 
  issues, 
  groupBy, 
  onResolutionAction 
}: ValidationGroupedViewProps) {
  
  if (groupBy === 'category') {
    return <CategoryGroupedView issues={issues} onResolutionAction={onResolutionAction} />;
  }
  
  return <AdvancedGroupedView issues={issues} groupBy={groupBy} onResolutionAction={onResolutionAction} />;
}

// ============================================================================
// Category Grouped View
// ============================================================================

function CategoryGroupedView({ 
  issues, 
  onResolutionAction 
}: { 
  issues: ValidationError[]; 
  onResolutionAction: (issue: ValidationError, action: 'acknowledge' | 'resolve' | 'ignore') => void;
}) {
  const groupedIssues = groupIssuesByCategoryAndSeverity(issues);
  
  return (
    <div className="space-y-4">
      {Object.entries(groupedIssues).map(([category, severityGroups]) => {
        const categoryInfo = getCategoryInfo(category);
        const totalIssues = severityGroups && typeof severityGroups === 'object' 
          ? Object.values(severityGroups).flat().length 
          : 0;

        return (
          <div key={category} className="border rounded-lg overflow-hidden">
            <div className={`bg-${categoryInfo.color}-50 border-b border-${categoryInfo.color}-200 px-4 py-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{categoryInfo.icon}</span>
                  <h3 className="font-semibold text-gray-800">{categoryInfo.name}</h3>
                  <Badge variant="secondary">{totalIssues} issues</Badge>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {severityGroups && typeof severityGroups === 'object' && Object.entries(severityGroups).map(([severity, severityIssues]) => (
                <div key={severity} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-700 capitalize">
                      {severity} ({severityIssues.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {severityIssues.map((issue, index) => (
                      <ValidationIssueCard
                        key={issue.id || index}
                        issue={issue}
                        onResolutionAction={onResolutionAction}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Advanced Grouped View
// ============================================================================

function AdvancedGroupedView({ 
  issues, 
  groupBy, 
  onResolutionAction 
}: { 
  issues: ValidationError[]; 
  groupBy: GroupBy;
  onResolutionAction: (issue: ValidationError, action: 'acknowledge' | 'resolve' | 'ignore') => void;
}) {
  const groupedIssues = groupIssuesBy(issues, groupBy);
  
  return (
    <div className="space-y-4">
      {groupedIssues && typeof groupedIssues === 'object' && Object.entries(groupedIssues).map(([groupKey, groupIssues]) => {
        const totalIssues = groupIssues.length;
        const severityCounts = groupIssues.reduce((acc, issue) => {
          acc[issue.severity] = (acc[issue.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return (
          <div key={groupKey} className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-800">
                    {getGroupDisplayName(groupKey, groupBy)}
                  </h3>
                  <Badge variant="secondary">{totalIssues} issues</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {severityCounts.error > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {severityCounts.error} errors
                    </Badge>
                  )}
                  {severityCounts.warning > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {severityCounts.warning} warnings
                    </Badge>
                  )}
                  {severityCounts.information > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {severityCounts.information} info
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {groupIssues.map((issue, index) => (
                <ValidationIssueCard
                  key={issue.id || index}
                  issue={issue}
                  onResolutionAction={onResolutionAction}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getGroupDisplayName(groupKey: string, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'severity':
      return groupKey.charAt(0).toUpperCase() + groupKey.slice(1);
    case 'category':
      const categoryInfo = getCategoryInfo(groupKey);
      return categoryInfo.name;
    case 'message':
      return groupKey.length > 50 ? groupKey.substring(0, 50) + '...' : groupKey;
    case 'path':
      return groupKey === 'root' ? 'Root Level' : groupKey;
    default:
      return groupKey;
  }
}
