import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SearchParameterDef } from '@/hooks/useCapabilitySearchParams';

interface SortDropdownProps {
  value?: string; // e.g., "_lastUpdated" or "-_lastUpdated"
  onChange: (value: string) => void;
  availableParams: SearchParameterDef[];
  disabled?: boolean;
}

// Standard FHIR sort parameters available on all resources
const STANDARD_SORT_PARAMS = [
  { name: '_lastUpdated', label: 'Last updated', type: 'date' },
  { name: '_id', label: 'ID', type: 'token' },
];

// Default sort when none is selected
const DEFAULT_SORT = '_lastUpdated';

export function SortDropdown({ value, onChange, availableParams, disabled }: SortDropdownProps) {
  const [open, setOpen] = useState(false);

  // Parse current sort value (use default if none provided)
  const effectiveValue = value || DEFAULT_SORT;
  const isDescending = effectiveValue.startsWith('-');
  const currentField = isDescending ? effectiveValue.substring(1) : effectiveValue;
  
  // Get display label for current sort
  const getCurrentLabel = () => {
    const standardParam = STANDARD_SORT_PARAMS.find(p => p.name === currentField);
    if (standardParam) {
      return standardParam.label;
    }
    
    const customParam = availableParams.find(p => p.name === currentField);
    if (customParam) return customParam.name;
    
    return currentField;
  };

  // Get icon for current sort direction
  const SortIcon = isDescending ? ArrowDown : ArrowUp;

  const handleSelect = (paramName: string, direction: 'asc' | 'desc') => {
    const sortValue = direction === 'desc' ? `-${paramName}` : paramName;
    onChange(sortValue);
    setOpen(false);
  };

  // Combine standard and resource-specific params
  const allParams = [
    ...STANDARD_SORT_PARAMS,
    ...availableParams
      .filter(p => !STANDARD_SORT_PARAMS.some(sp => sp.name === p.name))
      .filter(p => {
        // Include most parameter types that make sense for sorting
        const sortableTypes = ['date', 'number', 'string', 'token', 'reference', 'uri', 'quantity'];
        return sortableTypes.includes(p.type);
      })
      .filter(p => {
        // Exclude FHIR system/control parameters (like _count, _format, _has, etc.)
        // but allow actual resource fields
        const excludedParams = ['_count', '_format', '_has', '_include', '_revinclude', 
                                '_contained', '_containedType', '_elements', '_summary',
                                '_text', '_content', '_list', '_query', '_filter', 
                                '_security', '_tag', '_profile', '_source'];
        return !excludedParams.includes(p.name);
      })
      .slice(0, 15) // Increased limit since we're being more selective
  ];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-2"
        >
          <SortIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{getCurrentLabel()}</span>
          <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {/* Standard parameters */}
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Common
        </DropdownMenuLabel>
        {STANDARD_SORT_PARAMS.map((param) => {
          const isActiveAsc = currentField === param.name && !isDescending;
          const isActiveDesc = currentField === param.name && isDescending;
          
          return (
            <DropdownMenuItem
              key={param.name}
              className="flex items-center justify-between p-0 focus:bg-transparent"
              onSelect={(e) => e.preventDefault()}
              asChild
            >
              <div className="flex w-full gap-1 px-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex-1 justify-start h-8 px-2 rounded-md hover:bg-accent focus:bg-accent ${
                    isActiveAsc ? 'bg-accent text-accent-foreground font-medium' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(param.name, 'asc');
                  }}
                >
                  <span className="flex-1 text-left">{param.label}</span>
                  <ArrowUp className="h-3 w-3 ml-2" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-8 w-8 p-0 rounded-md hover:bg-accent focus:bg-accent ${
                    isActiveDesc ? 'bg-accent text-accent-foreground font-medium' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(param.name, 'desc');
                  }}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
            </DropdownMenuItem>
          );
        })}
        
        {/* Resource-specific parameters */}
        {availableParams.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Resource-specific
            </DropdownMenuLabel>
            {availableParams
              .filter(p => !STANDARD_SORT_PARAMS.some(sp => sp.name === p.name))
              .filter(p => {
                // Include most parameter types that make sense for sorting
                const sortableTypes = ['date', 'number', 'string', 'token', 'reference', 'uri', 'quantity'];
                return sortableTypes.includes(p.type);
              })
              .filter(p => {
                // Exclude FHIR system/control parameters but allow actual resource fields
                const excludedParams = ['_count', '_format', '_has', '_include', '_revinclude', 
                                        '_contained', '_containedType', '_elements', '_summary',
                                        '_text', '_content', '_list', '_query', '_filter', 
                                        '_security', '_tag', '_profile', '_source'];
                return !excludedParams.includes(p.name);
              })
              .slice(0, 15)
              .map((param) => {
                const isActiveAsc = currentField === param.name && !isDescending;
                const isActiveDesc = currentField === param.name && isDescending;
                
                return (
                  <DropdownMenuItem
                    key={param.name}
                    className="flex items-center justify-between p-0 focus:bg-transparent"
                    onSelect={(e) => e.preventDefault()}
                    asChild
                  >
                    <div className="flex w-full gap-1 px-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`flex-1 justify-start h-8 px-2 rounded-md hover:bg-accent focus:bg-accent ${
                          isActiveAsc ? 'bg-accent text-accent-foreground font-medium' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(param.name, 'asc');
                        }}
                      >
                        <span className="flex-1 text-left truncate">{param.name}</span>
                        <ArrowUp className="h-3 w-3 ml-2 flex-shrink-0" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 rounded-md hover:bg-accent focus:bg-accent ${
                          isActiveDesc ? 'bg-accent text-accent-foreground font-medium' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(param.name, 'desc');
                        }}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </DropdownMenuItem>
                );
              })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

