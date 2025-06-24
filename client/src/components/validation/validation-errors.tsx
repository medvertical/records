import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ValidationResult, ValidationError } from "@shared/schema";
import { AlertCircle, CheckCircle, AlertTriangle, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface ValidationErrorsProps {
  validationResults: ValidationResult[];
  resourceData?: any;
}

export default function ValidationErrors({ validationResults, resourceData }: ValidationErrorsProps) {
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

  const hasErrors = allErrors.length > 0;
  const hasWarnings = allWarnings.length > 0;
  const isValid = !hasErrors;

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
      <div className="flex items-start space-x-3">
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
          </div>
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
        ) : isValid && !hasWarnings ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-fhir-success" />
            <AlertDescription className="text-green-800">
              This resource passes all validation checks and conforms to the specified profiles.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {/* Errors */}
            {hasErrors && (
              <div>
                <h4 className="text-lg font-semibold text-fhir-error mb-3">
                  Validation Errors ({allErrors.length})
                </h4>
                <div className="space-y-3">
                  {allErrors.map((error, index) => renderValidationIssue(error, index))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {hasWarnings && (
              <div>
                <h4 className="text-lg font-semibold text-fhir-warning mb-3">
                  Validation Warnings ({allWarnings.length})
                </h4>
                <div className="space-y-3">
                  {allWarnings.map((warning, index) => renderValidationIssue(warning, index))}
                </div>
              </div>
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
      </CardContent>
    </Card>
  );
}
