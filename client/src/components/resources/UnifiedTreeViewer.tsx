import React, { useCallback, useState, useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { setNestedValue, deleteNestedValue } from './unified-tree-viewer/utils';
import TreeNode from './unified-tree-viewer/TreeNode';
import { UnifiedTreeViewerProps } from './unified-tree-viewer/types';

// ============================================================================
// Main UnifiedTreeViewer Component
// ============================================================================

export default function UnifiedTreeViewer({
  resourceData,
  resourceType,
  isEditMode = false,
  validationResults = [],
  onCategoryChange,
  onSeverityChange,
  onIssueClick,
  onEdit,
  onResourceChange,
  expandAll = false,
  expandAllTrigger = 0,
  expandedPaths: externalExpandedPaths,
  onExpandedPathsChange: externalOnExpandedPathsChange,
  highlightedPath,
  profileUrls = [],
}: UnifiedTreeViewerProps) {
  // Get the resource type for the root node (must be declared before any hooks that use it)
  const rootResourceType = resourceType || resourceData?.resourceType || 'Resource';
  
  // Internal state for expanded paths (fallback if not provided externally)
  const [internalExpandedPaths, setInternalExpandedPaths] = useState<Set<string>>(new Set());
  
  // Use external state if provided, otherwise use internal state
  const expandedPaths = externalExpandedPaths ?? internalExpandedPaths;
  const onExpandedPathsChange = externalOnExpandedPathsChange ?? setInternalExpandedPaths;

  // Track previous trigger value to detect actual changes
  const prevExpandAllTriggerRef = useRef<number>(expandAllTrigger);

  // Handle expandAll functionality
  useEffect(() => {
    // Only run if expandAllTrigger actually changed (not on initial mount)
    if (prevExpandAllTriggerRef.current === expandAllTrigger) return;
    prevExpandAllTriggerRef.current = expandAllTrigger;
    
    if (!resourceData || typeof resourceData !== 'object') return;
    
    const newExpandedPaths = new Set<string>();
    
    if (expandAll) {
      console.log('[UnifiedTreeViewer] Expand All triggered');
      
      // Always expand the root node
      newExpandedPaths.add(rootResourceType);
      
      // When expandAll is true, expand all complex nodes
      // Note: We need to include the root resource type in all paths to match TreeNode's pathString format
      const expandAllPaths = (obj: any, path: string[] = []) => {
        Object.entries(obj).forEach(([key, value]) => {
          if (key.startsWith('_') || key === 'resourceId') return; // Skip internal fields
          
          // Build path with resource type prefix
          const currentPath = path.length === 0 
            ? `${rootResourceType}.${key}` 
            : `${path.join('.')}.${key}`;
          const valueType = typeof value;
          
          // Add complex types to expanded paths
          if ((valueType === 'object' && value !== null && !Array.isArray(value)) || Array.isArray(value)) {
            console.log('[UnifiedTreeViewer] Adding path:', currentPath, 'isArray:', Array.isArray(value));
            newExpandedPaths.add(currentPath);
            
            // Recursively expand nested objects/arrays
            if (valueType === 'object' && value !== null && !Array.isArray(value)) {
              expandAllPaths(value, path.length === 0 ? [rootResourceType, key] : [...path, key]);
            } else if (Array.isArray(value)) {
              console.log('[UnifiedTreeViewer] Processing array:', currentPath, 'length:', value.length);
              value.forEach((item, index) => {
                const arrayElementPath = currentPath + `.[${index}]`;
                console.log('[UnifiedTreeViewer] Array item path:', arrayElementPath, 'type:', typeof item);
                // Add ALL array element paths, not just objects
                newExpandedPaths.add(arrayElementPath);
                // Recurse into objects and arrays
                if (typeof item === 'object' && item !== null) {
                  expandAllPaths(item, path.length === 0 ? [rootResourceType, key, `[${index}]`] : [...path, key, `[${index}]`]);
                }
              });
            }
          }
        });
      };
      
      expandAllPaths(resourceData);
      console.log('[UnifiedTreeViewer] Total expanded paths:', newExpandedPaths.size, Array.from(newExpandedPaths));
    } else {
      console.log('[UnifiedTreeViewer] Collapse All triggered');
      // Keep root node expanded even when collapsing all
      newExpandedPaths.add(rootResourceType);
    }
    
    // Update expanded paths when button is clicked
    onExpandedPathsChange(newExpandedPaths);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandAll, expandAllTrigger, rootResourceType]);

  const handleValueChange = useCallback((path: string[], newValue: any) => {
    if (!onResourceChange) return;
    const updatedResource = setNestedValue(resourceData, path, newValue);
    onResourceChange(updatedResource);
  }, [resourceData, onResourceChange]);

  const handleDeleteNode = useCallback((path: string[]) => {
    if (!onResourceChange) return;
    const updatedResource = deleteNestedValue(resourceData, path);
    onResourceChange(updatedResource);
  }, [resourceData, onResourceChange]);
  
  // Handle ghost field creation - no-op in view mode since dialog handles it via onValueChange
  // In edit mode, this is handled by ObjectContainer's dialog
  const handleCreateField = useCallback((path: string[], fieldName: string) => {
    console.log('[UnifiedTreeViewer] Ghost field creation requested:', { path, fieldName });
    // This is a pass-through - the actual creation happens in ObjectContainer's dialog
    // which calls onValueChange after user confirms
  }, []);

  if (!resourceData) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p>No resource data available</p>
      </div>
    );
  }

  if (typeof resourceData !== 'object') {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>Invalid resource data</p>
      </div>
    );
  }

  // Ensure root node is always expanded
  useEffect(() => {
    if (!expandedPaths.has(rootResourceType)) {
      const newExpandedPaths = new Set(expandedPaths);
      newExpandedPaths.add(rootResourceType);
      onExpandedPathsChange(newExpandedPaths);
    }
  }, [rootResourceType, expandedPaths, onExpandedPathsChange]);

  return (
    <div className="space-y-1 font-mono text-sm">
      {/* Root node representing the resource itself */}
      <TreeNode
        key={rootResourceType}
        nodeKey={rootResourceType}
        value={resourceData}
        path={[]}
        level={0}
        resourceType={rootResourceType}
        isEditMode={isEditMode}
        expandAll={expandAll}
        expandedPaths={expandedPaths}
        onExpandedPathsChange={onExpandedPathsChange}
        validationIssues={validationResults}
        onCategoryChange={onCategoryChange}
        onSeverityChange={onSeverityChange}
        onIssueClick={onIssueClick}
        onValueChange={handleValueChange}
        onDeleteNode={handleDeleteNode}
        onCreateField={handleCreateField}
        onEdit={onEdit}
        highlightedPath={highlightedPath}
        profileUrls={profileUrls}
      />
    </div>
  );
}
