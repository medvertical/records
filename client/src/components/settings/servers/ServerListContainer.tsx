/**
 * ServerListContainer Component
 * 
 * Generic container for server lists with optional drag-and-drop support.
 * Handles empty states and reordering logic.
 */

import React from 'react';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Server } from 'lucide-react';
import { ServerItem, ServerItemProps } from './ServerItem';

// ============================================================================
// Types
// ============================================================================

interface ServerListContainerProps {
  servers: ServerItemProps[];
  enableDragDrop?: boolean;
  emptyStateMessage?: string;
  emptyStateSubMessage?: string;
  emptyStateIcon?: React.ComponentType<{ className?: string }>;
  onReorder?: (newOrder: ServerItemProps[]) => void;
}

// ============================================================================
// Sortable Item Wrapper
// ============================================================================

function SortableServerItem({ server }: { server: ServerItemProps }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: server.id });

  const sortable = {
    attributes,
    listeners,
    setNodeRef,
    transform: CSS.Transform.toString(transform),
    transition,
    isDragging
  };

  return <ServerItem {...server} sortable={sortable} />;
}

// ============================================================================
// Main Component
// ============================================================================

export function ServerListContainer({
  servers,
  enableDragDrop = false,
  emptyStateMessage = 'No servers configured',
  emptyStateSubMessage = 'Add your first server to get started',
  emptyStateIcon: EmptyIcon = Server,
  onReorder
}: ServerListContainerProps) {
  // Drag & drop sensors (require mouse movement to prevent accidental drags)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    })
  );

  /**
   * Handle drag end event - reorder servers
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = servers.findIndex(s => s.id === active.id);
    const newIndex = servers.findIndex(s => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const newOrder = arrayMove(servers, oldIndex, newIndex);
    
    if (onReorder) {
      onReorder(newOrder);
    }

    console.log('[ServerListContainer] Reordered:', newOrder.map((s, i) => `${i + 1}. ${s.name}`));
  };

  // Empty state
  if (!servers || servers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <EmptyIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>{emptyStateMessage}</p>
        <p className="text-sm">{emptyStateSubMessage}</p>
      </div>
    );
  }

  // With drag & drop
  if (enableDragDrop && onReorder) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={servers.map(s => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {servers.map((server) => (
              <SortableServerItem key={server.id} server={server} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    );
  }

  // Without drag & drop
  return (
    <div className="space-y-3">
      {servers.map((server) => (
        <ServerItem key={server.id} {...server} />
      ))}
    </div>
  );
}

