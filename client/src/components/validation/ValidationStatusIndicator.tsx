import { AlertTriangle, CheckCircle, Info, AlertCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ValidationAspect } from '@/components/filters';

// ============================================================================
// Types
// ============================================================================

export interface AspectValidationStatus {
  aspect: ValidationAspect;
  enabled: boolean;
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  informationCount: number;
  score: number;
  isValidating?: boolean;
}

export interface ResourceValidationStatus {
  resourceType: string;
  fhirId: string;
  overallScore: number;
  isValidating: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  aspects: AspectValidationStatus[];
  validatedAt?: string;
}

interface ValidationStatusIndicatorProps {
  status: ResourceValidationStatus;
  variant?: 'compact' | 'detailed';
}

// ============================================================================
// Helper Functions
// ============================================================================

const aspectLabels: Record<ValidationAspect, string> = {
  structural: 'Struct',
  profile: 'Profile',
  terminology: 'Term',
  reference: 'Ref',
  businessRule: 'Business',
  metadata: 'Meta',
};

function getOverallStatusColor(status: ResourceValidationStatus) {
  if (status.isValidating) return 'text-gray-500';
  if (status.hasErrors) return 'text-red-600';
  if (status.hasWarnings) return 'text-yellow-600';
  return 'text-green-600';
}

function getOverallStatusIcon(status: ResourceValidationStatus) {
  if (status.isValidating) return <Clock className="h-5 w-5" />;
  if (status.hasErrors) return <AlertCircle className="h-5 w-5" />;
  if (status.hasWarnings) return <AlertTriangle className="h-5 w-5" />;
  return <CheckCircle className="h-5 w-5" />;
}

function getScoreColor(score: number) {
  if (score >= 90) return 'text-green-600';
  if (score >= 70) return 'text-yellow-600';
  if (score >= 50) return 'text-orange-600';
  return 'text-red-600';
}

function getAspectBadgeColor(aspect: AspectValidationStatus) {
  if (!aspect.enabled) return 'bg-gray-100 text-gray-400 border-gray-200';
  if (aspect.isValidating) return 'bg-blue-50 text-blue-600 border-blue-200';
  if (aspect.errorCount > 0) return 'bg-red-100 text-red-800 border-red-200';
  if (aspect.warningCount > 0) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (aspect.informationCount > 0) return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-green-100 text-green-800 border-green-200';
}

function getAspectIcon(aspect: AspectValidationStatus) {
  if (!aspect.enabled) return null;
  if (aspect.isValidating) return <Clock className="h-3 w-3" />;
  if (aspect.errorCount > 0) return <AlertCircle className="h-3 w-3" />;
  if (aspect.warningCount > 0) return <AlertTriangle className="h-3 w-3" />;
  if (aspect.informationCount > 0) return <Info className="h-3 w-3" />;
  return <CheckCircle className="h-3 w-3" />;
}

function getAspectTooltip(aspect: AspectValidationStatus) {
  if (!aspect.enabled) return `${aspectLabels[aspect.aspect]} - Disabled`;
  if (aspect.isValidating) return `${aspectLabels[aspect.aspect]} - Validating...`;
  
  const parts = [];
  if (aspect.errorCount > 0) parts.push(`${aspect.errorCount} errors`);
  if (aspect.warningCount > 0) parts.push(`${aspect.warningCount} warnings`);
  if (aspect.informationCount > 0) parts.push(`${aspect.informationCount} info`);
  
  if (parts.length === 0) return `${aspectLabels[aspect.aspect]} - Valid`;
  return `${aspectLabels[aspect.aspect]} - ${parts.join(', ')}`;
}

// ============================================================================
// Compact Variant
// ============================================================================

function CompactIndicator({ status }: { status: ResourceValidationStatus }) {
  const enabledAspects = status.aspects.filter(a => a.enabled);
  const totalErrors = enabledAspects.reduce((sum, a) => sum + a.errorCount, 0);
  const totalWarnings = enabledAspects.reduce((sum, a) => sum + a.warningCount, 0);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          <div className={getOverallStatusColor(status)}>
            {getOverallStatusIcon(status)}
          </div>
          <div className="flex flex-col">
            <span className={`text-lg font-semibold ${getScoreColor(status.overallScore)}`}>
              {status.overallScore}
            </span>
            <div className="flex gap-1 text-xs">
              {totalErrors > 0 && (
                <span className="text-red-600">{totalErrors}E</span>
              )}
              {totalWarnings > 0 && (
                <span className="text-yellow-600">{totalWarnings}W</span>
              )}
            </div>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-semibold">Validation Score: {status.overallScore}/100</p>
          {totalErrors > 0 && <p className="text-red-400">{totalErrors} errors</p>}
          {totalWarnings > 0 && <p className="text-yellow-400">{totalWarnings} warnings</p>}
          {status.validatedAt && (
            <p className="text-xs text-gray-400">
              Last validated: {new Date(status.validatedAt).toLocaleString()}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// Detailed Variant
// ============================================================================

function DetailedIndicator({ status }: { status: ResourceValidationStatus }) {
  return (
    <div className="space-y-3">
      {/* Overall Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={getOverallStatusColor(status)}>
            {getOverallStatusIcon(status)}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-700">Validation Status</div>
            {status.isValidating ? (
              <div className="text-xs text-gray-500">Validating...</div>
            ) : (
              <div className="text-xs text-gray-500">
                Last validated: {status.validatedAt ? new Date(status.validatedAt).toLocaleString() : 'Never'}
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${getScoreColor(status.overallScore)}`}>
            {status.overallScore}
          </div>
          <div className="text-xs text-gray-500">Score</div>
        </div>
      </div>

      {/* Aspect Badges */}
      <div className="flex flex-wrap gap-2">
        {status.aspects.map((aspect) => (
          <Tooltip key={aspect.aspect}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={`${getAspectBadgeColor(aspect)} text-xs font-mono gap-1 ${
                  !aspect.enabled ? 'opacity-50' : ''
                }`}
              >
                {getAspectIcon(aspect)}
                <span>{aspectLabels[aspect.aspect]}</span>
                {aspect.enabled && !aspect.isValidating && (
                  <span className="ml-1">
                    {aspect.errorCount > 0 && `${aspect.errorCount}E`}
                    {aspect.errorCount > 0 && aspect.warningCount > 0 && ' '}
                    {aspect.warningCount > 0 && `${aspect.warningCount}W`}
                  </span>
                )}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{getAspectTooltip(aspect)}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ValidationStatusIndicator({ 
  status, 
  variant = 'compact' 
}: ValidationStatusIndicatorProps) {
  if (variant === 'compact') {
    return <CompactIndicator status={status} />;
  }
  
  return <DetailedIndicator status={status} />;
}
