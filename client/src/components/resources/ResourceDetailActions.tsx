import { Edit, Save, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RevalidateButton } from '@/components/ui/revalidate-button';
import { useServerData } from '@/hooks/use-server-data';

// ============================================================================
// Types
// ============================================================================

export interface ResourceDetailActionsProps {
  resourceType: string;
  resourceId: string;
  resource: any;
  versionId?: string;
  isEditMode?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onView?: () => void;
  onRevalidate?: () => void;
  isRevalidating?: boolean;
  canSave?: boolean;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function ResourceDetailActions({
  resourceType,
  resourceId,
  resource,
  versionId,
  isEditMode = false,
  onEdit,
  onSave,
  onView,
  onRevalidate,
  isRevalidating = false,
  canSave = false,
  className,
}: ResourceDetailActionsProps) {
  const { activeServer } = useServerData();

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        {!isEditMode ? (
          // View mode: Show Edit and Revalidate buttons
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              disabled={!activeServer}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>

            <RevalidateButton
              onClick={onRevalidate}
              isRevalidating={isRevalidating}
              disabled={!activeServer}
              size="sm"
              variant="outline"
            />
          </>
        ) : (
          // Edit mode: Show View and Save buttons
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onView}
              disabled={!activeServer}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              View
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={onSave}
              disabled={!canSave || !activeServer}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Save
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
