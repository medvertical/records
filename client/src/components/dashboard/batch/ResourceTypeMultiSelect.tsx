import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResourceTypeMultiSelectProps {
  selectedTypes: string[];
  onChange: (types: string[]) => void;
}

export function ResourceTypeMultiSelect({
  selectedTypes,
  onChange,
}: ResourceTypeMultiSelectProps) {
  const [open, setOpen] = useState(false);

  // Fetch resource counts
  const { data: resourceCounts, isLoading } = useQuery({
    queryKey: ['dashboard-resource-counts'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/resource-counts');
      if (!response.ok) throw new Error('Failed to fetch resource counts');
      return response.json();
    },
  });

  const resourceTypes = resourceCounts?.counts
    ? Object.entries(resourceCounts.counts)
        .map(([type, count]) => ({ type, count: count as number }))
        .filter(({ count }) => count > 0)
        .sort((a, b) => b.count - a.count)
    : [];

  const handleSelect = (type: string) => {
    if (selectedTypes.includes(type)) {
      onChange(selectedTypes.filter((t) => t !== type));
    } else {
      onChange([...selectedTypes, type]);
    }
  };

  const handleSelectAll = () => {
    onChange(resourceTypes.map((rt) => rt.type));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const handleRemove = (type: string) => {
    onChange(selectedTypes.filter((t) => t !== type));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedTypes.length === 0 ? (
              <span className="text-muted-foreground">
                Select resource types...
              </span>
            ) : (
              <span>{selectedTypes.length} type(s) selected</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search resource types..." />
            <CommandList>
              <CommandEmpty>
                {isLoading ? 'Loading...' : 'No resource types found.'}
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={handleSelectAll}
                  className="justify-between font-medium"
                >
                  Select All
                </CommandItem>
                <CommandItem
                  onSelect={handleClearAll}
                  className="justify-between font-medium"
                >
                  Clear All
                </CommandItem>
              </CommandGroup>
              <CommandGroup>
                {resourceTypes.map(({ type, count }) => (
                  <CommandItem
                    key={type}
                    value={type}
                    onSelect={() => handleSelect(type)}
                    className="justify-between"
                  >
                    <div className="flex items-center">
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedTypes.includes(type)
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      <span>{type}</span>
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {count.toLocaleString()}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected Types Display */}
      {selectedTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTypes.map((type) => {
            const resourceType = resourceTypes.find((rt) => rt.type === type);
            return (
              <Badge
                key={type}
                variant="default"
                className="gap-1 pr-1"
              >
                {type}
                {resourceType && (
                  <span className="text-xs opacity-70">
                    ({resourceType.count.toLocaleString()})
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                  onClick={() => handleRemove(type)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

