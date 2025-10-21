/**
 * FhirServerList Component
 * 
 * FHIR-specific wrapper for ServerListContainer.
 * Handles FHIR server CRUD operations (connect/disconnect/edit/delete).
 */

import React from 'react';
import { Server } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ServerListContainer } from './ServerListContainer';
import { ServerItemProps } from './ServerItem';

// ============================================================================
// Types
// ============================================================================

interface FhirServer {
  id: number | string;
  name: string;
  url: string;
  fhirVersion?: string;
  isActive: boolean;
}

interface FhirServerListProps {
  servers: FhirServer[];
  connectingId: number | string | null;
  disconnectingId: number | string | null;
  isAnyOperationPending: boolean;
  onEditServer: (server: FhirServer) => void;
  onConnectServer: (serverId: number | string) => void;
  onDisconnectServer: (serverId: number | string) => void;
  onDeleteServer: (serverId: number | string) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function FhirServerList({
  servers,
  connectingId,
  disconnectingId,
  isAnyOperationPending,
  onEditServer,
  onConnectServer,
  onDisconnectServer,
  onDeleteServer
}: FhirServerListProps) {
  const { toast } = useToast();

  /**
   * Handle connect with validation
   */
  const handleConnect = (server: FhirServer) => {
    if (server.isActive) {
      toast({
        title: "Server Already Connected",
        description: `"${server.name}" is already the active server.`,
        variant: "default",
      });
      return;
    }
    onConnectServer(server.id);
  };

  /**
   * Handle disconnect with validation
   */
  const handleDisconnect = (server: FhirServer) => {
    if (!server.isActive) {
      toast({
        title: "Server Not Connected",
        description: `"${server.name}" is not currently connected.`,
        variant: "default",
      });
      return;
    }
    onDisconnectServer(server.id);
  };

  /**
   * Handle delete with confirmation
   */
  const handleDelete = (server: FhirServer) => {
    if (server.isActive) {
      toast({
        title: "Deleting Active Server",
        description: `"${server.name}" will be disconnected and deleted.`,
        variant: "default",
      });
    }
    onDeleteServer(server.id);
  };

  /**
   * Map FHIR servers to ServerItem props
   */
  const serverItems: ServerItemProps[] = servers
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((server) => {
      const isConnecting = connectingId === server.id;
      const isDisconnecting = disconnectingId === server.id;
      const isLoading = isConnecting || isDisconnecting;

      return {
        type: 'fhir' as const,
        id: server.id,
        name: server.name,
        url: server.url,
        version: server.fhirVersion,
        status: server.isActive ? ('active' as const) : ('unknown' as const),
        isActive: server.isActive,
        reorderable: false,
        testable: false,
        toggleable: false,
        isLoading,
        isOperationPending: isAnyOperationPending,
        onConnect: () => handleConnect(server),
        onDisconnect: () => handleDisconnect(server),
        onEdit: () => onEditServer(server),
        onDelete: () => handleDelete(server),
      };
    });

  return (
    <ServerListContainer
      servers={serverItems}
      enableDragDrop={false}
      emptyStateMessage="No FHIR servers configured"
      emptyStateSubMessage="Add your first server to get started"
      emptyStateIcon={Server}
    />
  );
}

