import React from 'react';
import { ValidationError } from '@shared/schema';
import { ValidationIssueCard } from './validation-issue-card';

// ============================================================================
// Types
// ============================================================================

interface ValidationFlatViewProps {
  issues: ValidationError[];
  onResolutionAction: (issue: ValidationError, action: 'acknowledge' | 'resolve' | 'ignore') => void;
}

// ============================================================================
// Component
// ============================================================================

export function ValidationFlatView({ issues, onResolutionAction }: ValidationFlatViewProps) {
  if (issues.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No validation issues found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {issues.map((issue, index) => (
        <ValidationIssueCard
          key={issue.id || index}
          issue={issue}
          onResolutionAction={onResolutionAction}
        />
      ))}
    </div>
  );
}
