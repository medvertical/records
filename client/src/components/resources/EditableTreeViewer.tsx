import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  validateField,
  isFieldRequired,
  isValidFieldName,
  getTypeName,
  getDefaultValueForType,
} from '@/utils/fhir-validation';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface EditableTreeViewerProps {
  resourceData: any;
  onResourceChange: (resource: any) => void;
  resourceType?: string;
  expandAll?: boolean;
  onExpandAll?: () => void;
}

interface EditableTreeNodeProps {
  nodeKey: string;
  value: any;
  path: string[];
  onValueChange: (path: string[], newValue: any) => void;
  onDeleteNode: (path: string[]) => void;
  resourceType?: string;
  level?: number;
  expandAll?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function setNestedValue(obj: any, path: string[], value: any): any {
  if (path.length === 0) return value;
  
  const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
  const [head, ...rest] = path;
  
  if (rest.length === 0) {
    newObj[head] = value;
  } else {
    newObj[head] = setNestedValue(newObj[head] || {}, rest, value);
  }
  
  return newObj;
}

function deleteNestedValue(obj: any, path: string[]): any {
  if (path.length === 0) return obj;
  if (path.length === 1) {
    const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
    if (Array.isArray(newObj)) {
      newObj.splice(parseInt(path[0]), 1);
    } else {
      delete newObj[path[0]];
    }
    return newObj;
  }
  
  const [head, ...rest] = path;
  const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
  newObj[head] = deleteNestedValue(newObj[head], rest);
  return newObj;
}

// ============================================================================
// Editable Tree Node Component
// ============================================================================

function EditableTreeNode({
  nodeKey,
  value,
  path,
  onValueChange,
  onDeleteNode,
  resourceType,
  level = 0,
  expandAll = false,
}: EditableTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
  const [hasManualOverride, setHasManualOverride] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const isInitialMount = useRef(true);
  
  // Sync with expandAll prop, but only if user hasn't manually overridden
  // Skip on initial mount to preserve level-based expansion
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!hasManualOverride) {
      setIsExpanded(expandAll);
    }
  }, [expandAll, hasManualOverride]);
  
  // Reset manual override when expandAll changes
  useEffect(() => {
    if (!isInitialMount.current) {
      setHasManualOverride(false);
    }
  }, [expandAll]);
  
  const fullPath = [...path, nodeKey];
  const isRequired = resourceType ? isFieldRequired(resourceType, nodeKey) : false;
  const valueType = getTypeName(value);
  const isComplex = valueType === 'object' || valueType === 'array';

  // Handle value changes with validation
  const handleValueChange = useCallback((newValue: any) => {
    const validation = validateField(nodeKey, newValue, resourceType);
    if (!validation.valid) {
      setValidationError(validation.error || null);
    } else {
      setValidationError(null);
    }
    onValueChange(fullPath, newValue);
  }, [nodeKey, fullPath, onValueChange, resourceType]);

  // Handle node deletion
  const handleDelete = useCallback(() => {
    if (isRequired) return;
    if (window.confirm(`Are you sure you want to delete "${nodeKey}"?`)) {
      onDeleteNode(fullPath);
    }
  }, [isRequired, nodeKey, fullPath, onDeleteNode]);

  // Render value editor based on type
  const renderValueEditor = () => {
    if (valueType === 'string') {
      return (
        <Input
          type="text"
          value={value || ''}
          onChange={(e) => handleValueChange(e.target.value)}
          className={cn(
            'flex-1 h-8 text-sm font-mono',
            'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            validationError && 'border-red-500 focus:ring-red-500 focus:border-red-500'
          )}
          placeholder="Enter value..."
        />
      );
    }

    if (valueType === 'number') {
      return (
        <Input
          type="number"
          value={value ?? ''}
          onChange={(e) => handleValueChange(e.target.value === '' ? null : parseFloat(e.target.value))}
          className={cn(
            'flex-1 h-8 text-sm font-mono',
            'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            validationError && 'border-red-500 focus:ring-red-500 focus:border-red-500'
          )}
        />
      );
    }

    if (valueType === 'boolean') {
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={value === true}
            onCheckedChange={(checked) => handleValueChange(checked === true)}
            className="focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          />
          <span className="text-sm text-gray-600 font-mono">{value ? 'true' : 'false'}</span>
        </div>
      );
    }

    if (valueType === 'null') {
      return (
        <Input
          type="text"
          value="null"
          disabled
          className="flex-1 h-8 text-sm font-mono bg-gray-100 text-gray-500"
        />
      );
    }

    if (valueType === 'array') {
      return (
        <span className="text-sm text-gray-600 italic font-mono">
          Array[{value.length}]
        </span>
      );
    }

    if (valueType === 'object') {
      const keys = Object.keys(value || {}).filter(key => !key.startsWith('_'));
      return (
        <span className="text-sm text-gray-600 italic font-mono">
          Object{'{' + keys.length + '}'}
        </span>
      );
    }

    return null;
  };

  return (
    <div className="relative">
      <div 
        className="flex items-start gap-2 py-1 px-2 rounded hover:bg-gray-50 group"
      >
        {/* Key Name with indentation - Fixed total width for alignment */}
        <div 
          className="flex items-center gap-1 flex-shrink-0 mt-1.5"
          style={{ width: '280px', paddingLeft: `${level * 1.5 + 0.5}rem` }}
        >
          {/* Expand/Collapse Button */}
          {isComplex && (
            <button
              onClick={() => {
                setIsExpanded(!isExpanded);
                setHasManualOverride(true);
              }}
              className="flex-shrink-0 p-0.5 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600" />
              )}
            </button>
          )}
          {!isComplex && <div className="w-5 flex-shrink-0" />}

          <span className="text-sm font-medium text-gray-700 truncate">
            {nodeKey}
            {isRequired && <span className="text-red-500 ml-1">*</span>}
          </span>
          <span className="text-xs text-gray-400 flex-shrink-0">({valueType})</span>
        </div>

        {/* Value Editor - Always starts at same position */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {renderValueEditor()}
        </div>

        {/* Delete Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isRequired}
              className={cn(
                'h-8 w-8 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100',
                isRequired && 'cursor-not-allowed'
              )}
            >
              <Trash2 className="h-4 w-4 text-gray-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isRequired ? 'Required field cannot be deleted' : 'Delete field'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Validation Error */}
      {validationError && (
        <div 
          className="flex items-center gap-1 text-xs text-red-600 mt-1 ml-[288px]"
        >
          <AlertCircle className="h-3 w-3" />
          {validationError}
        </div>
      )}

      {/* Children for Complex Types */}
      {isComplex && isExpanded && (
        <div className="mt-1">
          {valueType === 'array' && (
            <ArrayEditor
              value={value}
              path={fullPath}
              onValueChange={onValueChange}
              onDeleteNode={onDeleteNode}
              resourceType={resourceType}
              level={level + 1}
              expandAll={expandAll}
            />
          )}
          {valueType === 'object' && (
            <ObjectEditor
              value={value}
              path={fullPath}
              onValueChange={onValueChange}
              onDeleteNode={onDeleteNode}
              resourceType={resourceType}
              level={level + 1}
              expandAll={expandAll}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Array Editor Component
// ============================================================================

interface ArrayEditorProps {
  value: any[];
  path: string[];
  onValueChange: (path: string[], newValue: any) => void;
  onDeleteNode: (path: string[]) => void;
  resourceType?: string;
  level: number;
  expandAll?: boolean;
}

function ArrayEditor({
  value,
  path,
  onValueChange,
  onDeleteNode,
  resourceType,
  level,
  expandAll = false,
}: ArrayEditorProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItemType, setNewItemType] = useState<string>('string');

  const handleAddItem = useCallback(() => {
    const defaultValue = getDefaultValueForType(newItemType);
    const newArray = [...value, defaultValue];
    onValueChange(path, newArray);
    setShowAddDialog(false);
  }, [value, path, onValueChange, newItemType]);

  return (
    <div>
      {value.map((item, index) => (
        <EditableTreeNode
          key={index}
          nodeKey={`[${index}]`}
          value={item}
          path={path}
          onValueChange={onValueChange}
          onDeleteNode={onDeleteNode}
          resourceType={resourceType}
          level={level}
          expandAll={expandAll}
        />
      ))}

      {/* Add Item Button */}
      <div className="flex items-center gap-2 py-1 px-2 mt-1 ml-[280px]">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddDialog(true)}
          className="h-7 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Item
        </Button>
      </div>

      {/* Add Item Dialog */}
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
    </div>
  );
}

// ============================================================================
// Object Editor Component
// ============================================================================

interface ObjectEditorProps {
  value: Record<string, any>;
  path: string[];
  onValueChange: (path: string[], newValue: any) => void;
  onDeleteNode: (path: string[]) => void;
  resourceType?: string;
  level: number;
  expandAll?: boolean;
}

function ObjectEditor({
  value,
  path,
  onValueChange,
  onDeleteNode,
  resourceType,
  level,
  expandAll = false,
}: ObjectEditorProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [newPropertyType, setNewPropertyType] = useState<string>('string');
  const [propertyNameError, setPropertyNameError] = useState<string | null>(null);

  const handleAddProperty = useCallback(() => {
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

  // Filter out internal fields (starting with _)
  const keys = Object.keys(value || {}).filter(key => !key.startsWith('_'));

  return (
    <div>
      {keys.map((key) => (
        <EditableTreeNode
          key={key}
          nodeKey={key}
          value={value[key]}
          path={path}
          onValueChange={onValueChange}
          onDeleteNode={onDeleteNode}
          resourceType={resourceType}
          level={level}
          expandAll={expandAll}
        />
      ))}

      {/* Add Property Button */}
      <div className="flex items-center gap-2 py-1 px-2 mt-1 ml-[280px]">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddDialog(true)}
          className="h-7 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Property
        </Button>
      </div>

      {/* Add Property Dialog */}
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
                  'font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                  propertyNameError && 'border-red-500 focus:ring-red-500 focus:border-red-500'
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
    </div>
  );
}

// ============================================================================
// Main EditableTreeViewer Component
// ============================================================================

export default function EditableTreeViewer({
  resourceData,
  onResourceChange,
  resourceType,
  expandAll = false,
}: EditableTreeViewerProps) {
  const handleValueChange = useCallback((path: string[], newValue: any) => {
    const updatedResource = setNestedValue(resourceData, path, newValue);
    onResourceChange(updatedResource);
  }, [resourceData, onResourceChange]);

  const handleDeleteNode = useCallback((path: string[]) => {
    const updatedResource = deleteNestedValue(resourceData, path);
    onResourceChange(updatedResource);
  }, [resourceData, onResourceChange]);

  if (!resourceData || typeof resourceData !== 'object') {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>Invalid resource data</p>
      </div>
    );
  }

  // Filter out internal fields (starting with _) and resourceId
  const rootKeys = Object.keys(resourceData).filter(
    key => !key.startsWith('_') && key !== 'resourceId'
  );

  return (
    <div className="space-y-1">
      {rootKeys.map((key) => (
        <EditableTreeNode
          key={key}
          nodeKey={key}
          value={resourceData[key]}
          path={[]}
          onValueChange={handleValueChange}
          onDeleteNode={handleDeleteNode}
          resourceType={resourceType || resourceData.resourceType}
          level={0}
          expandAll={expandAll}
        />
      ))}
    </div>
  );
}

