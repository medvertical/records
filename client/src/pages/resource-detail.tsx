import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ValidationErrors from "@/components/validation/validation-errors";
import ResourceViewer from "@/components/resources/resource-viewer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FhirResourceWithValidation } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, ArrowLeft, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Link } from "wouter";
import { Progress } from "@/components/ui/progress";

export default function ResourceDetail() {
  const { id } = useParams<{ id: string }>();
  
  const { data: resource, isLoading, error } = useQuery<FhirResourceWithValidation>({
    queryKey: ["/api/fhir/resources", id],
    queryFn: async ({ queryKey }) => {
      const [baseUrl, resourceId] = queryKey;
      console.log('Fetching resource with ID:', resourceId);
      const response = await fetch(`${baseUrl}/${resourceId}`);
      if (!response.ok) {
        console.error('Resource fetch failed:', response.status, response.statusText);
        throw new Error(`Failed to fetch resource: ${response.status}`);
      }
      const data = await response.json();
      console.log('Resource fetched successfully:', data);
      return data;
    },
    enabled: !!id,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 h-full overflow-y-auto">
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="p-6 h-full overflow-y-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Resource Not Found</h3>
              <p className="text-gray-600 mb-4">
                The requested resource could not be found or has been removed.
              </p>
              <Link href="/resources">
                <Button variant="outline" className="inline-flex items-center">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasValidationResults = resource.validationResults && resource.validationResults.length > 0;
  const hasErrors = hasValidationResults && resource.validationResults?.some(r => !r.isValid);
  
  // Calculate validation summary
  const validationSummary = hasValidationResults ? {
    totalIssues: resource.validationResults.reduce((sum, vr) => sum + (vr.issues?.length || 0), 0),
    errorCount: resource.validationResults.reduce((sum, vr) => sum + (vr.errorCount || 0), 0),
    warningCount: resource.validationResults.reduce((sum, vr) => sum + (vr.warningCount || 0), 0),
    informationCount: resource.validationResults.reduce((sum, vr) => sum + (vr.issues?.filter(i => i.severity === 'information').length || 0), 0),
    score: resource.validationResults.length > 0 ? Math.round(resource.validationResults[0].validationScore || 0) : 0
  } : null;

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="space-y-6">
        {/* Header section with validation summary */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <Link href="/resources">
                  <Button variant="outline" size="sm" className="inline-flex items-center">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {resource.resourceType} Resource
                  </h1>
                  <p className="text-gray-600">ID: {resource.resourceId}</p>
                </div>
              </div>
            </div>
            
            {/* Validation Summary */}
            {validationSummary && (
              <div className="space-y-4">
                {/* Score Progress Bar */}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Validation Score</span>
                      <span className="text-lg font-bold">{validationSummary.score}%</span>
                    </div>
                    <Progress value={validationSummary.score} className="h-2" />
                  </div>
                </div>
                
                {/* Issue Summary */}
                <div className="flex items-center gap-4">
                  {validationSummary.errorCount > 0 && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationSummary.errorCount} Error{validationSummary.errorCount !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  {validationSummary.warningCount > 0 && (
                    <Badge className="bg-orange-100 text-orange-800 border-orange-200 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {validationSummary.warningCount} Warning{validationSummary.warningCount !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  {validationSummary.informationCount > 0 && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      {validationSummary.informationCount} Info
                    </Badge>
                  )}
                  {validationSummary.totalIssues === 0 && (
                    <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Valid
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main content - single column with integrated validation */}
        <div>
          <ResourceViewer 
            resource={resource} 
            resourceId={resource.resourceId}
            resourceType={resource.resourceType}
          />
        </div>
      </div>
    </div>
  );
}