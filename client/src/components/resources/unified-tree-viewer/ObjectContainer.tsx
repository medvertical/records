import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { 
  isValidFieldName, 
  getDefaultValueForType 
} from '@/utils/fhir-validation';
import { cn } from '@/lib/utils';
import TreeNode from './TreeNode';
import { ObjectContainerProps } from './types';
import { isExtensionField } from './fhir-helpers';
import CreateFieldDialog from './CreateFieldDialog';

// ============================================================================
// Object Container Component
// ============================================================================

export default function ObjectContainer({
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
}: ObjectContainerProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [newPropertyType, setNewPropertyType] = useState<string>('string');
  const [propertyNameError, setPropertyNameError] = useState<string | null>(null);
  
  // Ghost field creation dialog state
  const [showGhostDialog, setShowGhostDialog] = useState(false);
  const [ghostFieldName, setGhostFieldName] = useState('');
  // Use ref to persist pending field across mode switches
  const pendingFieldRef = useRef<{ fieldName: string; fieldValue: any } | null>(null);
  const wasInViewModeRef = useRef(isEditMode);

  const handleAddProperty = useCallback(() => {
    if (!onValueChange) return;
    
    // Validate property name
    if (!newPropertyName) {
      setPropertyNameError('Property name is required');
      return;
    }
    if (newPropertyName.startsWith('_')) {
      setPropertyNameError('Property name cannot start with underscore (reserved for internal fields)');
      return;
    }
    if (!isValidFieldName(newPropertyName)) {
      setPropertyNameError('Property name must start with lowercase letter');
      return;
    }
    if (newPropertyName in value) {
      setPropertyNameError('Property already exists');
      return;
    }

    const defaultValue = getDefaultValueForType(newPropertyType);
    const newObject = { ...value, [newPropertyName]: defaultValue };
    onValueChange(path, newObject);
    setShowAddDialog(false);
    setNewPropertyName('');
    setNewPropertyType('string');
    setPropertyNameError(null);
  }, [value, path, onValueChange, newPropertyName, newPropertyType]);

  // Filter out internal fields
  const keys = Object.keys(value || {}).filter(key => !key.startsWith('_') && key !== 'resourceId');
  
  // Find ghost keys from validation issues that don't exist in the actual data
  // Works in both view and edit modes now
  const ghostKeys: string[] = [];
  if (validationIssues) {
    const currentPathString = path.join('.');
    
    validationIssues.forEach(issue => {
      const issuePath = issue.path?.toLowerCase() || '';
      const currentPath = currentPathString.toLowerCase();
      
      // Strip resource type prefix if present (e.g., "Patient.name" -> "name")
      const stripResourceTypePrefix = (p: string) => {
        if (resourceType && p.toLowerCase().startsWith(resourceType.toLowerCase() + '.')) {
          return p.substring(resourceType.length + 1);
        }
        return p;
      };
      
      const strippedIssuePath = stripResourceTypePrefix(issue.path || '').toLowerCase();
      const strippedCurrentPath = stripResourceTypePrefix(currentPathString).toLowerCase();
      
      // Check if current path is the root (either empty or equals resource type)
      const isRootPath = strippedCurrentPath === '' || 
                        strippedCurrentPath.toLowerCase() === (resourceType?.toLowerCase() || '');
      
      // Check if this issue is a direct child of the current path
      // Handle root level (empty path), array notation, and nested paths
      let isDirectChild = false;
      let firstSegment = '';
      
      if (isRootPath && strippedIssuePath !== '') {
        // Root level - extract first segment
        const segments = strippedIssuePath.split('.');
        firstSegment = segments[0].replace(/\[\d+\]/g, ''); // Remove array indices
        isDirectChild = segments.length >= 1;
      } else if (strippedIssuePath.startsWith(strippedCurrentPath + '.')) {
        // Nested path - extract immediate child
        const remainingPath = strippedIssuePath.substring(strippedCurrentPath.length + 1);
        const segments = remainingPath.split('.');
        firstSegment = segments[0].replace(/\[\d+\]/g, ''); // Remove array indices
        isDirectChild = true;
      }
      
      if (isDirectChild && firstSegment) {
        // Check if this key doesn't exist in actual data (case insensitive)
        const keyExistsInData = keys.some(k => k.toLowerCase() === firstSegment.toLowerCase());
        const alreadyInGhostList = ghostKeys.some(k => k.toLowerCase() === firstSegment.toLowerCase());
        
        if (!keyExistsInData && !alreadyInGhostList) {
          // Find the original casing from the issue path
          const pathParts = issue.path?.split('.') || [];
          // Calculate depth, accounting for resource type prefix
          const pathPrefix = resourceType && issue.path?.toLowerCase().startsWith(resourceType.toLowerCase() + '.') ? 1 : 0;
          const pathDepth = (currentPathString ? currentPathString.split('.').length : 0) + pathPrefix;
          const originalKey = pathParts[pathDepth] || firstSegment;
          ghostKeys.push(originalKey);
        }
      }
    });
  }
  
  // Combine real keys with ghost keys
  const allKeys = [...keys, ...ghostKeys];
  
  // Handle ghost field creation
  const handleGhostFieldCreate = useCallback((fieldPath: string[], fieldName: string) => {
    console.log('[ObjectContainer] Ghost field create requested:', { fieldPath, fieldName, isEditMode });
    // Show dialog regardless of mode
    setGhostFieldName(fieldName);
    setShowGhostDialog(true);
  }, [isEditMode]);
  
  const handleGhostFieldConfirm = useCallback((fieldName: string, fieldValue: any) => {
    console.log('[ObjectContainer] Creating ghost field:', { fieldName, fieldValue, path, isEditMode });
    
    // If in view mode, switch to edit mode first, then create the field
    if (!isEditMode && onEdit) {
      console.log('[ObjectContainer] Switching to edit mode and creating field');
      // Store the pending field in sessionStorage (survives component recreation)
      const pendingField = {
        path: path.join('.'),
        fieldName,
        fieldValue,
        timestamp: Date.now()
      };
      sessionStorage.setItem('pendingFieldCreation', JSON.stringify(pendingField));
      // Close dialog
      setShowGhostDialog(false);
      setGhostFieldName('');
      // Switch to edit mode - the field will be created by the effect below
      onEdit();
    } else {
      // Already in edit mode, create field directly
      if (!onValueChange) return;
      const newObject = { ...value, [fieldName]: fieldValue };
      onValueChange(path, newObject);
      setShowGhostDialog(false);
      setGhostFieldName('');
    }
  }, [value, path, onValueChange, isEditMode, onEdit]);
  
  // Effect to create field when switching from view to edit mode
  useEffect(() => {
    if (!isEditMode || !onValueChange) return;
    
    // Check for pending field creation from sessionStorage
    const pendingFieldStr = sessionStorage.getItem('pendingFieldCreation');
    if (!pendingFieldStr) return;
    
    try {
      const pendingField = JSON.parse(pendingFieldStr);
      const currentPath = path.join('.');
      
      // Only apply if this is the correct path and it's recent (within 5 seconds)
      if (pendingField.path === currentPath && (Date.now() - pendingField.timestamp) < 5000) {
        console.log('[ObjectContainer] Edit mode active, creating pending field:', pendingField);
        const { fieldName, fieldValue } = pendingField;
        const newObject = { ...value, [fieldName]: fieldValue };
        onValueChange(path, newObject);
        // Clear the pending field
        sessionStorage.removeItem('pendingFieldCreation');
      }
    } catch (error) {
      console.error('[ObjectContainer] Error parsing pending field:', error);
      sessionStorage.removeItem('pendingFieldCreation');
    }
  }, [isEditMode, value, path, onValueChange]);

  return (
    <div>
      {allKeys.map((key) => {
        const isGhost = ghostKeys.includes(key);
        const nodeValue = isGhost ? null : value[key];
        
        // Check if this is an extension field
        const isExtensionFieldKey = !isGhost && isExtensionField(key, nodeValue);
        
        return (
          <TreeNode
            key={key}
            nodeKey={key}
            value={nodeValue}
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
            onCreateField={handleGhostFieldCreate}
            highlightedPath={highlightedPath}
            isGhost={isGhost}
            profileUrls={profileUrls}
          />
        );
      })}

      {/* Add Property Button (edit mode only) */}
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
              Add Property
            </Button>
          </div>

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Property</DialogTitle>
                <DialogDescription>
                  Enter the property name and choose its type.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Property Name</Label>
                  <Input
                    value={newPropertyName}
                    onChange={(e) => {
                      setNewPropertyName(e.target.value);
                      setPropertyNameError(null);
                    }}
                    placeholder="propertyName"
                    className={cn(
                      'font-mono focus:ring-1 focus:ring-blue-400 focus:border-blue-300',
                      propertyNameError && 'border-red-500 focus:ring-red-400 focus:border-red-400'
                    )}
                  />
                  {propertyNameError && (
                    <p className="text-xs text-red-600">{propertyNameError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Property Type</Label>
                  <Select value={newPropertyType} onValueChange={setNewPropertyType}>
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
                <Button variant="outline" onClick={() => {
                  setShowAddDialog(false);
                  setNewPropertyName('');
                  setPropertyNameError(null);
                }}>
                  Cancel
                </Button>
                <Button onClick={handleAddProperty}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
      
      {/* Ghost Field Creation Dialog - available in both view and edit modes */}
      <CreateFieldDialog
        open={showGhostDialog}
        onOpenChange={setShowGhostDialog}
        fieldName={ghostFieldName}
        onConfirm={handleGhostFieldConfirm}
      />
    </div>
  );
}

