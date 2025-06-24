import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, ExternalLink, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

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
          <Select value={selectedResourceType} onValueChange={setSelectedResourceType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Patient">Patient</SelectItem>
              <SelectItem value="Observation">Observation</SelectItem>
              <SelectItem value="Encounter">Encounter</SelectItem>
              <SelectItem value="Condition">Condition</SelectItem>
            </SelectContent>
          </Select>
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
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
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
                        {resource.resourceType}/{resource.id}
                      </p>
                      <p className="text-xs text-gray-500">
                        {resource.resourceType === 'Patient' && resource.name?.[0] 
                          ? `${resource.name[0].given?.[0] || ''} ${resource.name[0].family || ''}`.trim()
                          : `${resource.resourceType} Resource`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-fhir-success/10 text-fhir-success border-fhir-success/20">
                      Valid
                    </Badge>
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
