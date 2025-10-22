import React, { useState, useCallback, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getDefaultValueForType } from '@/utils/fhir-validation';
import TreeNode from './TreeNode';
import { ArrayContainerProps } from './types';
import { extractExtensionInfo, detectSliceNameWithProfile, isExtensionObject } from './fhir-helpers';
import { useMultipleSliceDefinitions } from '@/lib/profile-slice-resolver';

// ============================================================================
// Array Container Component
// ============================================================================

export default function ArrayContainer({
  value,
  path,
  level,
  resourceType,
  isEditMode,
  expandAll,
  expandedPaths,
  onExpandedPathsChange,
  validationIssues,
  onCategoryChange,
  onSeverityChange,
  onIssueClick,
  onValueChange,
  onDeleteNode,
  onCreateField,
  onEdit,
  highlightedPath,
  parentKey,
  profileUrls = [],
}: ArrayContainerProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItemType, setNewItemType] = useState<string>('string');

  // Fetch slice definitions for all profile URLs
  const { allSlices, isLoading, isError } = useMultipleSliceDefinitions(profileUrls);
  
  // Debug logging
  useEffect(() => {
    if (parentKey === 'identifier') {
      console.log('[ArrayContainer] ========== IDENTIFIER SLICES DEBUG ==========');
      console.log('[ArrayContainer] Profile URLs:', profileUrls);
      console.log('[ArrayContainer] Slices loading:', isLoading);
      console.log('[ArrayContainer] Slices error:', isError);
      console.log('[ArrayContainer] Number of slices:', allSlices.length);
      console.log('[ArrayContainer] Slices:', allSlices);
      console.log('[ArrayContainer] =======================================');
    }
  }, [profileUrls, allSlices, isLoading, isError, parentKey]);

  const handleAddItem = useCallback(() => {
    if (!onValueChange) return;
    const defaultValue = getDefaultValueForType(newItemType);
    const newArray = [...value, defaultValue];
    onValueChange(path, newArray);
    setShowAddDialog(false);
  }, [value, path, onValueChange, newItemType]);

  // Check if this array contains extensions
  const arrayKey = path[path.length - 1];
  const isExtensionArray = arrayKey === 'extension' || arrayKey === 'modifierExtension';
  const isModifierExtension = arrayKey === 'modifierExtension';

  return (
    <div>
      {value.map((item, index) => {
        // Check if this is an extension object
        const isExtension = isExtensionArray && isExtensionObject(item);
        const extensionInfo = isExtension ? extractExtensionInfo(item, isModifierExtension) : undefined;
        
        // Try to detect slice name with profile support for non-extension arrays
        // Only pass slice definitions if they're loaded (not during initial loading)
        const sliceMatch = !isExtension && parentKey 
          ? detectSliceNameWithProfile(item, parentKey, index, isLoading ? undefined : allSlices)
          : null;

        return (
          <TreeNode
            key={index}
            nodeKey={`[${index}]`}
            value={item}
            path={path}
            level={level}
            resourceType={resourceType}
            isEditMode={isEditMode}
            expandAll={expandAll}
            expandedPaths={expandedPaths}
            onExpandedPathsChange={onExpandedPathsChange}
            validationIssues={validationIssues}
            onCategoryChange={onCategoryChange}
            onSeverityChange={onSeverityChange}
            onIssueClick={onIssueClick}
            onValueChange={onValueChange}
            onDeleteNode={onDeleteNode}
            onCreateField={onCreateField}
            onEdit={onEdit}
            highlightedPath={highlightedPath}
            isExtension={isExtension}
            extensionInfo={extensionInfo || undefined}
            sliceMatch={sliceMatch}
            profileUrls={profileUrls}
          />
        );
      })}

      {/* Add Item Button (edit mode only) */}
      {isEditMode && (
        <>
          <div className="flex items-center gap-2 py-1 px-2 mt-1 ml-[280px] animate-in fade-in duration-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddDialog(true)}
              className="h-7 text-xs transition-all duration-150 hover:scale-105"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Item
            </Button>
          </div>

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Array Item</DialogTitle>
                <DialogDescription>
                  Choose the type of value to add to the array.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Item Type</Label>
                  <Select value={newItemType} onValueChange={setNewItemType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                      <SelectItem value="null">Null</SelectItem>
                      <SelectItem value="object">Object</SelectItem>
                      <SelectItem value="array">Array</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddItem}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

