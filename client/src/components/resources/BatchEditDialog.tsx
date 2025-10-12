import { useState, useCallback } from 'react';
import { Plus, Trash2, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBatchActions, type PatchOperation } from '@/hooks/use-batch-actions';

// ============================================================================
// Types
// ============================================================================

export interface BatchEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedResources: Array<{ resourceType: string; id: string }>;
  onComplete?: () => void;
}

interface OperationBuilder extends PatchOperation {
  id: string; // For React key
}

// ============================================================================
// Helper Functions
// ============================================================================

function validateJSONValue(value: string): { valid: boolean; parsed?: any; error?: string } {
  if (!value.trim()) {
    return { valid: false, error: 'Value is required' };
  }

  try {
    const parsed = JSON.parse(value);
    return { valid: true, parsed };
  } catch (error) {
    return { valid: false, error: 'Invalid JSON format' };
  }
}

function validatePath(path: string): boolean {
  // JSON Pointer must start with /
  if (!path.startsWith('/')) return false;
  // Empty path after / is not allowed (except root /)
  if (path.length > 1 && path.endsWith('/')) return false;
  return true;
}

// ============================================================================
// Main Component
// ============================================================================

export function BatchEditDialog({
  open,
  onOpenChange,
  selectedResources,
  onComplete,
}: BatchEditDialogProps) {
  const [operations, setOperations] = useState<OperationBuilder[]>([]);
  const [currentOp, setCurrentOp] = useState<'add' | 'remove' | 'replace'>('replace');
  const [currentPath, setCurrentPath] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [pathError, setPathError] = useState('');
  const [valueError, setValueError] = useState('');
  
  const { executeBatchEdit, isExecuting, lastResult, clearResult } = useBatchActions({
    onSuccess: () => {
      onComplete?.();
    },
  });

  // Group resources by type
  const resourcesByType = selectedResources.reduce((acc, resource) => {
    if (!acc[resource.resourceType]) {
      acc[resource.resourceType] = [];
    }
    acc[resource.resourceType].push(resource.id);
    return acc;
  }, {} as Record<string, string[]>);

  const resourceTypes = Object.keys(resourcesByType);
  const isSingleResourceType = resourceTypes.length === 1;

  const handleAddOperation = useCallback(() => {
    // Validate path
    if (!currentPath.trim()) {
      setPathError('Path is required');
      return;
    }
    if (!validatePath(currentPath)) {
      setPathError('Path must be a valid JSON Pointer (e.g., /fieldName or /array/0)');
      return;
    }
    setPathError('');

    // Validate value for add/replace operations
    if (currentOp === 'add' || currentOp === 'replace') {
      if (!currentValue.trim()) {
        setValueError('Value is required for add/replace operations');
        return;
      }
      const valueValidation = validateJSONValue(currentValue);
      if (!valueValidation.valid) {
        setValueError(valueValidation.error || 'Invalid value');
        return;
      }
      setValueError('');
    }

    // Add operation
    const newOperation: OperationBuilder = {
      id: `${Date.now()}-${Math.random()}`,
      op: currentOp,
      path: currentPath,
    };

    if (currentOp === 'add' || currentOp === 'replace') {
      const valueValidation = validateJSONValue(currentValue);
      if (valueValidation.valid) {
        newOperation.value = valueValidation.parsed;
      }
    }

    setOperations([...operations, newOperation]);
    
    // Reset form
    setCurrentPath('');
    setCurrentValue('');
    setPathError('');
    setValueError('');
  }, [currentOp, currentPath, currentValue, operations]);

  const handleRemoveOperation = useCallback((id: string) => {
    setOperations(operations.filter(op => op.id !== id));
  }, [operations]);

  const handleExecute = useCallback(async () => {
    if (!isSingleResourceType) {
      alert('Please select resources of the same type for batch editing');
      return;
    }

    if (operations.length === 0) {
      alert('Please add at least one operation');
      return;
    }

    const resourceType = resourceTypes[0];
    const ids = resourcesByType[resourceType];

    await executeBatchEdit({
      resourceType,
      filter: { ids },
      operations: operations.map(({ id, ...op }) => op),
    });
  }, [isSingleResourceType, operations, resourceTypes, resourcesByType, executeBatchEdit]);

  const handleClose = useCallback(() => {
    if (operations.length > 0 && !lastResult) {
      const confirmed = window.confirm(
        'You have unsaved operations. Are you sure you want to close?'
      );
      if (!confirmed) return;
    }
    
    // Reset state
    setOperations([]);
    setCurrentOp('replace');
    setCurrentPath('');
    setCurrentValue('');
    setPathError('');
    setValueError('');
    clearResult();
    
    onOpenChange(false);
  }, [operations.length, lastResult, clearResult, onOpenChange]);

  const valueRequired = currentOp === 'add' || currentOp === 'replace';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Batch Edit Resources</DialogTitle>
          <DialogDescription>
            Apply JSON Patch operations to {selectedResources.length} selected resource{selectedResources.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Selected Resources Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Selected Resources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {resourceTypes.map(type => (
                  <Badge key={type} variant="secondary">
                    {type}: {resourcesByType[type].length}
                  </Badge>
                ))}
              </div>
              {!isSingleResourceType && (
                <Alert variant="destructive" className="mt-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    All selected resources must be of the same type. Please adjust your selection.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Operation Builder */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Add Operation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="operation">Operation</Label>
                  <Select
                    value={currentOp}
                    onValueChange={(value) => setCurrentOp(value as 'add' | 'remove' | 'replace')}
                  >
                    <SelectTrigger id="operation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="replace">Replace</SelectItem>
                      <SelectItem value="add">Add</SelectItem>
                      <SelectItem value="remove">Remove</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="path">
                    Path <span className="text-xs text-gray-500">(JSON Pointer format, e.g., /active or /name/0/family)</span>
                  </Label>
                  <Input
                    id="path"
                    value={currentPath}
                    onChange={(e) => {
                      setCurrentPath(e.target.value);
                      setPathError('');
                    }}
                    placeholder="/fieldName"
                    className={pathError ? 'border-red-500' : ''}
                  />
                  {pathError && <p className="text-xs text-red-500">{pathError}</p>}
                </div>
              </div>

              {valueRequired && (
                <div className="space-y-2">
                  <Label htmlFor="value">
                    Value <span className="text-xs text-gray-500">(JSON format)</span>
                  </Label>
                  <Textarea
                    id="value"
                    value={currentValue}
                    onChange={(e) => {
                      setCurrentValue(e.target.value);
                      setValueError('');
                    }}
                    placeholder='true, "text", 123, {"key": "value"}, or ["item1", "item2"]'
                    rows={3}
                    className={`font-mono text-sm ${valueError ? 'border-red-500' : ''}`}
                  />
                  {valueError && <p className="text-xs text-red-500">{valueError}</p>}
                </div>
              )}

              <Button
                onClick={handleAddOperation}
                size="sm"
                variant="outline"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Operation
              </Button>
            </CardContent>
          </Card>

          {/* Operations List */}
          {operations.length > 0 && (
            <Card className="flex-1 overflow-hidden flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Operations to Apply ({operations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="space-y-2">
                    {operations.map((op) => (
                      <div
                        key={op.id}
                        className="flex items-start justify-between p-3 border rounded-lg bg-gray-50"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {op.op.toUpperCase()}
                            </Badge>
                            <code className="text-sm text-gray-700">{op.path}</code>
                          </div>
                          {op.value !== undefined && (
                            <div className="text-xs text-gray-600 font-mono ml-2 pl-2 border-l-2 border-gray-300">
                              {JSON.stringify(op.value)}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveOperation(op.id)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {lastResult && (
            <Alert variant={lastResult.failed === 0 ? 'default' : 'destructive'}>
              {lastResult.failed === 0 ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {lastResult.failed === 0 ? 'Success' : 'Completed with Errors'}
              </AlertTitle>
              <AlertDescription>
                <p>
                  Modified {lastResult.modified} of {lastResult.matched} resources.
                  {lastResult.failed > 0 && ` ${lastResult.failed} failed.`}
                </p>
                {lastResult.failed > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium">
                      View Errors
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs">
                      {lastResult.results
                        .filter(r => !r.success)
                        .map((r, idx) => (
                          <li key={idx}>
                            {r.id}: {r.error}
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isExecuting}>
            {lastResult ? 'Close' : 'Cancel'}
          </Button>
          <Button
            onClick={handleExecute}
            disabled={!isSingleResourceType || operations.length === 0 || isExecuting}
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                Apply to {selectedResources.length} Resource{selectedResources.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

