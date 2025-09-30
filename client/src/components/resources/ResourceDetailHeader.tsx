import { useMemo } from 'react';
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, AlertTriangle, Info, RefreshCw, Edit, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CircularProgress } from '@/components/ui/circular-progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAspectSettingsReactive } from '@/hooks/use-aspect-settings-reactive';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface AspectValidationResult {
  aspect: 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata';
  enabled: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  totalIssues: number;
  isValid: boolean;
  validatedAt?: string;
}

export interface ResourceIdentity {
  resourceType: string;
  fhirId: string;
  versionId?: string;
  lastModified?: string;
}

export interface ResourceDetailHeaderProps {
  identity: ResourceIdentity;
  aggregatedScore: number;
  aspectResults: AspectValidationResult[];
  isValidating?: boolean;
  settingsSnapshotHash?: string;
  settingsSnapshotTime?: string;
  onRevalidate?: () => void;
  onEdit?: () => void;
  isRevalidating?: boolean;
  /** If true, shows action buttons inline in the header footer. If false, actions should be rendered separately */
  showActions?: boolean;
}

// ============================================================================
// Aspect Display Configuration
// ============================================================================

const ASPECT_CONFIG = {
  structural: {
    label: 'Structural',
    description: 'FHIR schema and structure validation',
    color: 'blue',
  },
  profile: {
    label: 'Profile',
    description: 'Profile conformance validation',
    color: 'purple',
  },
  terminology: {
    label: 'Terminology',
    description: 'Terminology binding validation',
    color: 'green',
  },
  reference: {
    label: 'Reference',
    description: 'Reference integrity validation',
    color: 'orange',
  },
  businessRule: {
    label: 'Business Rule',
    description: 'Business logic validation',
    color: 'red',
  },
  metadata: {
    label: 'Metadata',
    description: 'Metadata quality validation',
    color: 'gray',
  },
} as const;

// ============================================================================
// Helper Components
// ============================================================================

function AspectChip({ result }: { result: AspectValidationResult }) {
  const { isAspectEnabled, isValidating } = useAspectSettingsReactive({ enabled: true });
  const enabled = isAspectEnabled(result.aspect);
  const validating = isValidating();

  const config = ASPECT_CONFIG[result.aspect];
  
  // Determine chip variant based on validation state
  const getVariant = () => {
    if (!enabled) return 'outline';
    if (result.errorCount > 0) return 'destructive';
    if (result.warningCount > 0) return 'warning';
    if (result.totalIssues === 0) return 'success';
    return 'secondary';
  };

  const variant = getVariant();

  const chipContent = (
    <Badge
      variant={variant as any}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1 transition-all',
        !enabled && 'opacity-50 grayscale',
        validating && 'animate-pulse'
      )}
    >
      {validating ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : result.errorCount > 0 ? (
        <XCircle className="h-3 w-3" />
      ) : result.warningCount > 0 ? (
        <AlertTriangle className="h-3 w-3" />
      ) : result.infoCount > 0 ? (
        <Info className="h-3 w-3" />
      ) : result.totalIssues === 0 ? (
        <CheckCircle className="h-3 w-3" />
      ) : null}
      
      <span className="font-medium">{config.label}</span>
      
      {enabled && result.totalIssues > 0 && (
        <span className="ml-1 font-mono text-xs">
          {result.totalIssues}
        </span>
      )}
    </Badge>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {chipContent}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-semibold">{config.label}</p>
          <p className="text-xs text-gray-400">{config.description}</p>
          {enabled ? (
            <div className="text-xs mt-2 space-y-0.5">
              <div className="flex justify-between gap-4">
                <span>Errors:</span>
                <span className="font-mono">{result.errorCount}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Warnings:</span>
                <span className="font-mono">{result.warningCount}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Info:</span>
                <span className="font-mono">{result.infoCount}</span>
              </div>
              {result.validatedAt && (
                <div className="text-xs text-gray-500 mt-1 pt-1 border-t border-gray-700">
                  Validated: {new Date(result.validatedAt).toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-yellow-400 mt-2">
              This aspect is currently disabled in settings
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ResourceDetailHeader({
  identity,
  aggregatedScore,
  aspectResults,
  isValidating = false,
  settingsSnapshotHash,
  settingsSnapshotTime,
  onRevalidate,
  onEdit,
  isRevalidating = false,
  showActions = true,
}: ResourceDetailHeaderProps) {
  // Calculate summary counts
  const summary = useMemo(() => {
    const totalErrors = aspectResults
      .filter(r => r.enabled)
      .reduce((sum, r) => sum + r.errorCount, 0);
    const totalWarnings = aspectResults
      .filter(r => r.enabled)
      .reduce((sum, r) => sum + r.warningCount, 0);
    const totalInfo = aspectResults
      .filter(r => r.enabled)
      .reduce((sum, r) => sum + r.infoCount, 0);
    const totalIssues = totalErrors + totalWarnings + totalInfo;
    const isValid = totalErrors === 0;

    return { totalErrors, totalWarnings, totalInfo, totalIssues, isValid };
  }, [aspectResults]);

  return (
    <div className="bg-white rounded-lg border p-6 shadow-sm">
      <div className="space-y-4">
        {/* Top Row: Navigation + Resource Identity + Score */}
        <div className="flex items-start justify-between gap-6">
          {/* Left: Back button + Identity */}
          <div className="flex items-start gap-4 flex-1">
            <Link href="/resources">
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-1"
                aria-label="Back to resource browser"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900 truncate">
                  {identity.resourceType}
                </h1>
                {isValidating && (
                  <Badge variant="outline" className="gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Validating...
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm text-gray-600 font-mono">
                  ID: {identity.fhirId}
                </p>
                {identity.versionId && (
                  <Badge variant="outline" className="text-xs font-mono">
                    v{identity.versionId}
                  </Badge>
                )}
                {identity.lastModified && (
                  <p className="text-xs text-gray-500">
                    Modified: {new Date(identity.lastModified).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Validation Status Badges */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {summary.isValid ? (
                  <Badge className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Valid
                  </Badge>
                ) : (
                  <Badge className="bg-red-50 text-red-700 border-red-200">
                    <XCircle className="h-3 w-3 mr-1" />
                    {summary.totalErrors} Error{summary.totalErrors !== 1 ? 's' : ''}
                  </Badge>
                )}
                
                {summary.totalWarnings > 0 && (
                  <Badge className="bg-orange-50 text-orange-700 border-orange-200">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {summary.totalWarnings} Warning{summary.totalWarnings !== 1 ? 's' : ''}
                  </Badge>
                )}

                {summary.totalInfo > 0 && (
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                    <Info className="h-3 w-3 mr-1" />
                    {summary.totalInfo} Info
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Right: Aggregated Score */}
          <div className="flex items-center gap-4">
            <CircularProgress 
              value={aggregatedScore} 
              size="lg"
              showValue={true}
              className="flex-shrink-0"
            />
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">Validation Score</p>
              <p className="text-xs text-gray-500">
                {summary.totalIssues} issue{summary.totalIssues !== 1 ? 's' : ''} found
              </p>
            </div>
          </div>
        </div>

        {/* Middle Row: Per-Aspect Chips */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100">
          {aspectResults.map((result) => (
            <AspectChip key={result.aspect} result={result} />
          ))}
        </div>

        {/* Bottom Row: Settings Snapshot + Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          {/* Settings snapshot info */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {settingsSnapshotHash && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-mono cursor-help">
                    Settings: {settingsSnapshotHash.substring(0, 8)}...
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Settings Snapshot Hash</p>
                  <p className="font-mono text-xs">{settingsSnapshotHash}</p>
                  {settingsSnapshotTime && (
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(settingsSnapshotTime).toLocaleString()}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Action buttons */}
          {showActions && (
            <div className="flex items-center gap-2">
              {onRevalidate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRevalidate}
                  disabled={isRevalidating}
                  className="gap-2"
                >
                  {isRevalidating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Revalidating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Revalidate
                    </>
                  )}
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onEdit}
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit Resource
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
