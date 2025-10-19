import React, { useMemo, useState } from 'react';
import type { ResourceFilterOptions } from '@/components/resources/resource-filter-controls';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { FilterChip } from './FilterChip';
import { useCapabilitySearchParams } from '@/hooks/useCapabilitySearchParams';

interface FilterChipListProps {
  filterOptions: ResourceFilterOptions;
  availableResourceTypes: string[];
  onFilterChange: (options: ResourceFilterOptions) => void;
}

export function FilterChipList({ filterOptions, availableResourceTypes, onFilterChange }: FilterChipListProps) {
  const activeResourceTypes = filterOptions.resourceTypes.length > 0 ? filterOptions.resourceTypes : availableResourceTypes;
  const { params, loading } = useCapabilitySearchParams(activeResourceTypes);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newlyAddedParams, setNewlyAddedParams] = useState<Set<string>>(new Set());


  const chips = useMemo(() => {
    const list: React.ReactNode[] = [];

    // Resource type chips
    filterOptions.resourceTypes.forEach(rt => {
      list.push(
        <FilterChip
          key={`rt:${rt}`}
          kind="resourceType"
          label="Type"
          value={rt}
          availableResourceTypes={availableResourceTypes}
          onChange={({ value }) => {
            const newResourceTypes = filterOptions.resourceTypes.map(t => t === rt ? String(value || '') : t);
            onFilterChange({ ...filterOptions, resourceTypes: newResourceTypes });
          }}
          onRemove={() => onFilterChange({ ...filterOptions, resourceTypes: filterOptions.resourceTypes.filter(t => t !== rt) })}
        />
      );
    });

    // Validation status chips
    (['hasErrors','hasWarnings','hasInformation','isValid'] as const).forEach(k => {
      if (filterOptions.validationStatus?.[k]) {
        list.push(
          <FilterChip
            key={`val:${k}`}
            kind="validation"
            label={k}
            value="true"
            onRemove={() => onFilterChange({ ...filterOptions, validationStatus: { ...filterOptions.validationStatus, [k]: false } })}
          />
        );
      }
    });

    // Search text chip
    if (filterOptions.search) {
      list.push(
        <FilterChip
          key="search"
          kind="search"
          label="Search"
          value={filterOptions.search}
          onChange={({ value }) => onFilterChange({ ...filterOptions, search: String(value || '') })}
          onRemove={() => onFilterChange({ ...filterOptions, search: '' })}
        />
      );
    }

    // FHIR param chips
    if (filterOptions.fhirSearchParams) {
      Object.entries(filterOptions.fhirSearchParams).forEach(([name, cfg]) => {
        // Exclude sorting parameters from being displayed as chips
        if (name === '_sort' || name === 'sort') {
          return;
        }
        
        const isNew = newlyAddedParams.has(name);
        list.push(
          <FilterChip
            key={`fhir:${name}`}
            kind="fhirParam"
            label={name}
            value={Array.isArray(cfg.value) ? cfg.value.join(',') : String(cfg.value || '')}
            operator={cfg.operator}
            operators={params.find(p => p.name === name)?.operators}
            typeHint={params.find(p => p.name === name)?.type}
            isNew={isNew}
            onChange={({ value, operator }) => {
              onFilterChange({
                ...filterOptions,
                fhirSearchParams: { ...filterOptions.fhirSearchParams, [name]: { value: String(value || ''), operator } }
              });
              // Remove from newly added set after first change
              setNewlyAddedParams(prev => {
                const next = new Set(prev);
                next.delete(name);
                return next;
              });
            }}
            onRemove={() => {
              const updated = { ...filterOptions.fhirSearchParams };
              delete updated[name];
              onFilterChange({ ...filterOptions, fhirSearchParams: updated });
              // Remove from newly added set when removed
              setNewlyAddedParams(prev => {
                const next = new Set(prev);
                next.delete(name);
                return next;
              });
            }}
          />
        );
      });
    }

    return list;
  }, [filterOptions, params, onFilterChange, newlyAddedParams]);

  const availableToAdd = useMemo(() => {
    const existing = new Set(Object.keys(filterOptions.fhirSearchParams || {}));
    return params
      .filter(p => !existing.has(p.name))
      .filter(p => p.name !== '_sort' && p.name !== 'sort') // Exclude sorting parameters
      .filter(p => !search || `${p.name} ${p.type}`.toLowerCase().includes(search.toLowerCase()));
  }, [params, filterOptions.fhirSearchParams, search]);

  // CHIP FILTERS - FINAL VERSION
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips}

        <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add filter
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0">
          <Command filter={(value, search) => (value.includes(search) ? 1 : 0)}>
            <CommandInput placeholder={loading ? 'Loading...' : 'Search filters...'} value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>No filters found.</CommandEmpty>
              <CommandGroup heading="Search parameters">
                {availableToAdd.map((p) => (
                  <CommandItem
                    key={`${p.resourceType}:${p.name}`}
                    value={p.name}
                    onSelect={() => {
                      const next = {
                        ...(filterOptions.fhirSearchParams || {}),
                        [p.name]: { operator: p.operators?.[0], value: '' }
                      };
                      onFilterChange({ ...filterOptions, fhirSearchParams: next });
                      // Mark this parameter as newly added
                      setNewlyAddedParams(prev => new Set(prev).add(p.name));
                      setAddOpen(false);
                      setSearch('');
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-gray-500">{p.type} {p.resourceType !== 'any' ? `(${p.resourceType})` : ''}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
