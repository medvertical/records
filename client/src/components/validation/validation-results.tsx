import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  XCircle, 
  AlertCircle, 
  Info, 
  CheckCircle, 
  Lightbulb,
  TrendingUp,
  Target,
  Clock,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ValidationIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code: string;
  details: string;
  diagnostics?: string;
  location: string[];
  expression?: string[];
  humanReadable: string;
  suggestion?: string;
  category: 'structure' | 'cardinality' | 'terminology' | 'business-rule' | 'format';
}

interface ValidationSummary {
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  informationCount: number;
  fatalCount: number;
  score: number;
}

interface DetailedValidationResult {
  isValid: boolean;
  resourceType: string;
  resourceId?: string;
  profileUrl?: string;
  profileName?: string;
  issues: ValidationIssue[];
  summary: ValidationSummary;
  validatedAt: Date;
}

interface ValidationResultsProps {
  result: DetailedValidationResult;
  onRetry?: () => void;
}

export function ValidationResults({ result, onRetry }: ValidationResultsProps) {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'fatal':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'information':
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'fatal':
        return 'bg-red-100 border-red-200 text-red-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'information':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'structure':
        return '🏗️';
      case 'cardinality':
        return '🔢';
      case 'terminology':
        return '📚';
      case 'business-rule':
        return '⚖️';
      case 'format':
        return '📝';
      default:
        return '❓';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const groupedIssues = result.issues.reduce((acc, issue) => {
    if (!acc[issue.category]) {
      acc[issue.category] = [];
    }
    acc[issue.category].push(issue);
    return acc;
  }, {} as Record<string, ValidationIssue[]>);

  return (
    <div className="space-y-6">
      {/* Validation Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {result.isValid ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                Validation Summary
              </CardTitle>
              <CardDescription>
                {result.resourceType} {result.resourceId && `(${result.resourceId})`}
                {result.profileName && ` • Validated against ${result.profileName}`}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className={cn("text-2xl font-bold", getScoreColor(result.summary.score))}>
                {result.summary.score}/100
              </div>
              <div className="text-sm text-muted-foreground">Validation Score</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Validation Quality</span>
                <span className={getScoreColor(result.summary.score)}>
                  {result.summary.score >= 90 ? 'Excellent' : 
                   result.summary.score >= 70 ? 'Good' : 
                   result.summary.score >= 50 ? 'Fair' : 'Needs Improvement'}
                </span>
              </div>
              <Progress 
                value={result.summary.score} 
                className="h-2"
              />
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{result.summary.fatalCount + result.summary.errorCount}</div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{result.summary.warningCount}</div>
                <div className="text-sm text-muted-foreground">Warnings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{result.summary.informationCount}</div>
                <div className="text-sm text-muted-foreground">Info</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{result.summary.totalIssues}</div>
                <div className="text-sm text-muted-foreground">Total Issues</div>
              </div>
            </div>

            {/* Validation Status */}
            {result.isValid ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  This resource passed validation successfully! All required fields are present and the structure follows FHIR standards.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  This resource has validation issues that need to be addressed. Review the errors below to ensure FHIR compliance.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Issues */}
      {result.issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Validation Issues</CardTitle>
            <CardDescription>
              Detailed breakdown of validation problems found in this resource
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="space-y-4">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="all">All ({result.summary.totalIssues})</TabsTrigger>
                <TabsTrigger value="errors">Errors ({result.summary.errorCount + result.summary.fatalCount})</TabsTrigger>
                <TabsTrigger value="warnings">Warnings ({result.summary.warningCount})</TabsTrigger>
                <TabsTrigger value="info">Info ({result.summary.informationCount})</TabsTrigger>
                <TabsTrigger value="category">By Category</TabsTrigger>
                <TabsTrigger value="location">By Location</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4">
                {result.issues.map((issue, index) => (
                  <IssueCard key={index} issue={issue} />
                ))}
              </TabsContent>

              <TabsContent value="errors" className="space-y-4">
                {result.issues
                  .filter(issue => issue.severity === 'error' || issue.severity === 'fatal')
                  .map((issue, index) => (
                    <IssueCard key={index} issue={issue} />
                  ))}
              </TabsContent>

              <TabsContent value="warnings" className="space-y-4">
                {result.issues
                  .filter(issue => issue.severity === 'warning')
                  .map((issue, index) => (
                    <IssueCard key={index} issue={issue} />
                  ))}
              </TabsContent>

              <TabsContent value="info" className="space-y-4">
                {result.issues
                  .filter(issue => issue.severity === 'information')
                  .map((issue, index) => (
                    <IssueCard key={index} issue={issue} />
                  ))}
              </TabsContent>

              <TabsContent value="category" className="space-y-4">
                {Object.entries(groupedIssues).map(([category, issues]) => (
                  <div key={category} className="space-y-2">
                    <h3 className="font-medium flex items-center gap-2">
                      <span>{getCategoryIcon(category)}</span>
                      {category.charAt(0).toUpperCase() + category.slice(1)} Issues ({issues.length})
                    </h3>
                    <div className="space-y-2 ml-6">
                      {issues.map((issue, index) => (
                        <IssueCard key={index} issue={issue} compact />
                      ))}
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="location" className="space-y-4">
                {result.issues
                  .sort((a, b) => a.location.join('.').localeCompare(b.location.join('.')))
                  .map((issue, index) => (
                    <IssueCard key={index} issue={issue} showLocation />
                  ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Validation Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Validation Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Resource Type:</span> {result.resourceType}
            </div>
            <div>
              <span className="font-medium">Validated:</span> {new Date(result.validatedAt).toLocaleString()}
            </div>
            {result.profileUrl && (
              <div className="col-span-full">
                <span className="font-medium">Profile:</span> {result.profileName || result.profileUrl}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface IssueCardProps {
  issue: ValidationIssue;
  compact?: boolean;
  showLocation?: boolean;
}

function IssueCard({ issue, compact = false, showLocation = false }: IssueCardProps) {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'fatal':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'information':
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'fatal':
        return 'bg-red-100 border-red-200 text-red-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'information':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const severityColor = getSeverityColor(issue.severity);
  const icon = getSeverityIcon(issue.severity);

  return (
    <Card className={cn("border-l-4", severityColor)}>
      <CardContent className={cn("pt-4", compact && "py-3")}>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            {icon}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">
                  {issue.severity.toUpperCase()}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {issue.category}
                </Badge>
                {showLocation && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {issue.location.join('.')}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-900">
                {issue.humanReadable}
              </p>
              {!compact && issue.details !== issue.humanReadable && (
                <p className="text-xs text-muted-foreground mt-1">
                  Technical: {issue.details}
                </p>
              )}
            </div>
          </div>

          {!compact && issue.suggestion && (
            <div className="flex items-start gap-2 mt-3 p-2 bg-blue-50 rounded">
              <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                <span className="font-medium">Suggestion:</span> {issue.suggestion}
              </p>
            </div>
          )}

          {!compact && (issue.expression || issue.diagnostics) && (
            <div className="text-xs text-muted-foreground space-y-1">
              {issue.expression && (
                <div>
                  <span className="font-medium">Expression:</span> {issue.expression.join(', ')}
                </div>
              )}
              {issue.diagnostics && (
                <div>
                  <span className="font-medium">Diagnostics:</span> {issue.diagnostics}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}