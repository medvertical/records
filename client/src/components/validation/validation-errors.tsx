import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ValidationResult, ValidationError } from "@shared/schema";
import { AlertCircle, CheckCircle, AlertTriangle, Info, Lightbulb, Clock, RotateCcw, Filter, Grid3X3, Search, X, Download, FileText, Table } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ValidationErrorsProps {
  validationResults: ValidationResult[];
  resourceData?: any;
}

type ValidationCategory = 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata';
type ValidationSeverity = 'error' | 'warning' | 'information';

export default function ValidationErrors({ validationResults, resourceData }: ValidationErrorsProps) {
  const [selectedCategory, setSelectedCategory] = useState<ValidationCategory | 'all'>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<ValidationSeverity | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat' | 'aggregated'>('grouped');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<'category' | 'severity' | 'message' | 'path'>('category');
  const [selectedIssueForResolution, setSelectedIssueForResolution] = useState<ValidationError | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showResolutionDialog, setShowResolutionDialog] = useState(false);

  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];

  validationResults.forEach(result => {
    if (Array.isArray(result.errors)) {
      allErrors.push(...result.errors);
    }
    if (Array.isArray(result.warnings)) {
      allWarnings.push(...result.warnings);
    }
  });

  const allIssues = [...allErrors, ...allWarnings];

  const hasErrors = allErrors.length > 0;
  const hasWarnings = allWarnings.length > 0;
  const isValid = !hasErrors;

  // Filter issues based on selected filters and search query
  const filteredIssues = allIssues.filter(issue => {
    const categoryMatch = selectedCategory === 'all' || issue.category === selectedCategory;
    const severityMatch = selectedSeverity === 'all' || issue.severity === selectedSeverity;
    
    // Search functionality - search in message, code, path, and expression
    const searchMatch = searchQuery === '' || 
      issue.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.code && issue.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      issue.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.expression && issue.expression.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return categoryMatch && severityMatch && searchMatch;
  });

  // Group issues by category and severity
  const groupedIssues = filteredIssues.reduce((groups, issue) => {
    const category = issue.category || 'unknown';
    const severity = issue.severity;
    
    if (!groups[category]) {
      groups[category] = {};
    }
    if (!groups[category][severity]) {
      groups[category][severity] = [];
    }
    
    groups[category][severity].push(issue);
    return groups;
  }, {} as Record<string, Record<string, ValidationError[]>>);

  // Advanced grouping by different criteria
  const getGroupKey = (issue: ValidationError) => {
    switch (groupBy) {
      case 'message':
        // Group by similar error messages (normalized)
        return issue.message.toLowerCase()
          .replace(/\d+/g, 'N') // Replace numbers with N
          .replace(/['"]/g, '') // Remove quotes
          .substring(0, 50); // Limit length
      case 'path':
        // Group by path pattern
        return issue.path.split('.').slice(0, -1).join('.') || 'root';
      case 'severity':
        return issue.severity;
      case 'category':
      default:
        return issue.category || 'structural';
    }
  };

  const advancedGroupedIssues = filteredIssues.reduce((groups, issue) => {
    const key = getGroupKey(issue);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(issue);
    return groups;
  }, {} as Record<string, ValidationError[]>);

  // Aggregation statistics
  const getAggregatedStats = () => {
    const stats = {
      totalIssues: filteredIssues.length,
      categoryBreakdown: {} as Record<string, number>,
      severityBreakdown: {} as Record<string, number>,
      topMessages: [] as Array<{ message: string; count: number }>,
      topPaths: [] as Array<{ path: string; count: number }>,
      resourcesAffected: new Set<string>(),
    };

    // Count by category and severity
    filteredIssues.forEach(issue => {
      const category = issue.category || 'structural';
      stats.categoryBreakdown[category] = (stats.categoryBreakdown[category] || 0) + 1;
      stats.severityBreakdown[issue.severity] = (stats.severityBreakdown[issue.severity] || 0) + 1;
      
      // Count resources affected
      validationResults.forEach(result => {
        if (result.errors.some(e => e === issue) || result.warnings.some(w => w === issue)) {
          stats.resourcesAffected.add(result.resourceId.toString());
        }
      });
    });

    // Get top messages
    const messageCounts = filteredIssues.reduce((counts, issue) => {
      const normalized = issue.message.toLowerCase().substring(0, 50);
      counts[normalized] = (counts[normalized] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    stats.topMessages = Object.entries(messageCounts)
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get top paths
    const pathCounts = filteredIssues.reduce((counts, issue) => {
      const path = issue.path || 'root';
      counts[path] = (counts[path] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    stats.topPaths = Object.entries(pathCounts)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return stats;
  };

  const aggregatedStats = getAggregatedStats();

  // Export functionality
  const exportToJSON = () => {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalIssues: filteredIssues.length,
        totalResources: validationResults.length,
        filters: {
          category: selectedCategory,
          severity: selectedSeverity,
          searchQuery,
          viewMode,
          groupBy
        }
      },
      summary: aggregatedStats,
      issues: filteredIssues.map(issue => ({
        message: issue.message,
        path: issue.path,
        severity: issue.severity,
        category: issue.category,
        code: issue.code,
        expression: issue.expression
      })),
      resources: validationResults.map(result => ({
        resourceId: result.resourceId,
        resourceType: result.resourceType,
        isValid: result.isValid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        isRetry: result.isRetry,
        retryAttemptCount: result.retryAttemptCount
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation-errors-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    const headers = ['Resource ID', 'Resource Type', 'Severity', 'Category', 'Path', 'Message', 'Code', 'Expression', 'Is Retry', 'Retry Count'];
    const rows = [headers];

    validationResults.forEach(result => {
      const allIssues = [...result.errors, ...result.warnings];
      if (allIssues.length === 0) {
        rows.push([
          result.resourceId.toString(),
          result.resourceType || 'Unknown',
          '',
          '',
          '',
          'No issues',
          '',
          '',
          result.isRetry ? 'Yes' : 'No',
          result.retryAttemptCount?.toString() || '0'
        ]);
      } else {
        allIssues.forEach(issue => {
          rows.push([
            result.resourceId.toString(),
            result.resourceType || 'Unknown',
            issue.severity,
            issue.category || 'unknown',
            issue.path,
            `"${issue.message.replace(/"/g, '""')}"`,
            issue.code || '',
            issue.expression || '',
            result.isRetry ? 'Yes' : 'No',
            result.retryAttemptCount?.toString() || '0'
          ]);
        });
      }
    });

    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation-errors-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToText = () => {
    let textContent = `FHIR Validation Error Report\n`;
    textContent += `Generated: ${new Date().toISOString()}\n`;
    textContent += `Total Issues: ${filteredIssues.length}\n`;
    textContent += `Total Resources: ${validationResults.length}\n`;
    textContent += `Resources with Errors: ${aggregatedStats.resourcesAffected.size}\n\n`;

    textContent += `SUMMARY BY CATEGORY:\n`;
    Object.entries(aggregatedStats.categoryBreakdown).forEach(([category, count]) => {
      const categoryInfo = getCategoryInfo(category);
      textContent += `  ${categoryInfo.icon} ${categoryInfo.name}: ${count} issues\n`;
    });

    textContent += `\nSUMMARY BY SEVERITY:\n`;
    Object.entries(aggregatedStats.severityBreakdown).forEach(([severity, count]) => {
      textContent += `  ${getSeverityIcon(severity as ValidationError['severity'])} ${severity.charAt(0).toUpperCase() + severity.slice(1)}s: ${count} issues\n`;
    });

    if (aggregatedStats.topMessages.length > 0) {
      textContent += `\nMOST COMMON ERROR MESSAGES:\n`;
      aggregatedStats.topMessages.forEach((item, index) => {
        textContent += `  ${index + 1}. ${item.message} (${item.count} occurrences)\n`;
      });
    }

    textContent += `\nDETAILED ISSUES:\n`;
    validationResults.forEach(result => {
      const allIssues = [...result.errors, ...result.warnings];
      if (allIssues.length > 0) {
        textContent += `\nResource ${result.resourceId} (${result.resourceType || 'Unknown'}):\n`;
        allIssues.forEach((issue, index) => {
          textContent += `  ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.category || 'unknown'}\n`;
          textContent += `     Path: ${issue.path}\n`;
          textContent += `     Message: ${issue.message}\n`;
          if (issue.code) textContent += `     Code: ${issue.code}\n`;
          if (issue.expression) textContent += `     Expression: ${issue.expression}\n`;
          textContent += `\n`;
        });
      }
    });

    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation-errors-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Resolution tracking functionality
  const handleResolutionAction = (issue: ValidationError, action: 'acknowledge' | 'resolve' | 'ignore') => {
    setSelectedIssueForResolution(issue);
    setResolutionNotes('');
    setShowResolutionDialog(true);
  };

  const saveResolution = (action: 'acknowledge' | 'resolve' | 'ignore') => {
    if (!selectedIssueForResolution) return;

    // Update the issue with resolution information
    const updatedIssue = {
      ...selectedIssueForResolution,
      resolutionStatus: action === 'acknowledge' ? 'acknowledged' : action === 'resolve' ? 'resolved' : 'ignored',
      resolutionNotes: resolutionNotes || undefined,
      resolvedBy: action === 'resolve' ? 'current-user' : undefined, // In real app, get from auth context
      resolvedAt: action === 'resolve' ? new Date().toISOString() : undefined,
      acknowledgedBy: action === 'acknowledge' ? 'current-user' : undefined,
      acknowledgedAt: action === 'acknowledge' ? new Date().toISOString() : undefined,
    };

    // In a real application, this would make an API call to save the resolution
    console.log('Saving resolution:', updatedIssue);
    
    // For now, we'll just close the dialog
    setShowResolutionDialog(false);
    setSelectedIssueForResolution(null);
    setResolutionNotes('');
  };

  const getResolutionStatusBadge = (issue: ValidationError) => {
    if (!issue.resolutionStatus || issue.resolutionStatus === 'unresolved') {
      return null;
    }

    const statusMap = {
      acknowledged: { variant: 'secondary' as const, label: 'Acknowledged', icon: '✓' },
      resolved: { variant: 'default' as const, label: 'Resolved', icon: '✅' },
      ignored: { variant: 'outline' as const, label: 'Ignored', icon: '👁️‍🗨️' },
    };

    const status = statusMap[issue.resolutionStatus];
    return (
      <Badge variant={status.variant} className="text-xs">
        {status.icon} {status.label}
      </Badge>
    );
  };

  // Get category display info
  const getCategoryInfo = (category: string) => {
    const categoryMap: Record<string, { name: string; icon: string; color: string }> = {
      structural: { name: 'Structural', icon: '🏗️', color: 'blue' },
      profile: { name: 'Profile', icon: '📋', color: 'green' },
      terminology: { name: 'Terminology', icon: '📚', color: 'purple' },
      reference: { name: 'Reference', icon: '🔗', color: 'orange' },
      businessRule: { name: 'Business Rule', icon: '⚖️', color: 'red' },
      metadata: { name: 'Metadata', icon: '📊', color: 'gray' },
      unknown: { name: 'Unknown', icon: '❓', color: 'gray' }
    };
    return categoryMap[category] || categoryMap.unknown;
  };

  const getSeverityIcon = (severity: ValidationError['severity']) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-fhir-error" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-fhir-warning" />;
      case 'information':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: ValidationError['severity']) => {
    switch (severity) {
      case 'error':
        return <Badge className="bg-red-50 text-fhir-error border-red-200">Error</Badge>;
      case 'warning':
        return <Badge className="bg-orange-50 text-fhir-warning border-orange-200">Warning</Badge>;
      case 'information':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Info</Badge>;
      default:
        return <Badge variant="secondary">{severity}</Badge>;
    }
  };

  const renderValidationIssue = (issue: ValidationError, index: number) => (
    <div key={index} className={cn(
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
                  {getCategoryInfo(issue.category).name}
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
        <div className="ml-4 flex flex-col gap-1">
          {(!issue.resolutionStatus || issue.resolutionStatus === 'unresolved') && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResolutionAction(issue, 'acknowledge')}
                className="text-xs"
              >
                ✓ Acknowledge
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResolutionAction(issue, 'resolve')}
                className="text-xs"
              >
                ✅ Resolve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResolutionAction(issue, 'ignore')}
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
              onClick={() => handleResolutionAction(issue, 'acknowledge')}
              className="text-xs"
            >
              Edit Resolution
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const getQuickFixes = () => {
    const fixes: string[] = [];
    
    allErrors.forEach(error => {
      if (error.message.toLowerCase().includes('missing') && error.message.toLowerCase().includes('required')) {
        const field = error.path?.split('.').pop() || 'field';
        fixes.push(`Add required field: ${field}`);
      }
      if (error.message.toLowerCase().includes('invalid') && error.message.toLowerCase().includes('format')) {
        const field = error.path?.split('.').pop() || 'field';
        fixes.push(`Fix format for: ${field}`);
      }
    });

    return [...new Set(fixes)]; // Remove duplicates
  };

  const quickFixes = getQuickFixes();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            {isValid ? (
              <CheckCircle className="h-5 w-5 text-fhir-success" />
            ) : (
              <AlertCircle className="h-5 w-5 text-fhir-error" />
            )}
            <span>Validation Results</span>
          </CardTitle>
          <Badge variant={isValid ? "default" : "destructive"}>
            {isValid ? "Valid" : `${allErrors.length} Error${allErrors.length !== 1 ? 's' : ''}`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {validationResults.length === 0 ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This resource has not been validated yet. Run validation to see detailed results.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Retry Information */}
            {validationResults.some(result => result.isRetry || result.retryAttemptCount > 0) && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <RotateCcw className="h-4 w-4 text-gray-600" />
                  <span className="font-medium text-gray-700">Validation Retry Summary</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Retries:</span>
                    <span className="ml-1 font-medium">
                      {validationResults.reduce((sum, result) => sum + (result.retryAttemptCount || 0), 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Resources with Retries:</span>
                    <span className="ml-1 font-medium">
                      {validationResults.filter(result => result.isRetry).length}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Duration:</span>
                    <span className="ml-1 font-medium">
                      {validationResults.reduce((sum, result) => sum + (result.totalRetryDurationMs || 0), 0)}ms
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Can Retry:</span>
                    <span className={`ml-1 font-medium ${
                      validationResults.some(result => result.canRetry) ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {validationResults.some(result => result.canRetry) ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                
                {/* Individual retry details */}
                <details className="mt-3">
                  <summary className="text-sm font-medium text-gray-700 cursor-pointer">Show Individual Retry Details</summary>
                  <div className="mt-2 space-y-2">
                    {validationResults
                      .filter(result => result.isRetry || result.retryAttemptCount > 0)
                      .map((result, index) => (
                        <div key={index} className="p-3 bg-white rounded border text-xs">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">Resource #{result.resourceId}</span>
                            <Badge variant="secondary">
                              {result.retryAttemptCount}/{result.maxRetryAttempts} attempts
                            </Badge>
                          </div>
                          <div className="text-gray-600 space-y-1">
                            <div>Duration: {result.totalRetryDurationMs}ms</div>
                            {result.retryReason && (
                              <div>Reason: {result.retryReason}</div>
                            )}
                            <div className="flex items-center gap-1">
                              <span>Status:</span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                result.canRetry ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {result.canRetry ? 'Can Retry' : 'Max Retries Reached'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </details>
              </div>
            )}

            {isValid && !hasWarnings ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-fhir-success" />
            <AlertDescription className="text-green-800">
              This resource passes all validation checks and conforms to the specified profiles.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
                {/* Filter Controls */}
                {allIssues.length > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Filter className="h-4 w-4 text-gray-600" />
                      <span className="font-medium text-gray-700">Filter & Group Issues</span>
                    </div>
                    <div className="flex flex-wrap gap-4 items-center">
                      {/* Search Input */}
                      <div className="flex items-center gap-2 flex-1 min-w-64">
                        <label className="text-sm font-medium text-gray-600">Search:</label>
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Search in messages, codes, paths..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-10"
                          />
                          {searchQuery && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSearchQuery('')}
                              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-600">Category:</label>
                        <Select value={selectedCategory} onValueChange={(value: any) => setSelectedCategory(value)}>
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            <SelectItem value="structural">Structural</SelectItem>
                            <SelectItem value="profile">Profile</SelectItem>
                            <SelectItem value="terminology">Terminology</SelectItem>
                            <SelectItem value="reference">Reference</SelectItem>
                            <SelectItem value="businessRule">Business Rule</SelectItem>
                            <SelectItem value="metadata">Metadata</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-600">Severity:</label>
                        <Select value={selectedSeverity} onValueChange={(value: any) => setSelectedSeverity(value)}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="error">Errors</SelectItem>
                            <SelectItem value="warning">Warnings</SelectItem>
                            <SelectItem value="information">Info</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">View:</label>
                <div className="flex border rounded-md">
                  <Button
                    variant={viewMode === 'grouped' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grouped')}
                    className="rounded-r-none"
                  >
                    <Grid3X3 className="h-4 w-4 mr-1" />
                    Grouped
                  </Button>
                  <Button
                    variant={viewMode === 'flat' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('flat')}
                    className="rounded-none"
                  >
                    Flat
                  </Button>
                  <Button
                    variant={viewMode === 'aggregated' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('aggregated')}
                    className="rounded-l-none"
                  >
                    <Filter className="h-4 w-4 mr-1" />
                    Stats
                  </Button>
                </div>
              </div>

              {viewMode === 'grouped' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600">Group by:</label>
                  <Select value={groupBy} onValueChange={(value: any) => setGroupBy(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category">Category</SelectItem>
                      <SelectItem value="severity">Severity</SelectItem>
                      <SelectItem value="message">Message</SelectItem>
                      <SelectItem value="path">Path</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-600">
                    Showing {filteredIssues.length} of {allIssues.length} issues
                  </div>
                  {(selectedCategory !== 'all' || selectedSeverity !== 'all' || searchQuery) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCategory('all');
                        setSelectedSeverity('all');
                        setSearchQuery('');
                      }}
                      className="text-xs"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>

                {/* Export Controls */}
                {filteredIssues.length > 0 && (
                  <div className="flex items-center gap-2 ml-auto">
                    <label className="text-sm font-medium text-gray-600">Export:</label>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportToJSON}
                        className="text-xs"
                        title="Export as JSON"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        JSON
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportToCSV}
                        className="text-xs"
                        title="Export as CSV"
                      >
                        <Table className="h-4 w-4 mr-1" />
                        CSV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportToText}
                        className="text-xs"
                        title="Export as Text Report"
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        TXT
                      </Button>
                    </div>
                  </div>
                )}
                </div>
              </div>
            )}

                {/* Issues Display */}
        {filteredIssues.length > 0 ? (
          viewMode === 'aggregated' ? (
            <div className="space-y-6">
              {/* Summary Statistics */}
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Validation Error Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{aggregatedStats.totalIssues}</div>
                    <div className="text-sm text-gray-600">Total Issues</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{aggregatedStats.severityBreakdown.error || 0}</div>
                    <div className="text-sm text-gray-600">Errors</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{aggregatedStats.severityBreakdown.warning || 0}</div>
                    <div className="text-sm text-gray-600">Warnings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{aggregatedStats.resourcesAffected.size}</div>
                    <div className="text-sm text-gray-600">Resources Affected</div>
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="mb-6">
                  <h4 className="font-medium text-gray-700 mb-3">Issues by Category</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(aggregatedStats.categoryBreakdown).map(([category, count]) => {
                      const categoryInfo = getCategoryInfo(category);
                      return (
                        <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span>{categoryInfo.icon}</span>
                            <span className="text-sm font-medium">{categoryInfo.name}</span>
                          </div>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top Messages */}
                {aggregatedStats.topMessages.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-700 mb-3">Most Common Error Messages</h4>
                    <div className="space-y-2">
                      {aggregatedStats.topMessages.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-700 flex-1 mr-3">{item.message}</span>
                          <Badge variant="outline">{item.count} occurrences</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Paths */}
                {aggregatedStats.topPaths.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-3">Most Problematic Paths</h4>
                    <div className="space-y-2">
                      {aggregatedStats.topPaths.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <code className="text-sm text-gray-700 flex-1 mr-3 font-mono">{item.path}</code>
                          <Badge variant="outline">{item.count} issues</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : viewMode === 'grouped' ? (
            groupBy === 'category' ? (
              <div className="space-y-4">
                {Object.entries(groupedIssues).map(([category, severityGroups]) => {
                  const categoryInfo = getCategoryInfo(category);
                  const totalIssues = Object.values(severityGroups).flat().length;

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
                        {Object.entries(severityGroups).map(([severity, issues]) => (
                          <div key={severity}>
                            <h4 className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                              {getSeverityIcon(severity as ValidationError['severity'])}
                              {severity.charAt(0).toUpperCase() + severity.slice(1)}s ({issues.length})
                            </h4>
                            <div className="space-y-2">
                              {issues.map((issue, index) => renderValidationIssue(issue, index))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(advancedGroupedIssues).map(([groupKey, issues]) => (
                  <div key={groupKey} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-800">
                          {groupBy === 'message' ? `"${groupKey}"` : 
                           groupBy === 'path' ? `Path: ${groupKey}` :
                           groupBy === 'severity' ? `${groupKey.charAt(0).toUpperCase() + groupKey.slice(1)}s` :
                           groupKey}
                        </h3>
                        <Badge variant="secondary">{issues.length} issues</Badge>
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      {issues.map((issue, index) => renderValidationIssue(issue, index))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-3">
              {filteredIssues.map((issue, index) => renderValidationIssue(issue, index))}
            </div>
          )
        ) : (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No issues found matching the selected filters.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Resolution Dialog */}
      {showResolutionDialog && selectedIssueForResolution && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Resolution Action</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Issue:</p>
              <div className="bg-gray-50 p-3 rounded border">
                <p className="text-sm font-medium">{selectedIssueForResolution.message}</p>
                <p className="text-xs text-gray-500 mt-1">Path: {selectedIssueForResolution.path}</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resolution Notes (optional)
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md text-sm"
                rows={3}
                placeholder="Add notes about how this issue was resolved..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowResolutionDialog(false);
                  setSelectedIssueForResolution(null);
                  setResolutionNotes('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => saveResolution('acknowledge')}
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
              >
                ✓ Acknowledge
              </Button>
              <Button
                variant="outline"
                onClick={() => saveResolution('resolve')}
                className="text-green-600 border-green-600 hover:bg-green-50"
              >
                ✅ Resolve
              </Button>
              <Button
                variant="outline"
                onClick={() => saveResolution('ignore')}
                className="text-gray-600 border-gray-600 hover:bg-gray-50"
              >
                👁️ Ignore
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
})}
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(advancedGroupedIssues).map(([groupKey, issues]) => (
                  <div key={groupKey} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-800">
                          {groupBy === 'message' ? `"${groupKey}"` : 
                           groupBy === 'path' ? `Path: ${groupKey}` :
                           groupBy === 'severity' ? `${groupKey.charAt(0).toUpperCase() + groupKey.slice(1)}s` :
                           groupKey}
                        </h3>
                        <Badge variant="secondary">{issues.length} issues</Badge>
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      {issues.map((issue, index) => renderValidationIssue(issue, index))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-3">
              {filteredIssues.map((issue, index) => renderValidationIssue(issue, index))}
            </div>
          )
        ) : (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      No issues found matching the selected filters.
                    </AlertDescription>
                  </Alert>
            )}

            {/* Quick Fix Suggestions */}
            {quickFixes.length > 0 && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-fhir-blue" />
                  <h5 className="font-semibold text-fhir-blue">Quick Fix Suggestions</h5>
                </div>
                <ul className="text-sm text-gray-700 space-y-1 mb-3">
                  {quickFixes.map((fix, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-fhir-blue">•</span>
                      <span>{fix}</span>
                    </li>
                  ))}
                </ul>
                <Button size="sm" className="bg-fhir-blue text-white hover:bg-blue-700">
                  Apply Quick Fixes
                </Button>
              </div>
            )}
          </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
