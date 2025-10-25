import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export interface BatchEditState {
  selectionMode: boolean;
  selectedResources: Set<string>;
  batchEditDialogOpen: boolean;
  
  // Handlers
  toggleSelectionMode: () => void;
  handleSelectionChange: (resourceKey: string, selected: boolean) => void;
  handleBatchEdit: () => void;
  handleBatchEditComplete: () => void;
  
  // Setters (for external control)
  setSelectionMode: (value: boolean) => void;
  setSelectedResources: (value: Set<string>) => void;
  setBatchEditDialogOpen: (value: boolean) => void;
}

/**
 * Hook for managing batch edit selection and dialog state
 * Handles resource selection, batch operations, and dialog lifecycle
 */
export function useBatchEdit(): BatchEditState {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());
  const [batchEditDialogOpen, setBatchEditDialogOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      // Clear selection when exiting selection mode
      setSelectedResources(new Set());
    }
  }, [selectionMode]);
  
  const handleSelectionChange = useCallback((resourceKey: string, selected: boolean) => {
    setSelectedResources(prev => {
      const updated = new Set(prev);
      if (selected) {
        updated.add(resourceKey);
      } else {
        updated.delete(resourceKey);
      }
      return updated;
    });
  }, []);
  
  const handleBatchEdit = useCallback(() => {
    if (selectedResources.size === 0) {
      toast({
        title: 'No Resources Selected',
        description: 'Please select at least one resource to edit.',
        variant: 'destructive',
      });
      return;
    }
    setBatchEditDialogOpen(true);
  }, [selectedResources.size, toast]);
  
  const handleBatchEditComplete = useCallback(() => {
    setBatchEditDialogOpen(false);
    setSelectedResources(new Set());
    setSelectionMode(false);
    // Refetch resource list to see updated resources
    queryClient.invalidateQueries({
      queryKey: ['resources'],
    });
  }, [queryClient]);
  
  return {
    selectionMode,
    selectedResources,
    batchEditDialogOpen,
    
    toggleSelectionMode,
    handleSelectionChange,
    handleBatchEdit,
    handleBatchEditComplete,
    
    setSelectionMode,
    setSelectedResources,
    setBatchEditDialogOpen,
  };
}

