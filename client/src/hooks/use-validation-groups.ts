import { useQuery } from '@tanstack/react-query';
import type { FilterOptions, ValidationAspect, ValidationSeverity } from '@/components/filters';

// ============================================================================
// Types
// ============================================================================

export interface ValidationGroup {
  signature: string;
  aspect: ValidationAspect;
  severity: ValidationSeverity;
  code?: string;
  canonicalPath: string;
  sampleMessageText: string;
  totalResources: number;
  totalOccurrences: number;
  firstSeen: string;
  lastSeen: string;
}

export interface ValidationGroupsResponse {
  success: boolean;
  data: ValidationGroup[];
  pagination: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  filters: {
    serverId?: number;
    aspect?: string;
    severity?: string;
    code?: string;
    path?: string;
    resourceType?: string;
  };
  sort: string;
  timestamp: string;
}

// ============================================================================
// Hook
// ============================================================================

interface UseValidationGroupsOptions {
  serverId?: number;
  filters: FilterOptions;
  enabled?: boolean;
  pollingInterval?: number;
}

export function useValidationGroups({
  serverId,
  filters,
  enabled = true,
  pollingInterval = 30000, // 30 seconds default
}: UseValidationGroupsOptions) {
  
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    
    if (serverId) {
      params.append('serverId', serverId.toString());
    }
    
    // Aspect filter (can be multiple)
    if (filters.aspects.length > 0) {
      filters.aspects.forEach(aspect => {
        params.append('aspect', aspect);
      });
    }
    
    // Severity filter (can be multiple)
    if (filters.severities.length > 0) {
      filters.severities.forEach(severity => {
        params.append('severity', severity);
      });
    }
    
    // Code filter
    if (filters.code) {
      params.append('code', filters.code);
    }
    
    // Path filter
    if (filters.path) {
      params.append('path', filters.path);
    }
    
    // Resource type filter
    if (filters.resourceType) {
      params.append('resourceType', filters.resourceType);
    }
    
    // Pagination
    params.append('page', filters.page.toString());
    params.append('size', filters.pageSize.toString());
    
    // Default sort by count descending
    params.append('sort', 'count:desc');
    
    return params.toString();
  };

  const fetchGroups = async (): Promise<ValidationGroupsResponse> => {
    const queryParams = buildQueryParams();
    const url = `/api/validation/issues/groups?${queryParams}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch validation groups: ${response.statusText}`);
    }
    
    return response.json();
  };

  return useQuery({
    queryKey: [
      '/api/validation/issues/groups',
      serverId,
      filters.aspects,
      filters.severities,
      filters.code,
      filters.path,
      filters.resourceType,
      filters.page,
      filters.pageSize,
    ],
    queryFn: fetchGroups,
    enabled,
    refetchInterval: pollingInterval,
    staleTime: 30000, // Consider data stale after 30 seconds
    gcTime: 5 * 60 * 1000, // Cache for 5 minutes (formerly cacheTime)
  });
}

// ============================================================================
// Group Members Hook
// ============================================================================

export interface ValidationGroupMember {
  resourceType: string;
  fhirId: string;
  validatedAt: string;
  perAspect: Array<{
    aspect: ValidationAspect;
    isValid: boolean;
    errorCount: number;
    warningCount: number;
    informationCount: number;
  }>;
}

export interface ValidationGroupMembersResponse {
  success: boolean;
  data: ValidationGroupMember[];
  pagination: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  filters: {
    serverId?: number;
    resourceType?: string;
  };
  sort: string;
  timestamp: string;
}

interface UseValidationGroupMembersOptions {
  signature: string;
  serverId?: number;
  resourceType?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export function useValidationGroupMembers({
  signature,
  serverId,
  resourceType,
  page = 1,
  pageSize = 25,
  enabled = true,
}: UseValidationGroupMembersOptions) {
  
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    
    if (serverId) {
      params.append('serverId', serverId.toString());
    }
    
    if (resourceType) {
      params.append('resourceType', resourceType);
    }
    
    params.append('page', page.toString());
    params.append('size', pageSize.toString());
    params.append('sort', 'validatedAt:desc');
    
    return params.toString();
  };

  const fetchMembers = async (): Promise<ValidationGroupMembersResponse> => {
    const queryParams = buildQueryParams();
    const url = `/api/validation/issues/groups/${encodeURIComponent(signature)}/resources?${queryParams}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch group members: ${response.statusText}`);
    }
    
    return response.json();
  };

  return useQuery({
    queryKey: [
      '/api/validation/issues/groups',
      signature,
      'resources',
      serverId,
      resourceType,
      page,
      pageSize,
    ],
    queryFn: fetchMembers,
    enabled: enabled && !!signature,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });
}
