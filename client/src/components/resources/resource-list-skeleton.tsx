/**
 * Resource List Skeleton Loading Component
 * 
 * Modern, reusable skeleton loading states for resource list views
 */

import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";

interface ResourceListItemSkeletonProps {
  className?: string;
}

/**
 * Single resource card skeleton
 * Matches the exact layout of actual resource cards
 */
export function ResourceListItemSkeleton({ className }: ResourceListItemSkeletonProps) {
  return (
    <div className={`p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1 min-w-0">
          {/* Resource type icon skeleton */}
          <div className="flex-shrink-0">
            <Skeleton className="h-3 w-3 rounded-full" />
          </div>
          
          {/* Resource details skeleton */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-1">
              <Skeleton className="h-4 w-32" /> {/* Resource type/ID */}
              <Skeleton className="h-5 w-16 rounded-full" /> {/* Resource type badge */}
            </div>
            <Skeleton className="h-3 w-48 mb-1" /> {/* Resource description */}
            <Skeleton className="h-3 w-24" /> {/* Last updated */}
          </div>
        </div>
        
        {/* Validation status skeleton */}
        <div className="flex items-center space-x-4 ml-6">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-6 w-16 rounded-full" /> {/* Validation badge */}
            <Skeleton className="h-8 w-8 rounded-full" /> {/* Progress circle */}
          </div>
          <Skeleton className="h-4 w-4" /> {/* Chevron icon */}
        </div>
      </div>
    </div>
  );
}

interface ResourceListSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Full resource list skeleton
 * Renders multiple resource card skeletons in a card container
 */
export function ResourceListSkeleton({ count = 20, className }: ResourceListSkeletonProps) {
  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden ${className || ''}`}>
      {Array.from({ length: count }, (_, i) => (
        <ResourceListItemSkeleton key={i} />
      ))}
    </div>
  );
}

export default ResourceListSkeleton;

