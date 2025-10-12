import { useState, useCallback } from 'react';
import { RefreshCw, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResourceEditor } from './ResourceEditor';
import { useResourceActions } from '@/hooks/use-resource-actions';
import { useServerData } from '@/hooks/use-server-data';

// ============================================================================
// Types
// ============================================================================

export interface ResourceDetailActionsProps {
  resourceType: string;
  resourceId: string;
  resource: any;
  versionId?: string;
  onEditSuccess?: (updatedResource: any) => void;
  onRevalidateSuccess?: () => void;
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
  onEditSuccess,
  onRevalidateSuccess,
  className,
}: ResourceDetailActionsProps) {
  const { activeServer } = useServerData();
  const [editorOpen, setEditorOpen] = useState(false);

  const {
    revalidateResource,
    editResource,
    isRevalidating,
    isEditing,
  } = useResourceActions({
    serverId: activeServer?.id || 0,
    resourceType,
    resourceId,
    onEditSuccess: (updatedResource) => {
      setEditorOpen(false);
      onEditSuccess?.(updatedResource);
    },
    onRevalidateSuccess,
  });

  const handleEdit = useCallback(() => {
    setEditorOpen(true);
  }, []);

  const handleEditorClose = useCallback(() => {
    setEditorOpen(false);
  }, []);

  const handleSave = useCallback(async (updatedResource: any) => {
    await editResource(updatedResource, versionId);
  }, [editResource, versionId]);

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={handleEdit}
          disabled={isEditing || !activeServer}
          className="gap-2"
        >
          <Edit className="h-4 w-4" />
          Edit
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={revalidateResource}
          disabled={isRevalidating || !activeServer}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRevalidating ? 'animate-spin' : ''}`} />
          {isRevalidating ? 'Revalidating...' : 'Revalidate'}
        </Button>
      </div>

      <ResourceEditor
        open={editorOpen}
        onOpenChange={handleEditorClose}
        resourceType={resourceType}
        resourceId={resourceId}
        initialResource={resource}
        onSave={handleSave}
        versionId={versionId}
      />
    </div>
  );
}
