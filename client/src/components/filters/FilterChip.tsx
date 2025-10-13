import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, ChevronDown } from 'lucide-react';

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
}

export function FilterChip({ kind, label, value, operator, operators, onChange, onRemove, typeHint, disabled }: FilterChipProps) {
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState<string>(Array.isArray(value) ? value.join(',') : (value ?? ''));
  const [localOp, setLocalOp] = useState<string>(operator || (operators?.[0] || 'eq'));


  const display = useMemo(() => {
    const val = Array.isArray(value) ? value.join(', ') : value;
    return operator ? `${label} ${operator} ${val ?? ''}` : `${label}${val ? `: ${val}` : ''}`;
  }, [label, operator, value]);

  const isText = typeHint === 'string' || kind === 'search';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-1 cursor-pointer">
          <span>{display}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="space-y-3">
          {operators && operators.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-gray-500">Operator</div>
              <Select value={localOp} onValueChange={(v) => setLocalOp(v)} disabled={disabled}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operators.map(op => (
                    <SelectItem key={op} value={op}>{op}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <div className="text-xs text-gray-500">Value</div>
            {isText ? (
              <Input value={localValue} onChange={(e) => setLocalValue(e.target.value)} disabled={disabled} />
            ) : (
              <Input value={localValue} onChange={(e) => setLocalValue(e.target.value)} disabled={disabled} />
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
