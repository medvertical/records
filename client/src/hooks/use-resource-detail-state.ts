import { useState, useCallback } from 'react';

/**
 * Interface for resource detail state management
 */
export interface ResourceDetailState {
  // Revalidation state
  isRevalidating: boolean;
  setIsRevalidating: (value: boolean) => void;
  revalidationTimers: number[];
  setRevalidationTimers: (value: number[]) => void;
  
  // Edit mode state
  isEditMode: boolean;
  setIsEditMode: (value: boolean) => void;
  editedResource: any | null;
  setEditedResource: (value: any | null) => void;
  autoRevalidate: boolean;
  setAutoRevalidate: (value: boolean) => void;
  hasChanges: boolean;
  setHasChanges: (value: boolean) => void;
  
  // Path highlighting state
  highlightedPath: string | undefined;
  setHighlightedPath: (value: string | undefined) => void;
  
  // Message highlighting state
  highlightedMessageSignatures: string[];
  setHighlightedMessageSignatures: (value: string[]) => void;
  
  // Expanded paths management
  getExpandedPaths: (resourceId: string) => Set<string>;
  setExpandedPaths: (resourceId: string, expandedPaths: Set<string>) => void;
}

/**
 * Custom hook to manage all state for resource detail page
 * Extracts state management from the main component for better organization
 */
export function useResourceDetailState(): ResourceDetailState {
  // Revalidation state
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [revalidationTimers, setRevalidationTimers] = useState<number[]>([]);
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedResource, setEditedResource] = useState<any>(null);
  const [autoRevalidate, setAutoRevalidate] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Path highlighting state
  const [highlightedPath, setHighlightedPath] = useState<string | undefined>(undefined);
  
  // Message highlighting state for tree → messages navigation
  const [highlightedMessageSignatures, setHighlightedMessageSignatures] = useState<string[]>([]);
  
  // Per-resource expanded paths state - keyed by resourceId
  const [expandedPathsMap, setExpandedPathsMap] = useState<Map<string, Set<string>>>(new Map());
  
  // Get expanded paths for current resource
  const getExpandedPaths = useCallback((resourceId: string) => {
    return expandedPathsMap.get(resourceId) || new Set<string>();
  }, [expandedPathsMap]);
  
  // Set expanded paths for current resource
  const setExpandedPaths = useCallback((resourceId: string, expandedPaths: Set<string>) => {
    setExpandedPathsMap(prev => {
      const currentPaths = prev.get(resourceId);
      
      // Check if the paths have actually changed
      if (currentPaths) {
        // Early return if sizes differ
        if (currentPaths.size === expandedPaths.size) {
          const allSame = Array.from(expandedPaths).every(path => currentPaths.has(path));
          if (allSame) {
            // No change, don't update state
            return prev;
          }
        }
      }
      
      // Only log when actually updating (helps debug render loops)
      if (process.env.NODE_ENV === 'development') {
        console.log('[ResourceDetail] setExpandedPaths - paths changed:', {
          resourceId,
          pathCount: expandedPaths.size,
          paths: Array.from(expandedPaths)
        });
      }
      
      const newMap = new Map(prev);
      newMap.set(resourceId, expandedPaths);
      return newMap;
    });
  }, []);
  
  return {
    isRevalidating,
    setIsRevalidating,
    revalidationTimers,
    setRevalidationTimers,
    isEditMode,
    setIsEditMode,
    editedResource,
    setEditedResource,
    autoRevalidate,
    setAutoRevalidate,
    hasChanges,
    setHasChanges,
    highlightedPath,
    setHighlightedPath,
    highlightedMessageSignatures,
    setHighlightedMessageSignatures,
    getExpandedPaths,
    setExpandedPaths,
  };
}

