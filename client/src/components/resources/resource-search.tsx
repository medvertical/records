import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter } from "lucide-react";

interface ResourceSearchProps {
  resourceTypes: string[];
  onSearch: (query: string, resourceType: string) => void;
  defaultQuery?: string;
  defaultResourceType?: string;
}

export default function ResourceSearch({
  resourceTypes,
  onSearch,
  defaultQuery = "",
  defaultResourceType = "",
}: ResourceSearchProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [resourceType, setResourceType] = useState(defaultResourceType);

  useEffect(() => {
    setQuery(defaultQuery);
    setResourceType(defaultResourceType);
  }, [defaultQuery, defaultResourceType]);

  const handleSearch = () => {
    // Convert "all" back to empty string for the API
    const searchResourceType = resourceType === "all" ? "" : resourceType;
    onSearch(query, searchResourceType);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search resources by ID, name, or content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyPress}
            className="pl-10"
          />
        </div>
        
        <Select value={resourceType} onValueChange={setResourceType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Resource Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resource Types</SelectItem>
            {resourceTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleSearch} className="bg-fhir-blue text-white hover:bg-blue-700">
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
        
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </div>
      
      {(query || resourceType) && (
        <div className="mt-4 flex items-center space-x-2">
          <span className="text-sm text-gray-600">Active filters:</span>
          {query && (
            <span className="bg-blue-50 text-fhir-blue px-2 py-1 rounded-md text-sm">
              Query: "{query}"
            </span>
          )}
          {resourceType && (
            <span className="bg-blue-50 text-fhir-blue px-2 py-1 rounded-md text-sm">
              Type: {resourceType}
            </span>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setQuery("");
              setResourceType("all");
              onSearch("", "");
            }}
            className="text-xs"
          >
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
}
