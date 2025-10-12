import React, { useState, useCallback } from 'react';
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
}: ObjectContainerProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [newPropertyType, setNewPropertyType] = useState<string>('string');
  const [propertyNameError, setPropertyNameError] = useState<string | null>(null);

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
  const keys = Object.keys(value || {}).filter(key => !key.startsWith('_'));

  return (
    <div>
      {keys.map((key) => (
        <TreeNode
          key={key}
          nodeKey={key}
          value={value[key]}
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
        />
      ))}

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
    </div>
  );
}

