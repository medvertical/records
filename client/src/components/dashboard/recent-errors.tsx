import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { ValidationResult } from "@shared/schema";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

export default function RecentErrors() {
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
                <div className="w-2 h-2 bg-fhir-error rounded-full mt-2" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    Resource ID: {error.resourceId}
                  </p>
                  <p className="text-sm text-fhir-error">
                    {Array.isArray(error.errors) && error.errors.length > 0 
                      ? error.errors[0].message || "Validation error"
                      : "Validation error"}
                  </p>
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
