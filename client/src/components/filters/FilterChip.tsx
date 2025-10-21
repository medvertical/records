import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { X, ChevronDown, Equal, ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, Search, Type, Hash, CheckCircle } from 'lucide-react';
import { getResourceTypeIcon } from '@/lib/resource-type-icons';
import { BooleanInput, DateInput, NumberInput, TokenInput, ReferenceInput, StringInput } from './inputs';

export type ChipKind = 'resourceType' | 'validation' | 'search' | 'fhirParam';

export interface FilterChipProps {
  kind: ChipKind;
  label: string;
  value?: string | string[];
  operator?: string;
  operators?: string[];
  onChange?: (update: { value?: string | string[]; operator?: string }) => void;
  onRemove?: () => void;
  // For fhirParam chips
  typeHint?: string; // e.g., string, date, token
  disabled?: boolean;
  // Auto-open for new chips
  isNew?: boolean;
  // For resource type chips
  availableResourceTypes?: string[];
}

export function FilterChip({ kind, label, value, operator, operators, onChange, onRemove, typeHint, disabled, isNew = false, availableResourceTypes = [] }: FilterChipProps) {
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState<string>(Array.isArray(value) ? value.join(',') : (value ?? ''));
  const [localOp, setLocalOp] = useState<string>(operator || (operators?.[0] || 'eq'));
  const valueInputRef = useRef<HTMLInputElement>(null);


  const display = useMemo(() => {
    const val = Array.isArray(value) ? value.join(', ') : value;
    return operator ? `${label} ${operator} ${val ?? ''}` : `${label}${val ? `: ${val}` : ''}`;
  }, [label, operator, value]);

  const isText = typeHint === 'string' || kind === 'search';

  // Determine what type of input to show based on operator and parameter type
  const getOperatorValueType = (paramType: string | undefined, operator: string): string => {
    // Boolean operators always need boolean input
    if (operator === 'missing' || operator === 'exists') {
      return 'boolean';
    }
    
    // Comparison operators depend on parameter type
    if (['eq', 'gt', 'lt', 'ge', 'le', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual'].includes(operator)) {
      if (paramType === 'date') return 'date';
      if (paramType === 'number' || paramType === 'quantity') return 'number';
    }
    
    // String operators
    if (['contains', 'exact', 'startsWith', 'endsWith'].includes(operator)) {
      return 'string';
    }
    
    // Type-specific inputs
    if (paramType === 'token') return 'token';
    if (paramType === 'reference') return 'reference';
    if (paramType === 'date') return 'date';
    if (paramType === 'number' || paramType === 'quantity') return 'number';
    if (paramType === 'uri') return 'string'; // URI uses string input with URL placeholder
    
    // Default to string
    return 'string';
  };

  const valueType = getOperatorValueType(typeHint, localOp);

  // Get icon for operator
  const getOperatorIcon = (op: string) => {
    switch (op) {
      case 'eq':
      case '==':
      case 'equals':
        return <Equal className="h-4 w-4" />;
      case 'exists':
        return <CheckCircle className="h-4 w-4" />;
      case 'missing':
        return <X className="h-4 w-4" />;
      case 'gt':
      case '>':
      case 'greaterThan':
        return <ChevronRight className="h-4 w-4" />;
      case 'lt':
      case '<':
      case 'lessThan':
        return <ChevronLeft className="h-4 w-4" />;
      case 'ge':
      case '>=':
      case 'greaterThanOrEqual':
        return <ChevronsRight className="h-4 w-4" />;
      case 'le':
      case '<=':
      case 'lessThanOrEqual':
        return <ChevronsLeft className="h-4 w-4" />;
      case 'contains':
        return <Search className="h-4 w-4" />;
      case 'startsWith':
        return <Type className="h-4 w-4" />;
      case 'endsWith':
        return <Hash className="h-4 w-4" />;
      case 'ne':
      case '!=':
      case 'notEquals':
        return <X className="h-4 w-4" />;
      default: 
        return <Equal className="h-4 w-4" />;
    }
  };

  // Get label for operator
  const getOperatorLabel = (op: string) => {
    switch (op) {
      case 'eq':
      case '==':
      case 'equals':
        return 'equals';
      case 'exists':
        return 'exists';
      case 'missing':
        return 'missing';
      case 'gt':
      case '>':
      case 'greaterThan':
        return 'greater than';
      case 'lt':
      case '<':
      case 'lessThan':
        return 'less than';
      case 'ge':
      case '>=':
      case 'greaterThanOrEqual':
        return 'greater than or equal';
      case 'le':
      case '<=':
      case 'lessThanOrEqual':
        return 'less than or equal';
      case 'contains':
        return 'contains';
      case 'startsWith':
        return 'starts with';
      case 'endsWith':
        return 'ends with';
      case 'ne':
      case '!=':
      case 'notEquals':
        return 'not equals';
      default: 
        return op;
    }
  };

  // Auto-open for new chips
  useEffect(() => {
    if (isNew) {
      setOpen(true);
      // Focus value input after a short delay to ensure popover is rendered
      setTimeout(() => {
        valueInputRef.current?.focus();
      }, 150);
    }
  }, [isNew]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-1 cursor-pointer">
          <span>{display}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          {operators && operators.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500">Operator</div>
              <RadioGroup 
                value={localOp} 
                onValueChange={setLocalOp}
                disabled={disabled}
              >
                {operators.map(op => (
                  <div key={op} className="flex items-center space-x-2">
                    <RadioGroupItem value={op} id={`op-${op}`} />
                    <Label 
                      htmlFor={`op-${op}`} 
                      className="flex items-center gap-2 cursor-pointer text-sm font-normal"
                    >
                      {getOperatorIcon(op)}
                      <span>{getOperatorLabel(op)}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          <div className="space-y-1">
            <div className="text-xs text-gray-500">Value</div>
            {kind === 'resourceType' ? (
              <Select 
                value={localValue} 
                onValueChange={(v) => setLocalValue(v)} 
                disabled={disabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select resource type" />
                </SelectTrigger>
                <SelectContent>
                  {availableResourceTypes.map(rt => {
                    const Icon = getResourceTypeIcon(rt);
                    return (
                      <SelectItem key={rt} value={rt}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{rt}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : valueType === 'boolean' ? (
              <BooleanInput 
                value={localValue}
                onChange={setLocalValue}
                disabled={disabled}
              />
            ) : valueType === 'date' ? (
              <DateInput 
                value={localValue}
                onChange={setLocalValue}
                disabled={disabled}
              />
            ) : valueType === 'number' ? (
              <NumberInput 
                value={localValue}
                onChange={setLocalValue}
                disabled={disabled}
              />
            ) : valueType === 'token' ? (
              <TokenInput 
                value={localValue}
                onChange={setLocalValue}
                disabled={disabled}
                paramName={label}
              />
            ) : valueType === 'reference' ? (
              <ReferenceInput 
                value={localValue}
                onChange={setLocalValue}
                disabled={disabled}
              />
            ) : (
              <StringInput 
                value={localValue}
                onChange={setLocalValue}
                disabled={disabled}
                operator={localOp}
              />
            )}
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" size="sm" onClick={() => { setOpen(false); onRemove?.(); }} disabled={disabled}>
              <X className="h-3 w-3 mr-1" /> Remove
            </Button>
            <Button size="sm" onClick={() => { setOpen(false); onChange?.({ value: localValue, operator: localOp }); }} disabled={disabled}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
