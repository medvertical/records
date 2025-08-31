import { useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
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
import { CircularProgress } from "@/components/ui/circular-progress";

export default function ResourceDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  
  // Listen for validation settings changes to invalidate resource cache
  useEffect(() => {
    const handleWebSocketMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'settings_changed' && data.data?.type === 'validation_settings_updated') {
          console.log('[ResourceDetail] Validation settings updated, invalidating resource cache');
          // Invalidate resource queries to refresh with new validation settings
          queryClient.invalidateQueries({ queryKey: ['/api/fhir/resources', id] });
        }
      } catch (error) {
        // Ignore non-JSON messages
      }
    };

    // Add event listener for WebSocket messages
    const ws = (window as any).validationWebSocket;
    if (ws) {
      ws.addEventListener('message', handleWebSocketMessage);
      return () => ws.removeEventListener('message', handleWebSocketMessage);
    }
  }, [queryClient, id]);
  
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
  
  // Calculate validation summary from filtered validation results
  const validationSummary = hasValidationResults ? (() => {
    // Use the filtered validation results from the server
    const latestResult = resource.validationResults[0]; // Server already filters to latest result
    const filteredIssues = latestResult.issues || [];
    
    // Calculate counts from filtered issues
    const errorCount = filteredIssues.filter(issue => 
      issue.severity === 'error' || issue.severity === 'fatal'
    ).length;
    const warningCount = filteredIssues.filter(issue => 
      issue.severity === 'warning'
    ).length;
    const informationCount = filteredIssues.filter(issue => 
      issue.severity === 'information'
    ).length;
    
    // Calculate score from filtered issues
    let calculatedScore = 100;
    filteredIssues.forEach(issue => {
      if (issue.severity === 'error' || issue.severity === 'fatal') {
        calculatedScore -= 10;
      } else if (issue.severity === 'warning') {
        calculatedScore -= 2;
      } else if (issue.severity === 'information') {
        calculatedScore -= 0.5;
      }
    });
    calculatedScore = Math.max(0, Math.round(calculatedScore));
    
    return {
      totalIssues: filteredIssues.length,
      errorCount,
      warningCount,
      informationCount,
      score: calculatedScore,
      isValid: errorCount === 0
    };
  })() : null;

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="space-y-6">
        {/* Header section with validation summary */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
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
            {validationSummary && (
              <CircularProgress 
                value={validationSummary.score} 
                size="lg"
                showValue={true}
              />
            )}
          </div>
        </div>

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