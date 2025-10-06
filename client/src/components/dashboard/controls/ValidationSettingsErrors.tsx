import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  XCircle, 
  Info, 
  CheckCircle, 
  RefreshCw,
  X,
  AlertCircle,
  Wifi,
  Database,
  Server,
  Settings,
  HelpCircle
} from 'lucide-react';
import { 
  ValidationSettingsError,
  ValidationSettingsErrorHandlerUtils 
} from '@/lib/validation-settings-error-handler';
import { cn } from '@/lib/utils';

interface ValidationSettingsErrorsProps {
  errors: ValidationSettingsError[];
  onRetry?: (error: ValidationSettingsError) => void;
  onDismiss?: (error: ValidationSettingsError) => void;
  onDismissAll?: () => void;
  onRetryAll?: () => void;
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
  maxDisplay?: number;
}

export const ValidationSettingsErrors: React.FC<ValidationSettingsErrorsProps> = ({
  errors,
  onRetry,
  onDismiss,
  onDismissAll,
  onRetryAll,
  className,
  showDetails = true,
  compact = false,
  maxDisplay = 5,
}) => {
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  const toggleErrorExpansion = (errorId: string) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(errorId)) {
        newSet.delete(errorId);
      } else {
        newSet.add(errorId);
      }
      return newSet;
    });
  };

  const getErrorIcon = (error: ValidationSettingsError) => {
    switch (error.type) {
      case 'validation': return <AlertTriangle className="h-4 w-4" />;
      case 'network': return <Wifi className="h-4 w-4" />;
      case 'persistence': return <Database className="h-4 w-4" />;
      case 'server': return <Server className="h-4 w-4" />;
      case 'configuration': return <Settings className="h-4 w-4" />;
      case 'unknown': return <HelpCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getErrorColor = (error: ValidationSettingsError) => {
    return ValidationSettingsErrorHandlerUtils.getErrorColor(error);
  };

  const getErrorSeverityIcon = (error: ValidationSettingsError) => {
    switch (error.severity) {
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(timestamp);
  };

  const getErrorStatistics = () => {
    const stats = {
      total: errors.length,
      errors: errors.filter(e => e.severity === 'error').length,
      warnings: errors.filter(e => e.severity === 'warning').length,
      info: errors.filter(e => e.severity === 'info').length,
      recoverable: errors.filter(e => e.recoverable).length,
      retryable: errors.filter(e => e.autoRetry).length,
    };

    return stats;
  };

  const stats = getErrorStatistics();
  const displayErrors = errors.slice(0, maxDisplay);
  const hasMoreErrors = errors.length > maxDisplay;

  if (errors.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-green-600">
            <CheckCircle className="h-6 w-6 mr-2" />
            <span>No errors detected</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Settings Errors</span>
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="text-xs">
                {stats.errors} errors
              </Badge>
              {stats.warnings > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {stats.warnings} warnings
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {onRetryAll && stats.retryable > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetryAll}
                className="text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry All ({stats.retryable})
              </Button>
            )}
            {onDismissAll && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismissAll}
                className="text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Dismiss All
              </Button>
            )}
          </div>

          {/* Recent errors */}
          {displayErrors.map((error, index) => (
            <div key={error.id} className="flex items-center gap-2 text-sm">
              {getErrorSeverityIcon(error)}
              <span className="flex-1">{error.message}</span>
              {onRetry && error.autoRetry && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRetry(error)}
                  className="text-xs"
                >
                  Retry
                </Button>
              )}
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDismiss(error)}
                  className="text-xs"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          
          {hasMoreErrors && (
            <div className="text-xs text-muted-foreground">
              +{errors.length - maxDisplay} more errors
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Settings Errors
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="text-sm">
              {stats.errors} errors
            </Badge>
            {stats.warnings > 0 && (
              <Badge variant="secondary" className="text-sm">
                {stats.warnings} warnings
              </Badge>
            )}
            {stats.info > 0 && (
              <Badge variant="outline" className="text-sm">
                {stats.info} info
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error statistics */}
        {showDetails && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Errors:</span>
              <span className="ml-2 font-medium">{stats.total}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Recoverable:</span>
              <span className="ml-2 font-medium text-green-600">{stats.recoverable}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Retryable:</span>
              <span className="ml-2 font-medium text-blue-600">{stats.retryable}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Critical:</span>
              <span className="ml-2 font-medium text-red-600">{stats.errors - stats.recoverable}</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onRetryAll && stats.retryable > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetryAll}
              className="text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry All ({stats.retryable})
            </Button>
          )}
          {onDismissAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismissAll}
              className="text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Dismiss All
            </Button>
          )}
        </div>

        {/* Error list */}
        <div className="space-y-3">
          {displayErrors.map((error, index) => {
            const isExpanded = expandedErrors.has(error.id);
            const errorColor = getErrorColor(error);
            
            return (
              <div
                key={error.id}
                className={cn(
                  'p-3 rounded border text-sm',
                  errorColor
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getErrorIcon(error)}
                    {getErrorSeverityIcon(error)}
                    <span className="font-medium">{error.message}</span>
                    <Badge variant="outline" className="text-xs">
                      {error.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(error.timestamp)}
                    </span>
                    {showDetails && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleErrorExpansion(error.id)}
                        className="text-xs"
                      >
                        {isExpanded ? 'Hide' : 'Show'} Details
                      </Button>
                    )}
                    {onRetry && error.autoRetry && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRetry(error)}
                        className="text-xs"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Retry
                      </Button>
                    )}
                    {onDismiss && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDismiss(error)}
                        className="text-xs"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {error.description && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {error.description}
                  </p>
                )}

                {isExpanded && showDetails && (
                  <div className="space-y-2 text-xs">
                    {error.field && (
                      <div>
                        <span className="font-medium">Field:</span>
                        <span className="ml-2">{error.field}</span>
                      </div>
                    )}
                    {error.code && (
                      <div>
                        <span className="font-medium">Code:</span>
                        <span className="ml-2">{error.code}</span>
                      </div>
                    )}
                    {error.context && Object.keys(error.context).length > 0 && (
                      <div>
                        <span className="font-medium">Context:</span>
                        <pre className="ml-2 mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto">
                          {JSON.stringify(error.context, null, 2)}
                        </pre>
                      </div>
                    )}
                    {error.suggestions && error.suggestions.length > 0 && (
                      <div>
                        <span className="font-medium">Suggestions:</span>
                        <ul className="ml-2 mt-1 list-disc list-inside">
                          {error.suggestions.map((suggestion, idx) => (
                            <li key={idx}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {hasMoreErrors && (
          <div className="text-center text-sm text-muted-foreground">
            +{errors.length - maxDisplay} more errors
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ValidationSettingsErrors;