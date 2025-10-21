import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useServerData } from '@/hooks/use-server-data';
import { Plus, Loader2, Server } from 'lucide-react';
import { ServerList } from './server-list';
import { ServerForm } from './server-form';
import { useServerOperations } from './server-operations';
import { testFhirConnection, handleConnectionTestError, handleConnectionTestSuccess } from './connection-testing';

// ============================================================================
// Types
// ============================================================================

interface ServerManagementTabProps {
  onServersChange?: (servers: any[]) => void;
}

interface ServerFormData {
  name: string;
  url: string;
  fhirVersion?: 'R4' | 'R5' | 'R6';
  authType: 'none' | 'basic' | 'bearer' | 'oauth2';
  username?: string;
  password?: string;
  token?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
}

interface FhirServer {
  id: number | string;
  name: string;
  url: string;
  fhirVersion?: string;
  isActive: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ServerManagementTab({ onServersChange }: ServerManagementTabProps) {
  // State management
  const [editingServer, setEditingServer] = useState<FhirServer | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [urlValidationStatus, setUrlValidationStatus] = useState<{ isValid: boolean; error?: string; warning?: string }>({ isValid: true });

  // Server data hook
  const { servers: existingServers, refreshServerData } = useServerData();

  // Server operations hook
  const {
    createServerMutation,
    updateServerMutation,
    deleteServerMutation,
    connectServerMutation,
    disconnectServerMutation
  } = useServerOperations({ existingServers, refreshServerData });

  // Handlers
  const handleAddNewServer = () => {
    setIsAddingNew(true);
    setEditingServer(null);
  };

  const handleEditServer = (server: FhirServer) => {
    setEditingServer(server);
    setIsAddingNew(false);
  };

  const handleCancel = () => {
    setIsAddingNew(false);
    setEditingServer(null);
    setUrlValidationStatus({ isValid: true });
  };

  const handleSubmit = (data: ServerFormData) => {
    if (editingServer) {
      updateServerMutation.mutate({ ...data, id: editingServer.id });
    } else {
      createServerMutation.mutate(data);
    }
    
    // Reset form state
    handleCancel();
  };

  const handleConnectServer = (serverId: number) => {
    setConnectingId(serverId);
    connectServerMutation.mutate(serverId, {
      onSettled: () => setConnectingId(null)
    });
  };

  const handleDisconnectServer = (serverId: number) => {
    setDisconnectingId(serverId);
    disconnectServerMutation.mutate(serverId, {
      onSettled: () => setDisconnectingId(null)
    });
  };

  const handleDeleteServer = (serverId: number) => {
    deleteServerMutation.mutate(serverId);
  };

  const handleTestConnection = async (url: string) => {
    setIsTestingConnection(true);
    setUrlValidationStatus({ isValid: true });

    try {
      const result = await testFhirConnection(url);
      
      if (result.success) {
        setUrlValidationStatus({ isValid: true });
        handleConnectionTestSuccess(result.serverInfo, () => {}); // Toast will be handled by the form
      } else {
        setUrlValidationStatus({ isValid: false, error: result.error });
        handleConnectionTestError(result.error || 'Connection failed', () => {}); // Toast will be handled by the form
      }
    } catch (error: any) {
      console.error('Test connection error:', error);
      setUrlValidationStatus({ isValid: false, error: 'Failed to test connection' });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Check if any operation is pending
  const isAnyOperationPending = createServerMutation.isPending || 
                               updateServerMutation.isPending || 
                               deleteServerMutation.isPending ||
                               connectingId !== null ||
                               disconnectingId !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">Server Management</h2>
          <p className="text-muted-foreground mt-1">
            Manage FHIR server connections, test connectivity, and switch between servers
          </p>
        </div>
        <Button 
          onClick={handleAddNewServer} 
          disabled={isAnyOperationPending}
          className="flex items-center gap-2 disabled:opacity-50"
        >
          {createServerMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {createServerMutation.isPending ? "Adding..." : "Add Server"}
        </Button>
      </div>

      <ServerList
        servers={existingServers || []}
        isConnecting={connectingId !== null}
        isDisconnecting={disconnectingId !== null}
        isAnyOperationPending={isAnyOperationPending}
        connectingId={connectingId}
        disconnectingId={disconnectingId}
        onEditServer={handleEditServer}
        onConnectServer={handleConnectServer}
        onDisconnectServer={handleDisconnectServer}
        onDeleteServer={handleDeleteServer}
      />

      {/* Server Form Modal */}
      <Dialog open={isAddingNew || editingServer !== null} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              {editingServer ? 'Edit Server' : 'Add New Server'}
            </DialogTitle>
            <DialogDescription>
              {editingServer ? 'Update server configuration' : 'Configure a new FHIR server connection'}
            </DialogDescription>
          </DialogHeader>

          <ServerForm
            editingServer={editingServer}
            isSubmitting={createServerMutation.isPending || updateServerMutation.isPending}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onTestConnection={handleTestConnection}
            isTestingConnection={isTestingConnection}
            urlValidationStatus={urlValidationStatus}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
