import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  Code, 
  FileCheck, 
  BookOpen, 
  Link, 
  Shield, 
  FileText,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { getHumanReadableMessage, getShortMessage, getSeverityInfo, getCategoryInfo } from './validation-message-converter';

// ============================================================================
// Types
// ============================================================================

interface ValidationIssue {
  id?: string;
  code?: string;
  message?: string;
  category?: string;
  severity?: string;
  path?: string;
  location?: string[];
  humanReadable?: string;
}

interface ValidationIssueIndicatorProps {
  issue: ValidationIssue;
}

interface ValidationIssueDetailsProps {
  issue: ValidationIssue;
  isHighlighted?: boolean;
  humanReadableMode?: boolean;
  onNavigateToPath?: (path: string) => void;
}

// ============================================================================
// Icons Helper
// ============================================================================

const getCategoryIcon = (category: string) => {
  const iconMap = {
    'structural': Code,
    'profile': FileCheck,
    'terminology': BookOpen,
    'reference': Link,
    'business-rule': Shield,
    'metadata': FileText,
    'general': AlertCircle
  };
  
  const IconComponent = iconMap[category as keyof typeof iconMap] || AlertCircle;
  return <IconComponent className="h-4 w-4" />;
};

const getSeverityIcon = (severity: string) => {
  const iconMap = {
    'error': AlertCircle,
    'warning': AlertTriangle,
    'information': Info
  };
  
  const IconComponent = iconMap[severity as keyof typeof iconMap] || Info;
  return <IconComponent className="h-4 w-4" />;
};

// ============================================================================
// Validation Issue Indicator Component
// ============================================================================

export function ValidationIssueIndicator({ issue }: ValidationIssueIndicatorProps) {
  const severityInfo = getSeverityInfo(issue.severity || 'information');
  const categoryInfo = getCategoryInfo(issue.category || 'general');
  
  return (
    <div className="flex items-center gap-2">
      <div className={`p-1 rounded ${categoryInfo.bgColor} ${categoryInfo.borderColor} border`}>
        {getCategoryIcon(issue.category || 'general')}
      </div>
      <div className={`p-1 rounded ${severityInfo.bgColor} ${severityInfo.borderColor} border`}>
        {getSeverityIcon(issue.severity || 'information')}
      </div>
      <span className="text-sm font-medium">{getShortMessage(issue)}</span>
    </div>
  );
}

// ============================================================================
// Validation Issue Details Component
// ============================================================================

export function ValidationIssueDetails({ 
  issue, 
  isHighlighted = false, 
  humanReadableMode = false,
  onNavigateToPath 
}: ValidationIssueDetailsProps) {
  const severityInfo = getSeverityInfo(issue.severity || 'information');
  const categoryInfo = getCategoryInfo(issue.category || 'general');
  
  const handlePathClick = () => {
    if (issue.path && onNavigateToPath) {
      onNavigateToPath(issue.path);
    }
  };
  
  return (
    <Card className={`transition-all duration-200 ${
      isHighlighted 
        ? 'ring-2 ring-blue-500 shadow-lg' 
        : 'hover:shadow-md'
    }`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with severity and category badges */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge 
                variant={issue.severity === 'error' ? 'destructive' : 'secondary'}
                className={`${severityInfo.bgColor} ${severityInfo.color} ${severityInfo.borderColor} border`}
              >
                {getSeverityIcon(issue.severity || 'information')}
                <span className="ml-1 capitalize">{issue.severity || 'information'}</span>
              </Badge>
              
              <Badge 
                variant="outline"
                className={`${categoryInfo.bgColor} ${categoryInfo.color} ${categoryInfo.borderColor} border`}
              >
                {getCategoryIcon(issue.category || 'general')}
                <span className="ml-1 capitalize">{issue.category || 'general'}</span>
              </Badge>
            </div>
            
            {issue.code && (
              <Badge variant="outline" className="text-xs">
                {issue.code}
              </Badge>
            )}
          </div>
          
          {/* Message content */}
          <div className="space-y-2">
            <div className="text-sm">
              {humanReadableMode ? (
                <div>
                  <p className="font-medium text-gray-900 mb-1">What this means:</p>
                  <p className="text-gray-700">
                    {getHumanReadableMessage(issue)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium text-gray-900 mb-1">Technical details:</p>
                  <p className="text-gray-700 font-mono text-sm">
                    {issue.message || issue.code || 'No message available'}
                  </p>
                </div>
              )}
            </div>
            
            {/* Path information */}
            {issue.path && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Location:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePathClick}
                  className="h-auto p-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  <code className="font-mono">{issue.path}</code>
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}
            
            {/* Location array */}
            {issue.location && issue.location.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Path:</span>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {issue.location.join('.')}
                </code>
              </div>
            )}
          </div>
          
          {/* Toggle button for human readable mode */}
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // This would need to be handled by parent component
                // For now, just show the toggle state
              }}
              className="text-xs"
            >
              {humanReadableMode ? 'Show technical details' : 'Explain in plain language'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Validation Issue List Component
// ============================================================================

interface ValidationIssueListProps {
  issues: ValidationIssue[];
  selectedCategory?: string;
  selectedSeverity?: string;
  selectedPath?: string;
  highlightedIssueId?: string | null;
  humanReadableMode?: boolean;
  onNavigateToPath?: (path: string) => void;
  onIssueClick?: (issueId: string) => void;
}

export function ValidationIssueList({
  issues,
  selectedCategory,
  selectedSeverity,
  selectedPath,
  highlightedIssueId,
  humanReadableMode = false,
  onNavigateToPath,
  onIssueClick
}: ValidationIssueListProps) {
  // Filter issues based on selected filters
  const filteredIssues = issues.filter(issue => {
    if (selectedCategory && selectedCategory !== 'all' && issue.category !== selectedCategory) {
      return false;
    }
    if (selectedSeverity && selectedSeverity !== 'all' && issue.severity !== selectedSeverity) {
      return false;
    }
    if (selectedPath && issue.path !== selectedPath) {
      return false;
    }
    return true;
  });
  
  if (filteredIssues.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p>No validation issues found matching the current filters.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {filteredIssues.map((issue, index) => (
        <div
          key={issue.id || index}
          onClick={() => issue.id && onIssueClick?.(issue.id)}
          className="cursor-pointer"
        >
          <ValidationIssueDetails
            issue={issue}
            isHighlighted={highlightedIssueId === issue.id}
            humanReadableMode={humanReadableMode}
            onNavigateToPath={onNavigateToPath}
          />
        </div>
      ))}
    </div>
  );
}
