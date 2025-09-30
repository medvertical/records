import { LayoutList, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type ViewMode = 'list' | 'groups';

interface GroupModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  disabled?: boolean;
}

export function GroupModeToggle({ mode, onChange, disabled = false }: GroupModeToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={mode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onChange('list')}
            disabled={disabled}
            className="gap-2"
          >
            <LayoutList className="h-4 w-4" />
            <span className="hidden sm:inline">Resource List</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>View resources as a list with validation details</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={mode === 'groups' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onChange('groups')}
            disabled={disabled}
            className="gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Message Groups</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Group resources by identical validation messages</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
