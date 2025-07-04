import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ValidationErrors from "@/components/validation/validation-errors";
import ResourceViewer from "@/components/resources/resource-viewer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FhirResourceWithValidation } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function ResourceDetail() {
  const { id } = useParams<{ id: string }>();
  
  const { data: resource, isLoading } = useQuery<FhirResourceWithValidation>({
    queryKey: ["/api/fhir/resources", id],
    queryFn: ({ queryKey }) => {
      const [baseUrl, resourceId] = queryKey;
      return fetch(`${baseUrl}/${resourceId}`).then(res => res.json());
    },
    enabled: !!id,
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
                <Button variant="outline" className="inline-flex items-center space-x-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Resources</span>
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

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="space-y-6">
        {/* Header section with back button and resource info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/resources">
              <Button variant="outline" size="sm" className="inline-flex items-center space-x-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {resource.resourceType} Resource
              </h1>
              <p className="text-gray-600">ID: {resource.resourceId}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {hasValidationResults && (
              <Badge 
                variant={hasErrors ? "destructive" : "secondary"}
                className="flex items-center space-x-1"
              >
                {hasErrors ? (
                  <XCircle className="h-3 w-3" />
                ) : (
                  <CheckCircle className="h-3 w-3" />
                )}
                <span>{hasErrors ? "Has Errors" : "Valid"}</span>
              </Badge>
            )}
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Resource Viewer */}
          <div>
            <ResourceViewer 
              resource={resource} 
              resourceId={resource.resourceId}
              resourceType={resource.resourceType}
            />
          </div>

          {/* Validation Results */}
          <div>
            <ValidationErrors validationResults={resource.validationResults || []} />
          </div>
        </div>
      </div>
    </div>
  );
}