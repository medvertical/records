import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  AlertTriangle, 
  XCircle, 
  Info, 
  ChevronDown, 
  ChevronRight, 
  ExternalLink,
  Copy,
  Filter,
  Search,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { responsiveClasses, getResponsiveClassNames } from '@/lib/responsive-design-utils';
import { accessibility, keyboardNavigation, screenReader } from '@/lib/accessibility-utils.tsx';
import { SkeletonComponents, LoadingSpinner, LoadingState } from '@/lib/loading-states-utils.tsx';

export interface ValidationError {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  resourceType?: string;
  resourceId?: string;
  aspect?: string;
  timestamp: Date;
  details?: string;
  suggestions?: string[];
  code?: string;
  path?: string;
}

export interface ValidationWarning {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  resourceType?: string;
  resourceId?: string;
  aspect?: string;
  timestamp: Date;
  details?: string;
  suggestions?: string[];
  code?: string;
  path?: string;
}

interface ValidationErrorWarningDisplayProps {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  className?: string;
  showDetails?: boolean;
  showFilters?: boolean;
  showSearch?: boolean;
  maxDisplayItems?: number;
  onErrorClick?: (error: ValidationError) => void;
  onWarningClick?: (warning: ValidationWarning) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  loadingText?: string;
}

/**
 * ValidationErrorWarningDisplay Component - Comprehensive error and warning display
 */
export const ValidationErrorWarningDisplay: React.FC<ValidationErrorWarningDisplayProps> = ({
  errors,
  warnings,
  className,
  showDetails = true,
  showFilters = true,
  showSearch = true,
  maxDisplayItems = 10,
  onErrorClick,
  onWarningClick,
  onRefresh,
  isLoading = false,
  loadingText = 'Loading errors and warnings...',
}) => {
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [expandedWarnings, setExpandedWarnings] = useState<Set<string>>(new Set());
  const [errorFilter, setErrorFilter] = useState<string>('all');
  const [warningFilter, setWarningFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Filter and search logic
  const filteredErrors = errors.filter(error => {
    const matchesFilter = errorFilter === 'all' || error.severity === errorFilter;
    const matchesSearch = !searchTerm || 
      error.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      error.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      error.resourceType?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filteredWarnings = warnings.filter(warning => {
    const matchesFilter = warningFilter === 'all' || warning.severity === warningFilter;
    const matchesSearch = !searchTerm || 
      warning.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      warning.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      warning.resourceType?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  // Get severity icon
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  // Toggle expansion
  const toggleErrorExpansion = (errorId: string) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(errorId)) {
      newExpanded.delete(errorId);
    } else {
      newExpanded.add(errorId);
    }
    setExpandedErrors(newExpanded);
  };

  const toggleWarningExpansion = (warningId: string) => {
    const newExpanded = new Set(expandedWarnings);
    if (newExpanded.has(warningId)) {
      newExpanded.delete(warningId);
    } else {
      newExpanded.add(warningId);
    }
    setExpandedWarnings(newExpanded);
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Format timestamp
  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Render error item
  const renderErrorItem = (error: ValidationError, index: number) => {
    const isExpanded = expandedErrors.has(error.id);
    
    return (
      <div key={error.id} className="border-b border-gray-200 last:border-b-0">
        <div 
          className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
          onClick={() => onErrorClick?.(error)}
        >
          <div className="flex items-start gap-3">
            {getSeverityIcon(error.severity)}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={getSeverityColor(error.severity)} className="text-xs">
                  {error.severity}
                </Badge>
                {error.type && (
                  <Badge variant="outline" className="text-xs">
                    {error.type}
                  </Badge>
                )}
                {error.aspect && (
                  <Badge variant="outline" className="text-xs">
                    {error.aspect}
                  </Badge>
                )}
                <span className="text-xs text-gray-500">
                  {formatTimestamp(error.timestamp)}
                </span>
              </div>
              
              <p className="text-sm font-medium text-gray-900 mb-1">
                {error.message}
              </p>
              
              {error.resourceType && error.resourceId && (
                <p className="text-xs text-gray-600">
                  {error.resourceType} • {error.resourceId}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(error.message);
                }}
                className="h-6 w-6 p-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
              
              {showDetails && (error.details || error.suggestions) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleErrorExpansion(error.id);
                  }}
                  className="h-6 w-6 p-0"
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </Button>
              )}
            </div>
          </div>
          
          {isExpanded && showDetails && (
            <div className="mt-3 pl-7 space-y-2">
              {error.details && (
                <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                  <strong>Details:</strong> {error.details}
                </div>
              )}
              
              {error.suggestions && error.suggestions.length > 0 && (
                <div className="text-sm">
                  <strong className="text-gray-700">Suggestions:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {error.suggestions.map((suggestion, idx) => (
                      <li key={idx} className="text-gray-600">{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {error.code && (
                <div className="text-xs text-gray-500">
                  <strong>Code:</strong> {error.code}
                </div>
              )}
              
              {error.path && (
                <div className="text-xs text-gray-500">
                  <strong>Path:</strong> {error.path}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render warning item
  const renderWarningItem = (warning: ValidationWarning, index: number) => {
    const isExpanded = expandedWarnings.has(warning.id);
    
    return (
      <div key={warning.id} className="border-b border-gray-200 last:border-b-0">
        <div 
          className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
          onClick={() => onWarningClick?.(warning)}
        >
          <div className="flex items-start gap-3">
            {getSeverityIcon(warning.severity)}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={getSeverityColor(warning.severity)} className="text-xs">
                  {warning.severity}
                </Badge>
                {warning.type && (
                  <Badge variant="outline" className="text-xs">
                    {warning.type}
                  </Badge>
                )}
                {warning.aspect && (
                  <Badge variant="outline" className="text-xs">
                    {warning.aspect}
                  </Badge>
                )}
                <span className="text-xs text-gray-500">
                  {formatTimestamp(warning.timestamp)}
                </span>
              </div>
              
              <p className="text-sm font-medium text-gray-900 mb-1">
                {warning.message}
              </p>
              
              {warning.resourceType && warning.resourceId && (
                <p className="text-xs text-gray-600">
                  {warning.resourceType} • {warning.resourceId}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(warning.message);
                }}
                className="h-6 w-6 p-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
              
              {showDetails && (warning.details || warning.suggestions) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWarningExpansion(warning.id);
                  }}
                  className="h-6 w-6 p-0"
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </Button>
              )}
            </div>
          </div>
          
          {isExpanded && showDetails && (
            <div className="mt-3 pl-7 space-y-2">
              {warning.details && (
                <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                  <strong>Details:</strong> {warning.details}
                </div>
              )}
              
              {warning.suggestions && warning.suggestions.length > 0 && (
                <div className="text-sm">
                  <strong className="text-gray-700">Suggestions:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {warning.suggestions.map((suggestion, idx) => (
                      <li key={idx} className="text-gray-600">{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {warning.code && (
                <div className="text-xs text-gray-500">
                  <strong>Code:</strong> {warning.code}
                </div>
              )}
              
              {warning.path && (
                <div className="text-xs text-gray-500">
                  <strong>Path:</strong> {warning.path}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-center p-8">
          <LoadingSpinner size="md" text={loadingText} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with filters and search */}
      {(showFilters || showSearch) && (
        <div className={getResponsiveClassNames(
          "flex items-center gap-4 p-4 bg-gray-50 rounded-lg",
          "flex-col sm:flex-row gap-4 sm:gap-4 p-3 sm:p-4"
        )}>
          {showFilters && (
            <div className={getResponsiveClassNames(
              "flex items-center gap-2",
              "flex-col sm:flex-row gap-2 sm:gap-2 w-full sm:w-auto"
            )}>
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={errorFilter}
                onChange={(e) => setErrorFilter(e.target.value)}
                className={getResponsiveClassNames(
                  "text-sm border border-gray-300 rounded px-2 py-1",
                  "w-full sm:w-auto text-sm border border-gray-300 rounded px-2 py-1"
                )}
              >
                <option value="all">All Errors</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select
                value={warningFilter}
                onChange={(e) => setWarningFilter(e.target.value)}
                className={getResponsiveClassNames(
                  "text-sm border border-gray-300 rounded px-2 py-1",
                  "w-full sm:w-auto text-sm border border-gray-300 rounded px-2 py-1"
                )}
              >
                <option value="all">All Warnings</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          )}
          
          {showSearch && (
            <div className={getResponsiveClassNames(
              "flex items-center gap-2 flex-1",
              "flex items-center gap-2 flex-1 w-full sm:w-auto"
            )}>
              <Search className="h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search errors and warnings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={getResponsiveClassNames(
                  "flex-1 text-sm border border-gray-300 rounded px-2 py-1",
                  "w-full sm:flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                )}
                aria-label="Search errors and warnings"
                aria-describedby="search-help"
              />
              <div id="search-help" className="sr-only">
                Search through validation errors and warnings by message, type, or resource
              </div>
            </div>
          )}
          
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className={getResponsiveClassNames(
                "h-8 w-8 p-0",
                "h-8 w-8 p-0 w-full sm:w-auto"
              )}
              {...accessibility.button({
                label: 'Refresh Errors and Warnings',
                disabled: false
              })}
              onKeyDown={keyboardNavigation.handleEnter(onRefresh)}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline ml-2">Refresh</span>
              {screenReader.srOnly('Refresh errors and warnings list')}
            </Button>
          )}
        </div>
      )}

      {/* Errors Section */}
      {filteredErrors.length > 0 && (
        <Card
          {...accessibility.region({
            label: 'Validation Errors',
            live: true
          })}
        >
          <CardHeader className={getResponsiveClassNames(
            "pb-3",
            "pb-3 sm:pb-4"
          )}>
            <CardTitle className={getResponsiveClassNames(
              "flex items-center gap-2 text-lg",
              "flex flex-col sm:flex-row gap-2 sm:gap-2 text-base sm:text-lg"
            )}>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
                <span>Validation Errors</span>
              </div>
              <Badge 
                variant="destructive" 
                className={getResponsiveClassNames(
                  "ml-auto",
                  "ml-0 sm:ml-auto"
                )}
                aria-label={`${filteredErrors.length} validation errors`}
              >
                {filteredErrors.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div 
              className={getResponsiveClassNames(
                "max-h-96 overflow-y-auto",
                "max-h-64 sm:max-h-96 overflow-y-auto"
              )}
              {...accessibility.list({
                label: 'Validation Errors List',
                orientation: 'vertical'
              })}
            >
              {filteredErrors.slice(0, maxDisplayItems).map((error, index) => 
                renderErrorItem(error, index)
              )}
              {filteredErrors.length > maxDisplayItems && (
                <div className={getResponsiveClassNames(
                  "p-3 text-center text-sm text-gray-500 border-t",
                  "p-3 sm:p-4 text-center text-sm text-gray-500 border-t"
                )}>
                  Showing {maxDisplayItems} of {filteredErrors.length} errors
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warnings Section */}
      {filteredWarnings.length > 0 && (
        <Card
          {...accessibility.region({
            label: 'Validation Warnings',
            live: true
          })}
        >
          <CardHeader className={getResponsiveClassNames(
            "pb-3",
            "pb-3 sm:pb-4"
          )}>
            <CardTitle className={getResponsiveClassNames(
              "flex items-center gap-2 text-lg",
              "flex flex-col sm:flex-row gap-2 sm:gap-2 text-base sm:text-lg"
            )}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" aria-hidden="true" />
                <span>Validation Warnings</span>
              </div>
              <Badge 
                variant="secondary" 
                className={getResponsiveClassNames(
                  "ml-auto",
                  "ml-0 sm:ml-auto"
                )}
                aria-label={`${filteredWarnings.length} validation warnings`}
              >
                {filteredWarnings.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div 
              className={getResponsiveClassNames(
                "max-h-96 overflow-y-auto",
                "max-h-64 sm:max-h-96 overflow-y-auto"
              )}
              {...accessibility.list({
                label: 'Validation Warnings List',
                orientation: 'vertical'
              })}
            >
              {filteredWarnings.slice(0, maxDisplayItems).map((warning, index) => 
                renderWarningItem(warning, index)
              )}
              {filteredWarnings.length > maxDisplayItems && (
                <div className={getResponsiveClassNames(
                  "p-3 text-center text-sm text-gray-500 border-t",
                  "p-3 sm:p-4 text-center text-sm text-gray-500 border-t"
                )}>
                  Showing {maxDisplayItems} of {filteredWarnings.length} warnings
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No errors or warnings */}
      {filteredErrors.length === 0 && filteredWarnings.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <h3 className="text-lg font-medium text-gray-900">No Issues Found</h3>
              <p className="text-sm text-gray-500">
                {searchTerm || errorFilter !== 'all' || warningFilter !== 'all' 
                  ? 'No errors or warnings match your current filters.'
                  : 'All validation checks passed successfully!'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

/**
 * CompactErrorWarningDisplay Component - Minimal error and warning display
 */
interface CompactErrorWarningDisplayProps {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  className?: string;
  maxItems?: number;
}

export const CompactErrorWarningDisplay: React.FC<CompactErrorWarningDisplayProps> = ({
  errors,
  warnings,
  className,
  maxItems = 3,
}) => {
  const criticalErrors = errors.filter(e => e.severity === 'critical' || e.severity === 'high');
  const highWarnings = warnings.filter(w => w.severity === 'high');

  return (
    <div className={cn('space-y-2', className)}>
      {criticalErrors.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded">
          <XCircle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-medium text-red-700">
            {criticalErrors.length} critical error{criticalErrors.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
      
      {highWarnings.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium text-yellow-700">
            {highWarnings.length} high priority warning{highWarnings.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
      
      {errors.length === 0 && warnings.length === 0 && (
        <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium text-green-700">No issues found</span>
        </div>
      )}
    </div>
  );
};

export default ValidationErrorWarningDisplay;
