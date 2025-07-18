import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  Loader2
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { CircularProgress } from "@/components/ui/circular-progress";

interface ResourceListProps {
  resources: any[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
}

export default function ResourceList({
  resources,
  total,
  page,
  onPageChange,
  pageSize = 20,
}: ResourceListProps) {
  // Ensure page is a valid number and at least 0
  const currentPage = Math.max(0, isNaN(page) ? 0 : page);
  const validTotal = Math.max(0, isNaN(total) ? 0 : total);
  
  const totalPages = Math.ceil(validTotal / pageSize);
  const startIndex = validTotal > 0 ? currentPage * pageSize + 1 : 0;
  const endIndex = validTotal > 0 ? Math.min((currentPage + 1) * pageSize, validTotal) : 0;

  const getResourceDisplayName = (resource: any) => {
    switch (resource.resourceType) {
      case 'Patient':
        if (resource.name && resource.name[0]) {
          const name = resource.name[0];
          return `${name.given?.[0] || ''} ${name.family || ''}`.trim() || 'Unnamed Patient';
        }
        return 'Unnamed Patient';
      case 'Observation':
        return resource.code?.text || resource.code?.coding?.[0]?.display || 'Observation';
      case 'Encounter':
        return resource.type?.[0]?.text || resource.type?.[0]?.coding?.[0]?.display || 'Encounter';
      case 'Condition':
        return resource.code?.text || resource.code?.coding?.[0]?.display || 'Condition';
      default:
        return `${resource.resourceType} Resource`;
    }
  };

  const getResourceSubtext = (resource: any) => {
    switch (resource.resourceType) {
      case 'Patient':
        const birthDate = resource.birthDate ? new Date(resource.birthDate).toLocaleDateString() : null;
        const gender = resource.gender ? resource.gender.charAt(0).toUpperCase() + resource.gender.slice(1) : null;
        return [birthDate && `DOB: ${birthDate}`, gender].filter(Boolean).join(' | ') || 'Patient';
      case 'Observation':
        const subject = resource.subject?.reference || '';
        const date = resource.effectiveDateTime ? new Date(resource.effectiveDateTime).toLocaleDateString() : '';
        return [subject, date].filter(Boolean).join(' | ') || 'Observation';
      case 'Encounter':
        const encounterDate = resource.period?.start ? new Date(resource.period.start).toLocaleDateString() : '';
        return encounterDate || 'Encounter';
      default:
        return resource.id || 'Resource';
    }
  };

  const getValidationStatus = (resource: any) => {
    // Use real validation results from the database
    const validationSummary = resource._validationSummary;
    
    if (!validationSummary) {
      return 'not-validated';
    }
    
    if (validationSummary.hasErrors) {
      return 'error';
    }
    
    if (validationSummary.hasWarnings) {
      return 'warning';
    }
    
    if (validationSummary.isValid) {
      return 'valid';
    }
    
    return 'not-validated';
  };

  const renderValidationBadge = (resource: any) => {
    const validationSummary = resource._validationSummary;
    const status = getValidationStatus(resource);
    
    // Show loading indicator for resources that need validation
    if (validationSummary?.needsValidation) {
      return (
        <Badge className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Validating...
        </Badge>
      );
    }
    
    switch (status) {
      case 'valid':
        return (
          <div className="flex items-center gap-2">
            <Badge className="bg-green-50 text-fhir-success border-green-200 hover:bg-green-50">
              <CheckCircle className="h-3 w-3 mr-1" />
              Valid
            </Badge>
            <CircularProgress 
              value={validationSummary?.validationScore || 0} 
              size="sm"
            />
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end space-y-1">
              <Badge className="bg-red-50 text-fhir-error border-red-200 hover:bg-red-50">
                <XCircle className="h-3 w-3 mr-1" />
                {validationSummary?.errorCount || 0} Error{(validationSummary?.errorCount || 0) !== 1 ? 's' : ''}
              </Badge>
              {validationSummary?.hasWarnings && (
                <Badge className="bg-orange-50 text-fhir-warning border-orange-200 hover:bg-orange-50 text-xs">
                  {validationSummary.warningCount} Warning{validationSummary.warningCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <CircularProgress 
              value={validationSummary?.validationScore || 0} 
              size="sm"
            />
          </div>
        );
      case 'warning':
        return (
          <div className="flex items-center gap-2">
            <Badge className="bg-orange-50 text-fhir-warning border-orange-200 hover:bg-orange-50">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {validationSummary?.warningCount || 0} Warning{(validationSummary?.warningCount || 0) !== 1 ? 's' : ''}
            </Badge>
            <CircularProgress 
              value={validationSummary?.validationScore || 0} 
              size="sm"
            />
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Not Validated
            </Badge>
            <CircularProgress 
              value={validationSummary?.validationScore || 0} 
              size="sm"
            />
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Results Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {startIndex} to {endIndex} of {validTotal} resources
        </p>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Resource List */}
      <div className="resource-cards-container">
        {resources.length > 0 ? (
          resources.map((resource, index) => {
            const validationStatus = getValidationStatus(resource);
            
            return (
              <div key={resource.id || `${resource.resourceType}-${index}`} className="mb-4 last:mb-0">
                <Link href={`/resources/${resource.id}`}>
                  <Card className="hover:bg-gray-50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
                        <div className={cn(
                          "w-3 h-3 rounded-full flex-shrink-0",
                          validationStatus === 'valid' ? "bg-fhir-success" :
                          validationStatus === 'error' ? "bg-fhir-error" :
                          validationStatus === 'warning' ? "bg-fhir-warning" :
                          "bg-gray-400"
                        )} />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-1">
                            <h3 className="text-sm font-semibold text-gray-900 truncate">
                              {resource.resourceType}/{resource.id}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                              {resource.resourceType}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 truncate">
                            {getResourceDisplayName(resource)}
                          </p>
                          <p className="text-xs text-gray-500 truncate mt-1">
                            {getResourceSubtext(resource)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 ml-6">
                        {renderValidationBadge(resource)}
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </CardContent>
                  </Card>
                </Link>
              </div>
            );
          })
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-gray-400 mb-4">
                <XCircle className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Resources Found</h3>
              <p className="text-gray-600">
                No resources match your current search criteria. Try adjusting your filters.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onPageChange(0)}
            disabled={currentPage === 0}
            className="hidden sm:inline-flex"
          >
            First
          </Button>
          <Button
            variant="outline"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Previous</span>
          </Button>
          
          {/* Page numbers */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = Math.max(0, Math.min(totalPages - 5, page - 2)) + i;
            return (
              <Button
                key={pageNum}
                variant={pageNum === page ? "default" : "outline"}
                onClick={() => onPageChange(pageNum)}
                className={pageNum === page ? "bg-fhir-blue text-white" : ""}
              >
                {pageNum + 1}
              </Button>
            );
          })}
          
          <Button
            variant="outline"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4 sm:ml-1" />
          </Button>
          <Button
            variant="outline"
            onClick={() => onPageChange(totalPages - 1)}
            disabled={currentPage >= totalPages - 1}
            className="hidden sm:inline-flex"
          >
            Last
          </Button>
        </div>
      )}
    </div>
  );
}
