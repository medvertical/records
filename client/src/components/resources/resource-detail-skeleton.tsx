/**
 * Resource Detail Skeleton Loading Component
 * 
 * Comprehensive skeleton loading state for resource detail views
 */

import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

interface ResourceDetailSkeletonProps {
  className?: string;
}

/**
 * Resource detail page skeleton
 * Matches the layout of the actual resource detail page
 */
export function ResourceDetailSkeleton({ className }: ResourceDetailSkeletonProps) {
  return (
    <div className={`p-6 ${className || ''}`}>
      <div className="space-y-6">
        {/* Header section with resource identifier - matches actual bg-white rounded-lg border p-6 */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-9 w-9 rounded-md" /> {/* Back button */}
              <div>
                <Skeleton className="h-8 w-64 mb-2" /> {/* Resource type/ID title */}
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-40" /> {/* Profile badge */}
                  <Skeleton className="h-6 w-24" /> {/* Version count */}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Skeleton className="h-9 w-20" /> {/* Edit button */}
              <Skeleton className="h-9 w-28" /> {/* Validate button */}
              <Skeleton className="h-9 w-9 rounded-md" /> {/* Delete button */}
            </div>
          </div>
        </div>

        {/* Main content - two columns: Resource Structure (left) and Validation Messages (right) */}
        {/* Matches actual grid-cols-1 lg:grid-cols-[2fr_1fr] */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          {/* Left: Resource Structure */}
          <div>
            <div className="bg-white rounded-lg border p-6">
              <div className="space-y-4">
                {/* Card header */}
                <div className="flex items-center justify-between mb-4">
                  <Skeleton className="h-6 w-40" /> {/* Title: "Resource Structure" */}
                  <Skeleton className="h-9 w-24" /> {/* Edit button */}
                </div>
                
                {/* JSON tree structure skeleton - more realistic spacing */}
                <div className="space-y-1">
                  {Array.from({ length: 15 }, (_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 py-1"
                      style={{ paddingLeft: `${Math.floor(i / 3) * 16}px` }}
                    >
                      <Skeleton className="h-4 w-3" /> {/* Expand icon */}
                      <Skeleton className="h-4" style={{ width: `${100 + (i % 5) * 40}px` }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Right: Validation Messages */}
          <div>
            <div className="bg-white rounded-lg border p-6">
              <div className="space-y-4">
                {/* Card header */}
                <div className="space-y-2 mb-4">
                  <Skeleton className="h-6 w-48" /> {/* Title: "Validation Results" */}
                  <Skeleton className="h-4 w-full" /> {/* Description */}
                </div>
                
                {/* Aspect tabs */}
                <div className="flex gap-1 border-b pb-1 mb-4">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="h-10 w-20" />
                  ))}
                </div>
                
                {/* Validation messages */}
                <div className="space-y-3">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="space-y-2 p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-start gap-2">
                        <Skeleton className="h-4 w-4 rounded flex-shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-4/5" />
                          <Skeleton className="h-3 w-32" /> {/* Path */}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResourceDetailSkeleton;

