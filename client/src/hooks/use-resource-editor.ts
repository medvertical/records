import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

/**
 * Interface for resource editor hook parameters
 */
export interface UseResourceEditorParams {
  resource: any;
  resourceId: string;
  isEditMode: boolean;
  setIsEditMode: (value: boolean) => void;
  editedResource: any | null;
  setEditedResource: (value: any | null) => void;
  hasChanges: boolean;
  setHasChanges: (value: boolean) => void;
  autoRevalidate: boolean;
  onRevalidate?: () => Promise<void>;
}

/**
 * Interface for resource editor hook return value
 */
export interface UseResourceEditorReturn {
  handleEdit: () => void;
  handleSave: () => Promise<void>;
  handleView: () => void;
  handleResourceChange: (updatedResource: any) => void;
}

/**
 * Custom hook to handle resource editing functionality
 * Manages edit mode state, saving changes, and auto-revalidation
 */
export function useResourceEditor({
  resource,
  resourceId,
  isEditMode,
  setIsEditMode,
  editedResource,
  setEditedResource,
  hasChanges,
  setHasChanges,
  autoRevalidate,
  onRevalidate,
}: UseResourceEditorParams): UseResourceEditorReturn {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Handle entering edit mode
  const handleEdit = useCallback(() => {
    if (!resource) return;
    // Store the current resource data for editing
    const resourceData = resource.data || resource;
    setEditedResource(resourceData);
    setIsEditMode(true);
    setHasChanges(false);
  }, [resource, setEditedResource, setIsEditMode, setHasChanges]);

  // Handle saving edits
  const handleSave = useCallback(async () => {
    if (!editedResource || !resource) return;

    try {
      const response = await fetch(
        `/api/fhir/resources/${resource.resourceType}/${resource.resourceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editedResource),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save resource');
      }

      const updatedResource = await response.json();

      toast({
        title: "Resource saved",
        description: "Your changes have been saved successfully.",
      });

      // Refetch resource data
      queryClient.invalidateQueries({
        queryKey: ['/api/fhir/resources', resourceId],
      });

      // Exit edit mode
      setIsEditMode(false);
      setEditedResource(null);
      setHasChanges(false);

      // Auto-revalidate if enabled
      if (autoRevalidate && onRevalidate) {
        setTimeout(() => onRevalidate(), 500);
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    }
  }, [editedResource, resource, resourceId, autoRevalidate, onRevalidate, queryClient, toast, setIsEditMode, setEditedResource, setHasChanges]);

  // Handle canceling edit mode
  const handleView = useCallback(() => {
    if (hasChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to discard them?'
      );
      if (!confirmed) return;
    }
    setIsEditMode(false);
    setEditedResource(null);
    setHasChanges(false);
  }, [hasChanges, setIsEditMode, setEditedResource, setHasChanges]);

  // Handle resource changes in edit mode
  const handleResourceChange = useCallback((updatedResource: any) => {
    setEditedResource(updatedResource);
    setHasChanges(true);
  }, [setEditedResource, setHasChanges]);

  return {
    handleEdit,
    handleSave,
    handleView,
    handleResourceChange,
  };
}

