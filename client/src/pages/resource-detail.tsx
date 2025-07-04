import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import ValidationErrors from "@/components/validation/validation-errors";
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
      <div className="flex-1 overflow-hidden">
        <Header title="Records" />
        <div className="p-6 space-y-6">
          <Skeleton className="h-20 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-96 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="flex-1 overflow-hidden">
        <Header title="Records" />
        <div className="p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Resource Not Found</h3>
                <p className="text-gray-600 mb-4">The resource with ID {id} could not be found.</p>
                <Link href="/resources">
                  <Button>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Resources
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const hasValidation = resource.validationResults && resource.validationResults.length > 0;
  const hasErrors = hasValidation && resource.validationResults?.some(r => !r.isValid);
  const errorCount = hasValidation 
    ? resource.validationResults?.filter(r => !r.isValid).reduce((acc, r) => acc + (r.errors as any[])?.length || 0, 0) || 0
    : 0;

  return (
    <div className="flex-1 overflow-hidden">
      <Header 
        title="Records"
      />
      
      <div className="p-6 overflow-y-auto h-full">
        {/* Resource Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">{resource.resourceType}/{resource.resourceId}</CardTitle>
                <p className="text-gray-600 mt-1">Resource Details & Validation Results</p>
              </div>
              <div className="flex items-center space-x-3">
                {hasValidation ? (
                  <Badge variant={hasErrors ? "destructive" : "default"} className="flex items-center space-x-1">
                    {hasErrors ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <span>
                      {hasErrors ? `${errorCount} Validation Errors` : "Valid"}
                    </span>
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not Validated</Badge>
                )}
                <Link href="/resources">
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Resource JSON Structure */}
          <Card>
            <CardHeader>
              <CardTitle>Resource Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm overflow-auto max-h-96">
                <pre className="text-gray-800 whitespace-pre-wrap">
                  {JSON.stringify(resource.data, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Validation Results */}
          <ValidationErrors 
            validationResults={resource.validationResults || []}
            resourceData={resource.data}
          />
        </div>
      </div>
    </div>
  );
}
