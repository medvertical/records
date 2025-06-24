import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import ResourceSearch from "@/components/resources/resource-search";
import ResourceList from "@/components/resources/resource-list";
import { Skeleton } from "@/components/ui/skeleton";

interface ResourcesResponse {
  resources: any[];
  total: number;
}

export default function ResourceBrowser() {
  const [resourceType, setResourceType] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState(0);

  const { data: resourceTypes } = useQuery<string[]>({
    queryKey: ["/api/fhir/resource-types"],
  });

  const { data: resourcesData, isLoading } = useQuery<ResourcesResponse>({
    queryKey: ["/api/fhir/resources", { resourceType, search: searchQuery, page }],
    queryFn: ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams();
      
      if (params.resourceType) searchParams.set('resourceType', params.resourceType);
      if (params.search) searchParams.set('search', params.search);
      searchParams.set('page', params.page.toString());
      
      return fetch(`${url}?${searchParams}`).then(res => res.json());
    },
  });

  const handleSearch = (query: string, type: string) => {
    setSearchQuery(query);
    setResourceType(type);
    setPage(0);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div className="flex-1 overflow-hidden">
      <Header 
        title="Browse Resources" 
        subtitle="Search and explore FHIR resources with validation status"
      />
      
      <div className="p-6 h-full overflow-y-auto">
        <div className="space-y-6">
          <ResourceSearch 
            resourceTypes={resourceTypes || []}
            onSearch={handleSearch}
            defaultResourceType={resourceType}
            defaultQuery={searchQuery}
          />
          
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : (
            <ResourceList 
              resources={resourcesData?.resources || []}
              total={resourcesData?.total || 0}
              page={page}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}
