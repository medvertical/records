import { useCallback } from 'react';
import { useGroupNavigation } from './use-group-navigation';

/**
 * Interface for resource navigation hook return value
 */
export interface UseResourceNavigationReturn {
  handleResourceClick: (resourceType: string, resourceId: string) => void;
  navigateToResourceDetail: (resourceType: string, resourceId: string) => void;
  buildGroupMembersUrl: (groupId: string) => string;
}

/**
 * Custom hook to handle resource navigation
 * Integrates with group navigation for consistent routing behavior
 */
export function useResourceNavigation(): UseResourceNavigationReturn {
  const { navigateToResourceDetail, buildGroupMembersUrl } = useGroupNavigation();

  const handleResourceClick = useCallback((resourceType: string, resourceId: string) => {
    console.log('[ResourceDetail] Resource clicked:', { resourceType, resourceId });
    navigateToResourceDetail(resourceType, resourceId);
  }, [navigateToResourceDetail]);

  return {
    handleResourceClick,
    navigateToResourceDetail,
    buildGroupMembersUrl,
  };
}

