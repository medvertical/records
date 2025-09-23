import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ValidationSummaryBadgeProps {
  result: {
    summary?: {
      totalIssues?: number;
      errorCount?: number;
      warningCount?: number;
      score?: number;
    };
    isValid?: boolean;
  };
}

// ============================================================================
// Component
// ============================================================================

export function ValidationSummaryBadge({ result }: ValidationSummaryBadgeProps) {
  const { summary } = result;
  const totalIssues = summary?.totalIssues || 0;
  const errorCount = summary?.errorCount || 0;
  const warningCount = summary?.warningCount || 0;
  const score = summary?.score || 0;

  if (totalIssues === 0) {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        Valid ({score}%)
      </Badge>
    );
  }

  if (errorCount > 0) {
    return (
      <Badge variant="destructive">
        <AlertCircle className="w-3 h-3 mr-1" />
        {errorCount} errors, {warningCount} warnings ({score}%)
      </Badge>
    );
  }

  return (
    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
      <AlertTriangle className="w-3 h-3 mr-1" />
      {warningCount} warnings ({score}%)
    </Badge>
  );
}
