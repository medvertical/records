import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info,
  CheckCircle,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ValidationError } from '@shared/schema';

// ============================================================================
// Types
// ============================================================================

interface ValidationIssueCardProps {
  issue: ValidationError;
  onResolutionAction: (issue: ValidationError, action: 'acknowledge' | 'resolve' | 'ignore') => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getSeverityIcon = (severity: string) => {
  const iconMap = {
    'error': AlertCircle,
    'warning': AlertTriangle,
    'information': Info
  };
  
  const IconComponent = iconMap[severity as keyof typeof iconMap] || Info;
  return <IconComponent className="h-4 w-4" />;
};

const getSeverityBadge = (severity: string) => {
  const badgeMap = {
    'error': { variant: 'destructive' as const, text: 'Error' },
    'warning': { variant: 'secondary' as const, text: 'Warning' },
    'information': { variant: 'outline' as const, text: 'Info' }
  };
  
  const badge = badgeMap[severity as keyof typeof badgeMap] || badgeMap.information;
  return (
    <Badge variant={badge.variant} className="text-xs">
      {badge.text}
    </Badge>
  );
};

const getCategoryInfo = (category: string) => {
  const categoryMap = {
    'structural': { name: 'Structural', color: 'purple' },
    'profile': { name: 'Profile', color: 'green' },
    'terminology': { name: 'Terminology', color: 'blue' },
    'reference': { name: 'Reference', color: 'orange' },
    'businessRule': { name: 'Business Rule', color: 'red' },
    'metadata': { name: 'Metadata', color: 'gray' }
  };
  
  return categoryMap[category as keyof typeof categoryMap] || { name: 'Unknown', color: 'gray' };
};

const getResolutionStatusBadge = (issue: ValidationError) => {
  if (!issue.resolutionStatus || issue.resolutionStatus === 'unresolved') {
    return null;
  }
  
  const statusMap = {
    'acknowledged': { variant: 'secondary' as const, text: 'Acknowledged', icon: Eye },
    'resolved': { variant: 'default' as const, text: 'Resolved', icon: CheckCircle },
    'ignored': { variant: 'outline' as const, text: 'Ignored', icon: EyeOff }
  };
  
  const status = statusMap[issue.resolutionStatus as keyof typeof statusMap];
  if (!status) return null;
  
  const IconComponent = status.icon;
  
  return (
    <Badge variant={status.variant} className="text-xs">
      <IconComponent className="h-3 w-3 mr-1" />
      {status.text}
    </Badge>
  );
};

// ============================================================================
// Component
// ============================================================================

export function ValidationIssueCard({ issue, onResolutionAction }: ValidationIssueCardProps) {
  const categoryInfo = getCategoryInfo(issue.category || 'structural');
  
  return (
    <div className={cn(
      "border rounded-lg p-4",
      issue.severity === 'error' ? "bg-red-50 border-red-200" :
      issue.severity === 'warning' ? "bg-orange-50 border-orange-200" :
      "bg-blue-50 border-blue-200"
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {getSeverityIcon(issue.severity)}
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h5 className={cn(
                "font-semibold",
                issue.severity === 'error' ? "text-fhir-error" :
                issue.severity === 'warning' ? "text-fhir-warning" :
                "text-blue-700"
              )}>
                {issue.code || 'Validation Issue'}
              </h5>
              {getSeverityBadge(issue.severity)}
              {issue.category && (
                <Badge variant="outline" className="text-xs">
                  {categoryInfo.name}
                </Badge>
              )}
              {getResolutionStatusBadge(issue)}
            </div>
            
            <p className="text-sm text-gray-700 mb-2">
              {issue.message}
            </p>
            
            <div className="text-xs text-gray-600 space-y-1">
              {issue.path && (
                <div><strong>Path:</strong> {issue.path}</div>
              )}
              {issue.expression && (
                <div><strong>Expression:</strong> {issue.expression}</div>
              )}
              
              {/* Resolution Notes */}
              {issue.resolutionNotes && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                  <div><strong>Resolution Notes:</strong></div>
                  <div className="text-gray-700">{issue.resolutionNotes}</div>
                  {issue.resolvedBy && (
                    <div className="text-xs text-gray-500 mt-1">
                      Resolved by {issue.resolvedBy} on {new Date(issue.resolvedAt || '').toLocaleDateString()}
                    </div>
                  )}
                  {issue.acknowledgedBy && (
                    <div className="text-xs text-gray-500 mt-1">
                      Acknowledged by {issue.acknowledgedBy} on {new Date(issue.acknowledgedAt || '').toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="ml-4 flex flex-col gap-1">
          {(!issue.resolutionStatus || issue.resolutionStatus === 'unresolved') && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onResolutionAction(issue, 'acknowledge')}
                className="text-xs"
              >
                ✓ Acknowledge
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onResolutionAction(issue, 'resolve')}
                className="text-xs"
              >
                ✅ Resolve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onResolutionAction(issue, 'ignore')}
                className="text-xs"
              >
                👁️ Ignore
              </Button>
            </>
          )}
          {issue.resolutionStatus && issue.resolutionStatus !== 'unresolved' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onResolutionAction(issue, 'acknowledge')}
              className="text-xs"
            >
              Edit Resolution
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
