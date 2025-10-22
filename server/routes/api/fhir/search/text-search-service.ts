import type { FhirClient } from "../../../../services/fhir/fhir-client";
import { enhanceResourcesWithValidationData } from "../helpers/resource-enhancer";

/**
 * Resource-specific search parameter mappings
 * Maps FHIR resource types to their commonly searchable fields
 */
const RESOURCE_SEARCH_PARAMS: Record<string, string[]> = {
  'Patient': ['name', 'family', 'given', 'identifier', 'birthdate'],
  'Practitioner': ['name', 'family', 'given', 'identifier'],
  'Organization': ['name', 'identifier'],
  'Observation': ['code', 'value-string', 'value-quantity'],
  'Medication': ['name', 'code'],
  'Condition': ['code', 'clinical-status'],
  'DiagnosticReport': ['code', 'status'],
  'Encounter': ['status', 'class', 'type'],
  'Procedure': ['code', 'status'],
  'AllergyIntolerance': ['code', 'clinical-status'],
  'Immunization': ['vaccine-code', 'status'],
  'DocumentReference': ['type', 'status'],
  'Location': ['name', 'address'],
  'Appointment': ['status', 'service-type']
};

/**
 * Filter options for FHIR text search
 */
export interface TextSearchFilterOptions {
  pagination: {
    limit: number;
    offset: number;
  };
  fhirSort?: string;
}

/**
 * Result of FHIR text search operation
 */
export interface TextSearchResult {
  resources: any[];
  totalCount: number;
  returnedCount: number;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  filterSummary?: {
    resourceTypes: string[];
    validationStatus: {
      hasErrors: number;
      hasWarnings: number;
      hasInformation: number;
      isValid: number;
    };
    totalMatching: number;
  };
  appliedFilters?: any;
  searchMethod: string;
  error?: {
    type: string;
    message: string;
    details?: string;
    operationOutcome?: any;
  };
}

/**
 * Perform FHIR text search with fallback strategies
 * Tries multiple search approaches: _content, _text, field-specific, and generic
 */
export async function performFhirTextSearch(
  fhirClient: FhirClient,
  resourceTypes: string[],
  searchTerm: string,
  filterOptions: TextSearchFilterOptions
): Promise<TextSearchResult> {
  console.log(`[FHIR Text Search] Searching for "${searchTerm}" in ${resourceTypes.length} resource types`);
  console.log(`[FHIR Text Search] Pagination: offset=${filterOptions.pagination.offset}, limit=${filterOptions.pagination.limit}`);
  
  const allResults: any[] = [];
  let totalAvailableCount = 0;
  let searchMethod = 'none';
  const bundleMetadata: { total?: number; hasNext?: boolean }[] = [];
  
  // Calculate how many results to fetch from FHIR server
  const offset = filterOptions.pagination.offset || 0;
  const limit = filterOptions.pagination.limit || 50;
  const fetchCount = limit;
  
  for (const resourceType of resourceTypes) {
    try {
      let searchSuccessful = false;
      const resourceResults: any[] = [];
      let bundle: any = null;
      
      // Strategy 1: Try _content search parameter (searches narrative and text)
      const contentResult = await tryContentSearch(fhirClient, resourceType, searchTerm, fetchCount, offset, filterOptions.fhirSort);
      if (contentResult.success) {
        resourceResults.push(...contentResult.resources);
        bundle = contentResult.bundle;
        searchMethod = '_content';
        searchSuccessful = true;
        console.log(`[FHIR Text Search] _content search found ${contentResult.resources.length} results for ${resourceType}`);
      } else if (contentResult.error) {
        // Check for unsupported parameter error
        return createErrorResult(contentResult.error, filterOptions);
      }
      
      // Strategy 2: Try _text search parameter (full-text search)
      if (!searchSuccessful) {
        const textResult = await tryTextSearch(fhirClient, resourceType, searchTerm, fetchCount, offset, filterOptions.fhirSort);
        if (textResult.success) {
          resourceResults.push(...textResult.resources);
          bundle = textResult.bundle;
          searchMethod = '_text';
          searchSuccessful = true;
          console.log(`[FHIR Text Search] _text search found ${textResult.resources.length} results for ${resourceType}`);
        } else if (textResult.error) {
          return createErrorResult(textResult.error, filterOptions);
        }
      }
      
      // Strategy 3: Resource-specific field searches
      if (!searchSuccessful && RESOURCE_SEARCH_PARAMS[resourceType]) {
        const fieldResult = await tryFieldSearch(fhirClient, resourceType, searchTerm, fetchCount, filterOptions.fhirSort);
        if (fieldResult.success) {
          resourceResults.push(...fieldResult.resources);
          bundle = fieldResult.bundle;
          searchMethod = `field:${fieldResult.field}`;
          searchSuccessful = true;
          console.log(`[FHIR Text Search] Field search (${fieldResult.field}) found ${fieldResult.resources.length} results for ${resourceType}`);
        }
      }
      
      // Strategy 4: Generic search with contains modifier
      if (!searchSuccessful) {
        const genericResult = await tryGenericSearch(fhirClient, resourceType, searchTerm, fetchCount, filterOptions.fhirSort);
        if (genericResult.success) {
          resourceResults.push(...genericResult.resources);
          bundle = genericResult.bundle;
          searchMethod = 'generic:name';
          searchSuccessful = true;
          console.log(`[FHIR Text Search] Generic name search found ${genericResult.resources.length} results for ${resourceType}`);
        }
      }
      
      if (searchSuccessful && bundle) {
        allResults.push(...resourceResults);
        
        // Extract metadata from bundle
        const metadata: { total?: number; hasNext?: boolean } = {};
        if (bundle.total !== undefined && bundle.total > 0) {
          metadata.total = bundle.total;
          totalAvailableCount += bundle.total;
        } else if (resourceResults.length > 0) {
          console.log(`[FHIR Text Search] WARNING: Bundle total is ${bundle.total} but got ${resourceResults.length} results`);
          metadata.total = resourceResults.length;
          totalAvailableCount += resourceResults.length;
        }
        
        // Check for next link in bundle
        if (bundle.link) {
          const nextLink = bundle.link.find((l: any) => l.relation === 'next');
          metadata.hasNext = !!nextLink;
        }
        bundleMetadata.push(metadata);
        
        console.log(`[FHIR Text Search] Bundle metadata for ${resourceType}:`, metadata);
      } else {
        console.log(`[FHIR Text Search] No search strategy worked for ${resourceType}`);
      }
      
    } catch (error: any) {
      console.error(`[FHIR Text Search] Error searching ${resourceType}:`, error);
    }
  }
  
  // Remove duplicates based on resource id and type
  const uniqueResults = allResults.filter((resource, index, self) => 
    index === self.findIndex(r => r.id === resource.id && r.resourceType === resource.resourceType)
  );
  
  console.log(`[FHIR Text Search] Total unique results fetched: ${uniqueResults.length} (method: ${searchMethod})`);
  
  // Enhance resources with validation data
  const enhancedResources = await enhanceResourcesWithValidationData(uniqueResults);
  
  // Apply pagination
  const paginatedResources = enhancedResources.slice(0, limit);
  
  // Calculate hasMore
  const hasMoreFromFetch = enhancedResources.length > limit;
  const hasMoreFromBundles = bundleMetadata.some(m => m.hasNext || (m.total && m.total > fetchCount));
  const hasMore = hasMoreFromFetch || hasMoreFromBundles;
  
  const finalTotalCount = totalAvailableCount > 0 ? totalAvailableCount : enhancedResources.length;
  
  console.log(`[FHIR Text Search] Result: total=${finalTotalCount}, returned=${paginatedResources.length}, hasMore=${hasMore}`);
  
  return {
    resources: paginatedResources,
    totalCount: finalTotalCount,
    returnedCount: paginatedResources.length,
    pagination: {
      limit: limit,
      offset: 0,
      hasMore: hasMore
    },
    filterSummary: {
      resourceTypes: resourceTypes,
      validationStatus: {
        hasErrors: paginatedResources.filter(r => r._validationSummary?.hasErrors).length,
        hasWarnings: paginatedResources.filter(r => r._validationSummary?.hasWarnings).length,
        hasInformation: 0,
        isValid: paginatedResources.filter(r => r._validationSummary?.isValid).length
      },
      totalMatching: finalTotalCount
    },
    appliedFilters: filterOptions,
    searchMethod: searchMethod
  };
}

/**
 * Try _content search parameter
 */
async function tryContentSearch(
  fhirClient: FhirClient,
  resourceType: string,
  searchTerm: string,
  fetchCount: number,
  offset: number,
  fhirSort?: string
): Promise<{ success: boolean; resources: any[]; bundle?: any; error?: any }> {
  try {
    console.log(`[FHIR Text Search] Trying _content search for ${resourceType}`);
    const searchParams: any = {
      '_content': searchTerm,
      '_count': fetchCount
    };
    
    if (offset > 0) {
      searchParams._skip = offset;
    }
    
    if (fhirSort) {
      searchParams._sort = fhirSort;
    }
    
    const bundle = await fhirClient.searchResources(resourceType, searchParams);
    
    if (bundle.entry && bundle.entry.length > 0) {
      return {
        success: true,
        resources: bundle.entry.map((e: any) => e.resource),
        bundle
      };
    }
    
    console.log(`[FHIR Text Search] _content search returned 0 results for ${resourceType}`);
    return { success: false, resources: [] };
  } catch (error: any) {
    console.log(`[FHIR Text Search] _content search failed for ${resourceType}:`, error.message);
    
    if (error.outcomeDetails?.isUnsupportedParam || 
        (error.message && (error.message.includes('not supported') || error.message.includes('not enabled')))) {
      return {
        success: false,
        resources: [],
        error: {
          type: 'unsupported_parameter',
          message: error.outcomeDetails?.message || 'FHIR server does not support full-text search (_content parameter)',
          details: error.message,
          operationOutcome: error.operationOutcome
        }
      };
    }
    
    return { success: false, resources: [] };
  }
}

/**
 * Try _text search parameter
 */
async function tryTextSearch(
  fhirClient: FhirClient,
  resourceType: string,
  searchTerm: string,
  fetchCount: number,
  offset: number,
  fhirSort?: string
): Promise<{ success: boolean; resources: any[]; bundle?: any; error?: any }> {
  try {
    console.log(`[FHIR Text Search] Trying _text search for ${resourceType}`);
    const searchParams: any = {
      '_text': searchTerm,
      '_count': fetchCount
    };
    
    if (offset > 0) {
      searchParams._skip = offset;
    }
    
    if (fhirSort) {
      searchParams._sort = fhirSort;
    }
    
    const bundle = await fhirClient.searchResources(resourceType, searchParams);
    
    if (bundle.entry && bundle.entry.length > 0) {
      return {
        success: true,
        resources: bundle.entry.map((e: any) => e.resource),
        bundle
      };
    }
    
    return { success: false, resources: [] };
  } catch (error: any) {
    console.log(`[FHIR Text Search] _text search failed for ${resourceType}:`, error.message);
    
    if (error.outcomeDetails?.isUnsupportedParam ||
        (error.message && (error.message.includes('not supported') || error.message.includes('not enabled')))) {
      return {
        success: false,
        resources: [],
        error: {
          type: 'unsupported_parameter',
          message: error.outcomeDetails?.message || 'FHIR server does not support full-text search (_text parameter)',
          details: error.message,
          operationOutcome: error.operationOutcome
        }
      };
    }
    
    return { success: false, resources: [] };
  }
}

/**
 * Try resource-specific field searches
 */
async function tryFieldSearch(
  fhirClient: FhirClient,
  resourceType: string,
  searchTerm: string,
  fetchCount: number,
  fhirSort?: string
): Promise<{ success: boolean; resources: any[]; bundle?: any; field?: string }> {
  console.log(`[FHIR Text Search] Trying resource-specific field searches for ${resourceType}`);
  
  const searchFields = RESOURCE_SEARCH_PARAMS[resourceType];
  for (const field of searchFields) {
    try {
      const fieldSearchParams: any = {
        [field]: searchTerm,
        '_count': fetchCount
      };
      
      if (fhirSort) {
        fieldSearchParams._sort = fhirSort;
      }
      
      const bundle = await fhirClient.searchResources(resourceType, fieldSearchParams);
      
      if (bundle.entry && bundle.entry.length > 0) {
        return {
          success: true,
          resources: bundle.entry.map((e: any) => e.resource),
          bundle,
          field
        };
      }
    } catch (error: any) {
      console.log(`[FHIR Text Search] Field search (${field}) failed for ${resourceType}:`, error.message);
    }
  }
  
  return { success: false, resources: [] };
}

/**
 * Try generic name search
 */
async function tryGenericSearch(
  fhirClient: FhirClient,
  resourceType: string,
  searchTerm: string,
  fetchCount: number,
  fhirSort?: string
): Promise<{ success: boolean; resources: any[]; bundle?: any }> {
  console.log(`[FHIR Text Search] Trying generic contains search for ${resourceType}`);
  
  try {
    const genericSearchParams: any = {
      'name': searchTerm,
      '_count': fetchCount
    };
    
    if (fhirSort) {
      genericSearchParams._sort = fhirSort;
    }
    
    const bundle = await fhirClient.searchResources(resourceType, genericSearchParams);
    
    if (bundle.entry && bundle.entry.length > 0) {
      return {
        success: true,
        resources: bundle.entry.map((e: any) => e.resource),
        bundle
      };
    }
    
    return { success: false, resources: [] };
  } catch (error: any) {
    console.log(`[FHIR Text Search] Generic search failed for ${resourceType}:`, error.message);
    return { success: false, resources: [] };
  }
}

/**
 * Create error result
 */
function createErrorResult(error: any, filterOptions: TextSearchFilterOptions): TextSearchResult {
  return {
    resources: [],
    totalCount: 0,
    returnedCount: 0,
    pagination: {
      limit: filterOptions.pagination.limit,
      offset: filterOptions.pagination.offset,
      hasMore: false
    },
    searchMethod: 'none',
    error
  };
}

