import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, ExternalLink, ChevronRight, CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getShortId } from "@/lib/resource-utils";

interface QuickBrowserProps {
  resourceCounts?: Record<string, number>;
}

interface ResourcesResponse {
  resources: any[];
  total: number;
}

export default function QuickBrowser({ resourceCounts }: QuickBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResourceType, setSelectedResourceType] = useState("");

  const { data: resourcesData, isLoading } = useQuery<ResourcesResponse>({
    queryKey: ["/api/fhir/resources", { search: searchQuery, resourceType: selectedResourceType, page: 0 }],
    queryFn: ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams();
      
      if (params.search) searchParams.set('search', params.search);
      if (params.resourceType) searchParams.set('resourceType', params.resourceType);
      searchParams.set('page', '0');
      searchParams.set('_count', '5'); // Limit for quick browser
      
      return fetch(`${url}?${searchParams}`).then(res => res.json());
    },
    enabled: false, // Only fetch when user searches
  });

  const handleSearch = () => {
    if (searchQuery.trim() || selectedResourceType) {
      // Convert "all" back to empty string for the API
      const resourceType = selectedResourceType === "all" ? "" : selectedResourceType;
      // This will trigger the query through the effect
      setSearchQuery(searchQuery);
      setSelectedResourceType(resourceType);
    }
  };

  const resources = resourcesData?.resources || [];

  const renderValidationBadge = (resource: any) => {
    const validationSummary = resource._validationSummary;
    
    if (!validationSummary) {
      return (
        <Badge variant="secondary" className="text-xs">
          Not Validated
        </Badge>
      );
    }
    
    if (validationSummary.hasErrors) {
      return (
        <div className="flex items-center gap-2">
          {/* Error column */}
          <div className="flex flex-col items-center min-w-[3rem]">
            <Badge className="bg-red-50 text-fhir-error border-red-200 hover:bg-red-50 text-xs">
              <XCircle className="h-3 w-3 mr-1" />
              {validationSummary.errorCount}
            </Badge>
          </div>
          
          {/* Warning column */}
          <div className="flex flex-col items-center min-w-[3rem]">
            {validationSummary.hasWarnings && (
              <Badge className="bg-orange-50 text-fhir-warning border-orange-200 hover:bg-orange-50 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {validationSummary.warningCount}
              </Badge>
            )}
          </div>
          
          {/* Info column */}
          <div className="flex flex-col items-center min-w-[3rem]">
            {validationSummary.informationCount > 0 && (
              <Badge className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50 text-xs">
                <Info className="h-3 w-3 mr-1" />
                {validationSummary.informationCount}
              </Badge>
            )}
          </div>
        </div>
      );
    }
    
    if (validationSummary.hasWarnings) {
      return (
        <div className="flex items-center gap-2">
          {/* Error column - empty placeholder for alignment */}
          <div className="flex flex-col items-center min-w-[3rem]">
          </div>
          
          {/* Warning column */}
          <div className="flex flex-col items-center min-w-[3rem]">
            <Badge className="bg-orange-50 text-fhir-warning border-orange-200 hover:bg-orange-50 text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {validationSummary.warningCount}
            </Badge>
          </div>
          
          {/* Info column */}
          <div className="flex flex-col items-center min-w-[3rem]">
            {validationSummary.informationCount > 0 && (
              <Badge className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50 text-xs">
                <Info className="h-3 w-3 mr-1" />
                {validationSummary.informationCount}
              </Badge>
            )}
          </div>
        </div>
      );
    }
    
    if (validationSummary.informationCount > 0) {
      return (
        <div className="flex items-center gap-2">
          {/* Error column - empty placeholder for alignment */}
          <div className="flex flex-col items-center min-w-[3rem]">
          </div>
          
          {/* Warning column - empty placeholder for alignment */}
          <div className="flex flex-col items-center min-w-[3rem]">
          </div>
          
          {/* Info column */}
          <div className="flex flex-col items-center min-w-[3rem]">
            <Badge className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50 text-xs">
              <Info className="h-3 w-3 mr-1" />
              {validationSummary.informationCount}
            </Badge>
          </div>
        </div>
      );
    }
    
    if (validationSummary.isValid) {
      return (
        <Badge className="bg-green-50 text-fhir-success border-green-200 hover:bg-green-50 text-xs">
          <CheckCircle className="h-3 w-3 mr-1" />
          Valid
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary" className="text-xs">
        Not Validated
      </Badge>
    );
  };

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Quick Resource Browser
          </CardTitle>
          <Link href="/resources">
            <Button variant="ghost" className="text-fhir-blue hover:text-blue-700 text-sm font-medium">
              <ExternalLink className="h-4 w-4 mr-1" />
              Open Full Browser
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search and Filter */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} size="sm">
            Search
          </Button>
        </div>

        {/* Resource Counts */}
        {resourceCounts && Object.keys(resourceCounts).length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {Object.entries(resourceCounts).map(([type, count]) => (
              <Link key={type} href={`/resources?type=${type}`}>
                <div className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{type}</span>
                    <Badge variant="secondary" className="text-xs">
                      {count.toLocaleString()}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Resource List */}
        <div className="space-y-4 max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-gray-300 rounded-full" />
                      <div className="space-y-1">
                        <div className="h-4 bg-gray-300 rounded w-32" />
                        <div className="h-3 bg-gray-300 rounded w-24" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : resources.length > 0 ? (
            resources.map((resource, index) => (
              <Link key={resource.id || index} href={`/resources/${resource.id}`}>
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-fhir-success rounded-full" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {resource.resourceType}/{getShortId(resource.id)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {resource.resourceType === 'Patient' && resource.name?.[0] 
                          ? `${resource.name[0].given?.[0] || ''} ${resource.name[0].family || ''}`.trim()
                          : `${resource.resourceType} Resource`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {renderValidationBadge(resource)}
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </Link>
            ))
          ) : searchQuery || selectedResourceType ? (
            <div className="text-center py-4">
              <p className="text-gray-500">No resources found</p>
              <p className="text-sm text-gray-400">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500">Use search to find resources</p>
              <p className="text-sm text-gray-400">Enter a search term or select a resource type</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
