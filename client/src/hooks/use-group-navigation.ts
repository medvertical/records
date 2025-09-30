import { useCallback } from 'react';
import { useLocation } from 'wouter';

/**
 * Hook for navigating to validation group views with deep-linking support
 * 
 * Provides utilities for:
 * - Navigating to group members view by signature
 * - Navigating to resource detail with aspect/signature context
 * - Building deep-link URLs with query parameters
 */

export interface GroupNavigationOptions {
  signature: string;
  aspect?: string;
  resourceType?: string;
  serverId?: number;
}

export function useGroupNavigation() {
  const [, setLocation] = useLocation();

  /**
   * Navigate to the group members view for a specific validation signature
   * Opens the resource browser in group mode with the signature filter
   */
  const navigateToGroupMembers = useCallback((options: GroupNavigationOptions) => {
    const { signature, aspect, resourceType, serverId } = options;
    
    // Build query parameters
    const params = new URLSearchParams();
    params.set('mode', 'groups');
    params.set('signature', signature);
    
    if (aspect) {
      params.set('aspect', aspect);
    }
    
    if (resourceType) {
      params.set('resourceType', resourceType);
    }
    
    if (serverId !== undefined) {
      params.set('serverId', serverId.toString());
    }
    
    // Navigate to resource browser with group view
    const url = `/resources?${params.toString()}`;
    setLocation(url);
  }, [setLocation]);

  /**
   * Navigate to resource detail with validation context
   * Opens a specific resource with aspect/signature highlighted
   */
  const navigateToResourceDetail = useCallback((
    resourceType: string,
    resourceId: string,
    options?: {
      aspect?: string;
      signature?: string;
      highlightPath?: string;
    }
  ) => {
    // Build query parameters for context
    const params = new URLSearchParams();
    
    if (options?.aspect) {
      params.set('aspect', options.aspect);
    }
    
    if (options?.signature) {
      params.set('signature', options.signature);
    }
    
    if (options?.highlightPath) {
      params.set('path', options.highlightPath);
    }
    
    // Navigate to resource detail
    const queryString = params.toString();
    const url = `/resources/${resourceType}/${resourceId}${queryString ? `?${queryString}` : ''}`;
    setLocation(url);
  }, [setLocation]);

  /**
   * Build a deep-link URL for group members view
   * Useful for copying links or sharing
   */
  const buildGroupMembersUrl = useCallback((options: GroupNavigationOptions): string => {
    const { signature, aspect, resourceType, serverId } = options;
    
    const params = new URLSearchParams();
    params.set('mode', 'groups');
    params.set('signature', signature);
    
    if (aspect) {
      params.set('aspect', aspect);
    }
    
    if (resourceType) {
      params.set('resourceType', resourceType);
    }
    
    if (serverId !== undefined) {
      params.set('serverId', serverId.toString());
    }
    
    return `/resources?${params.toString()}`;
  }, []);

  /**
   * Build a deep-link URL for resource detail with validation context
   */
  const buildResourceDetailUrl = useCallback((
    resourceType: string,
    resourceId: string,
    options?: {
      aspect?: string;
      signature?: string;
      highlightPath?: string;
    }
  ): string => {
    const params = new URLSearchParams();
    
    if (options?.aspect) {
      params.set('aspect', options.aspect);
    }
    
    if (options?.signature) {
      params.set('signature', options.signature);
    }
    
    if (options?.highlightPath) {
      params.set('path', options.highlightPath);
    }
    
    const queryString = params.toString();
    return `/resources/${resourceType}/${resourceId}${queryString ? `?${queryString}` : ''}`;
  }, []);

  /**
   * Parse group navigation parameters from current URL
   */
  const parseGroupParams = useCallback((): {
    mode?: string;
    signature?: string;
    aspect?: string;
    resourceType?: string;
    serverId?: number;
  } | null => {
    if (typeof window === 'undefined') return null;
    
    const params = new URLSearchParams(window.location.search);
    
    return {
      mode: params.get('mode') || undefined,
      signature: params.get('signature') || undefined,
      aspect: params.get('aspect') || undefined,
      resourceType: params.get('resourceType') || undefined,
      serverId: params.get('serverId') ? parseInt(params.get('serverId')!) : undefined,
    };
  }, []);

  /**
   * Parse resource detail validation context from current URL
   */
  const parseResourceDetailParams = useCallback((): {
    aspect?: string;
    signature?: string;
    highlightPath?: string;
  } | null => {
    if (typeof window === 'undefined') return null;
    
    const params = new URLSearchParams(window.location.search);
    
    return {
      aspect: params.get('aspect') || undefined,
      signature: params.get('signature') || undefined,
      highlightPath: params.get('path') || undefined,
    };
  }, []);

  return {
    navigateToGroupMembers,
    navigateToResourceDetail,
    buildGroupMembersUrl,
    buildResourceDetailUrl,
    parseGroupParams,
    parseResourceDetailParams,
  };
}
