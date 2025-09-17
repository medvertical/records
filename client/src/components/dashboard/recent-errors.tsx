import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ValidationResult } from "@shared/schema";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

export default function RecentErrors() {
  const queryClient = useQueryClient();
  
  // Listen for validation settings changes to invalidate recent errors cache
  useEffect(() => {
    const handleSSEMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'settings_changed' && data.data?.type === 'validation_settings_updated') {
          console.log('[RecentErrors] Validation settings updated, invalidating recent errors cache');
          // Invalidate recent errors query to refresh with new validation settings
          queryClient.invalidateQueries({ queryKey: ['/api/validation/errors/recent'] });
        }
      } catch (error) {
        // Ignore non-JSON messages
      }
    };

    // Add event listener for SSE messages
    const sse = (window as any).validationSSE;
    if (sse) {
      sse.addEventListener('message', handleSSEMessage);
      return () => sse.removeEventListener('message', handleSSEMessage);
    }
  }, [queryClient]);
  
  const { data: recentErrors, isLoading } = useQuery<ValidationResult[]>({
    queryKey: ["/api/validation/errors/recent"],
  });

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Recent Validation Errors
          </CardTitle>
          <Link href="/validation/errors">
            <Button variant="ghost" className="text-fhir-blue hover:text-blue-700 text-sm font-medium">
              View All
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-gray-300 rounded-full mt-2" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-300 rounded w-3/4" />
                    <div className="h-3 bg-gray-300 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : recentErrors && recentErrors.length > 0 ? (
          <div className="space-y-4">
            {recentErrors.map((error, index) => (
              <div key={error.id || index} className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg border border-red-100">
                <AlertCircle className="w-4 h-4 text-fhir-error mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900">
                      {(error as any).resourceType || 'Resource'} #{error.resourceId}
                    </p>
                    <Badge variant="destructive" className="text-xs">
                      {(error.errorCount || 0) > 0 ? `${error.errorCount} Error${(error.errorCount || 0) > 1 ? 's' : ''}` : 'Error'}
                    </Badge>
                    {(error.warningCount || 0) > 0 && (
                      <Badge variant="outline" className="text-xs text-yellow-600">
                        {error.warningCount} Warning{(error.warningCount || 0) > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-fhir-error leading-relaxed">
                    {(() => {
                      // Parse issues from the validation result
                      try {
                        const issues = typeof error.issues === 'string' ? JSON.parse(error.issues) : error.issues;
                        if (Array.isArray(issues) && issues.length > 0) {
                          const firstError = issues.find(issue => issue.severity === 'error') || issues[0];
                          return firstError.humanReadable || firstError.details || "Validation failed";
                        }
                      } catch (e) {
                        // Fallback to legacy errors format
                        if (Array.isArray(error.errors) && error.errors.length > 0) {
                          return error.errors[0].message || error.errors[0].diagnostics || "Validation failed";
                        }
                      }
                      return "Validation failed";
                    })()}
                  </p>
                  {(() => {
                    // Show location/path if available
                    try {
                      const issues = typeof error.issues === 'string' ? JSON.parse(error.issues) : error.issues;
                      if (Array.isArray(issues) && issues.length > 0) {
                        const firstError = issues.find(issue => issue.severity === 'error') || issues[0];
                        if (firstError.location && Array.isArray(firstError.location) && firstError.location.length > 0) {
                          return (
                            <p className="text-xs text-gray-600 mt-1">
                              Location: {firstError.location[0]}
                            </p>
                          );
                        }
                      }
                    } catch (e) {
                      // Ignore parsing errors
                    }
                    return null;
                  })()}
                  <p className="text-xs text-gray-500 mt-1">
                    {error.validatedAt && formatDistanceToNow(new Date(error.validatedAt), { addSuffix: true })}
                  </p>
                </div>
                <Link href={`/resources/${error.resourceId}`}>
                  <Button variant="ghost" size="sm" className="text-fhir-blue hover:text-blue-700 text-xs">
                    View
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No recent validation errors</p>
            <p className="text-sm text-gray-400">Validation errors will appear here when found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
