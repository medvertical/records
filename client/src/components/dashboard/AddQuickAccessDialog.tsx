import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  useResourceTypes, 
  useQuickAccessItems, 
  useUpdateQuickAccess,
  addQuickAccessItem,
  removeQuickAccessItem,
  reorderQuickAccessItems 
} from '@/hooks/use-quick-access-preferences';
import { Search, Plus, X, Loader2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getResourceTypeIcon } from '@/lib/resource-type-icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ManageQuickAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SortableQuickAccessItemProps {
  resourceType: string;
  onRemove: () => void;
  isOnlyItem: boolean;
  isPending: boolean;
}

function SortableQuickAccessItem({ resourceType, onRemove, isOnlyItem, isPending }: SortableQuickAccessItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: resourceType });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = getResourceTypeIcon(resourceType);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border transition-colors",
        isDragging && "bg-accent/50 shadow-lg"
      )}
    >
      <div className="flex items-center space-x-3 flex-1">
        <button
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{resourceType}</span>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={onRemove}
              disabled={isOnlyItem || isPending}
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          {isOnlyItem && (
            <TooltipContent>
              <p>At least one item must remain in quick access</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export function ManageQuickAccessDialog({ open, onOpenChange }: ManageQuickAccessDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: resourceTypesData, isLoading: isLoadingResourceTypes, error: resourceTypesError } = useResourceTypes();
  const { data: quickAccessData, isLoading: isLoadingQuickAccess } = useQuickAccessItems();
  const updateQuickAccess = useUpdateQuickAccess();

  const currentQuickAccessItems = quickAccessData?.quickAccessItems || [];
  const availableResourceTypes = resourceTypesData?.resourceTypes || [];

  // Setup drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter resource types based on search query
  const filteredResourceTypes = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableResourceTypes;
    }
    
    return availableResourceTypes.filter(resourceType =>
      resourceType.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [availableResourceTypes, searchQuery]);

  // Get resource types that are not already in quick access
  const availableToAdd = useMemo(() => {
    return filteredResourceTypes.filter(
      resourceType => !currentQuickAccessItems.includes(resourceType)
    );
  }, [filteredResourceTypes, currentQuickAccessItems]);

  const handleAddResourceType = (resourceType: string) => {
    const newItems = addQuickAccessItem(currentQuickAccessItems, resourceType);
    updateQuickAccess.mutate(newItems);
  };

  const handleRemoveResourceType = (resourceType: string) => {
    // Prevent removal if it's the only item
    if (currentQuickAccessItems.length <= 1) {
      return;
    }
    const newItems = removeQuickAccessItem(currentQuickAccessItems, resourceType);
    updateQuickAccess.mutate(newItems);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = currentQuickAccessItems.indexOf(active.id as string);
      const newIndex = currentQuickAccessItems.indexOf(over.id as string);

      const reorderedItems = reorderQuickAccessItems(currentQuickAccessItems, oldIndex, newIndex);
      updateQuickAccess.mutate(reorderedItems);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSearchQuery('');
  };

  const isOnlyItem = currentQuickAccessItems.length <= 1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Manage Quick Access</DialogTitle>
          <DialogDescription>
            Add or remove FHIR resource types from your quick access menu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search resource types..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Loading State */}
          {isLoadingResourceTypes && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <div className="text-sm text-muted-foreground">Loading resource types...</div>
            </div>
          )}

          {/* Error State */}
          {resourceTypesError && (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-destructive">
                Failed to load resource types. Please ensure you're connected to a FHIR server.
              </div>
            </div>
          )}

          {/* Two Column Layout */}
          {!isLoadingResourceTypes && !resourceTypesError && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Available to Add */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Available to Add ({availableToAdd.length})
                </h3>
                <ScrollArea className="h-64 border rounded-md">
                  <div className="p-2 space-y-1">
                    {availableToAdd.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        {searchQuery ? 'No matching resource types found' : 'All available resource types are already in quick access'}
                      </div>
                    ) : (
                      availableToAdd.map((resourceType) => {
                        const Icon = getResourceTypeIcon(resourceType);
                        return (
                          <div
                            key={resourceType}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                            onClick={() => handleAddResourceType(resourceType)}
                          >
                            <div className="flex items-center space-x-3">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{resourceType}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddResourceType(resourceType);
                              }}
                              disabled={updateQuickAccess.isPending}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Currently in Quick Access */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Currently in Quick Access ({currentQuickAccessItems.length})
                </h3>
                <ScrollArea className="h-64 border rounded-md">
                  <div className="p-2 space-y-1">
                    {currentQuickAccessItems.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        No items in quick access
                      </div>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={currentQuickAccessItems}
                          strategy={verticalListSortingStrategy}
                        >
                          {currentQuickAccessItems.map((resourceType) => (
                            <SortableQuickAccessItem
                              key={resourceType}
                              resourceType={resourceType}
                              onRemove={() => handleRemoveResourceType(resourceType)}
                              isOnlyItem={isOnlyItem}
                              isPending={updateQuickAccess.isPending}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Keep the old export for backward compatibility
export const AddQuickAccessDialog = ManageQuickAccessDialog;
