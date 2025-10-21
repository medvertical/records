import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, ChevronDown, Equal, ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, Search, Type, Hash, CheckCircle } from 'lucide-react';
import { getResourceTypeIcon } from '@/lib/resource-type-icons';

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

  // Get icon for operator
  const getOperatorIcon = (op: string) => {
    switch (op) {
      case 'eq':
      case '==':
      case 'equals':
        return <Equal className="h-4 w-4" />;
      case 'exists':
        return <CheckCircle className="h-4 w-4" />;
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
            <div className="space-y-1">
              <div className="text-xs text-gray-500">Operator</div>
              <Select 
                value={localOp} 
                onValueChange={(v) => setLocalOp(v)} 
                disabled={disabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operators.map(op => (
                    <SelectItem key={op} value={op}>
                      <div className="flex items-center gap-2">
                        {getOperatorIcon(op)}
                        <span className="text-sm">{getOperatorLabel(op)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            ) : localOp === 'exists' ? (
              <Select 
                value={localValue} 
                onValueChange={(v) => setLocalValue(v)} 
                disabled={disabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select existence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">
                    <div className="flex items-center gap-2">
                      <span>true (has value)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="false">
                    <div className="flex items-center gap-2">
                      <span>false (no value)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input 
                ref={valueInputRef}
                value={localValue} 
                onChange={(e) => setLocalValue(e.target.value)} 
                disabled={disabled} 
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
