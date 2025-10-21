/**
 * ServersTab Component
 * 
 * Manages all backend connections Records uses:
 * 1. FHIR Server List - Full CRUD for FHIR servers (active server highlighted in list)
 * 2. Terminology Servers - Code system resolution for validation
 * 3. Server Diagnostics - Connection status and statistics
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, AlertTriangle, Server, Activity, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useServerData } from '@/hooks/use-server-data';
import { useServerOperations } from '@/components/settings/server-operations';
import { testFhirConnection, handleConnectionTestSuccess, handleConnectionTestError } from '@/components/settings/connection-testing';
import { SectionTitle, TabHeader } from '../shared';
import { ServerForm } from '../server-form';
import { FhirServerList, TerminologyServerList } from '../servers';
import type { TerminologyServer } from '@shared/validation-settings';

interface ServersTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
  hideHeader?: boolean;
  saveCounter?: number;
  onSaveComplete?: () => void;
  onSaveError?: (error: string) => void;
  isActive?: boolean;  // Whether this tab is currently visible
}

interface FhirServer {
  id: number | string; // API returns string, but operations expect number
  name: string;
  url: string;
  fhirVersion?: string;
  isActive: boolean;
  authType?: 'none' | 'basic' | 'bearer' | 'oauth';
  username?: string;
  password?: string;
  token?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
}

export function ServersTab({ onDirtyChange, hideHeader = false, saveCounter = 0, onSaveComplete, onSaveError, isActive = true }: ServersTabProps) {
  const { toast } = useToast();
  const [terminologyServers, setTerminologyServers] = useState<TerminologyServer[]>([]);
  const [loadingTermServers, setLoadingTermServers] = useState(true);

  // FHIR Server Management State
  // Only enable connection testing when tab is active to avoid overwhelming backend
  const { servers: existingServers, isLoading: isLoadingServers } = useServerData({ 
    enableConnectionTest: isActive 
  });
  
  // Debug logging
  useEffect(() => {
    console.log('[ServersTab] existingServers:', existingServers);
    console.log('[ServersTab] isLoadingServers:', isLoadingServers);
  }, [existingServers, isLoadingServers]);

  // Servers use immediate CRUD - acknowledge save immediately (only once per saveCounter change)
  const [previousSaveCounter, setPreviousSaveCounter] = useState(0);
  
  useEffect(() => {
    if (saveCounter && saveCounter > 0 && saveCounter !== previousSaveCounter) {
      console.log('[ServersTab] Save acknowledged (servers use immediate CRUD)');
      setPreviousSaveCounter(saveCounter);
      // Servers save immediately via CRUD operations, so just acknowledge
      onSaveComplete?.();
    }
  }, [saveCounter, previousSaveCounter, onSaveComplete]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingServer, setEditingServer] = useState<FhirServer | null>(null);
  const [connectingId, setConnectingId] = useState<number | string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<number | string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [urlValidationStatus, setUrlValidationStatus] = useState<{ isValid: boolean; error?: string }>({ isValid: true });

  // Server operations hook
  const {
    createServerMutation,
    updateServerMutation,
    deleteServerMutation,
    connectServerMutation,
    disconnectServerMutation,
  } = useServerOperations({ existingServers: existingServers || [] });

  // Load terminology servers
  useEffect(() => {
    loadTerminologyServers();
  }, []);

  const loadTerminologyServers = async () => {
    try {
      setLoadingTermServers(true);
      const response = await fetch('/api/validation/settings');
      if (response.ok) {
        const data = await response.json();
        setTerminologyServers(data.terminologyServers || []);
      }
    } catch (error) {
      console.error('Error loading terminology servers:', error);
    } finally {
      setLoadingTermServers(false);
    }
  };

  const handleTerminologyServersChange = async (updatedServers: TerminologyServer[]) => {
    setTerminologyServers(updatedServers);
    onDirtyChange?.(true);
    
    try {
      const response = await fetch('/api/validation/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terminologyServers: updatedServers }),
      });
      
      if (!response.ok) throw new Error('Failed to save terminology servers');
    } catch (error) {
      console.error('Error saving terminology servers:', error);
      toast({
        title: 'Save Failed',
        description: 'Failed to save terminology server changes',
        variant: 'destructive',
      });
    }
  };

  const handleTerminologyServersSave = async () => {
    // Save is handled in onChange
  };

  // FHIR Server Management Handlers
  const handleAddNewServer = () => {
    setEditingServer(null);
    setIsAddingNew(true);
    setUrlValidationStatus({ isValid: true });
  };

  const handleEditServer = (server: FhirServer) => {
    setEditingServer(server);
    setIsAddingNew(false);
    setUrlValidationStatus({ isValid: true });
  };

  const handleCancel = () => {
    setIsAddingNew(false);
    setEditingServer(null);
    setUrlValidationStatus({ isValid: true });
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingServer) {
        await updateServerMutation.mutateAsync({ id: editingServer.id, data });
      } else {
        await createServerMutation.mutateAsync(data);
      }
      handleCancel();
      onDirtyChange?.(true);
    } catch (error) {
      console.error('Server operation failed:', error);
    }
  };

  const handleConnectServer = (serverId: number | string) => {
    setConnectingId(serverId);
    connectServerMutation.mutate(typeof serverId === 'string' ? parseInt(serverId) : serverId, {
      onSettled: () => {
        setConnectingId(null);
        onDirtyChange?.(true);
      }
    });
  };

  const handleDisconnectServer = (serverId: number | string) => {
    setDisconnectingId(serverId);
    disconnectServerMutation.mutate(typeof serverId === 'string' ? parseInt(serverId) : serverId, {
      onSettled: () => {
        setDisconnectingId(null);
        onDirtyChange?.(true);
      }
    });
  };

  const handleDeleteServer = (serverId: number | string) => {
    deleteServerMutation.mutate(typeof serverId === 'string' ? parseInt(serverId) : serverId);
    onDirtyChange?.(true);
  };

  const handleTestFhirConnection = async (url: string) => {
    setIsTestingConnection(true);
    setUrlValidationStatus({ isValid: true });

    try {
      const result = await testFhirConnection(url);
      
      if (result.success) {
        setUrlValidationStatus({ isValid: true });
        handleConnectionTestSuccess(result.serverInfo, toast);
      } else {
        setUrlValidationStatus({ isValid: false, error: result.error });
        handleConnectionTestError(result.error || 'Connection failed', toast);
      }
    } catch (error: any) {
      console.error('Test connection error:', error);
      setUrlValidationStatus({ isValid: false, error: 'Failed to test connection' });
      handleConnectionTestError(error.message || 'Failed to test connection', toast);
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
    <div className={hideHeader ? "space-y-8" : "space-y-6"}>
      {!hideHeader && (
        <TabHeader 
          title="Server Configuration"
          subtitle="Manage FHIR servers, terminology services, and connection settings"
        />
      )}
      
      <div className="space-y-8">
        {/* 1. FHIR Server List */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <SectionTitle 
            title="FHIR Server List" 
            helpText="Manage all available FHIR server connections. Add, edit, or remove servers. The active server is used for validation and data operations."
          />
          <Button 
            onClick={handleAddNewServer} 
            disabled={isAnyOperationPending}
            className="flex items-center gap-2 disabled:opacity-50"
            size="sm"
            variant="outline"
          >
            {createServerMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {createServerMutation.isPending ? "Adding..." : "Add Server"}
          </Button>
        </div>

        {isLoadingServers ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <FhirServerList
            servers={existingServers || []}
            connectingId={connectingId}
            disconnectingId={disconnectingId}
            isAnyOperationPending={isAnyOperationPending}
            onEditServer={handleEditServer}
            onConnectServer={handleConnectServer}
            onDisconnectServer={handleDisconnectServer}
            onDeleteServer={handleDeleteServer}
          />
        )}

        {/* Server Form Modal */}
        <Dialog open={isAddingNew || editingServer !== null} onOpenChange={(open) => !open && handleCancel()}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingServer ? 'Edit FHIR Server' : 'Add FHIR Server'}
              </DialogTitle>
              <DialogDescription>
                {editingServer ? 'Update FHIR server configuration' : 'Configure a new FHIR server connection'}
              </DialogDescription>
            </DialogHeader>

            <ServerForm
              editingServer={editingServer}
              isSubmitting={createServerMutation.isPending || updateServerMutation.isPending}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              onTestConnection={handleTestFhirConnection}
              isTestingConnection={isTestingConnection}
              urlValidationStatus={urlValidationStatus}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* 2. Terminology Servers */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <SectionTitle 
            title="Terminology Servers" 
            helpText="Servers used to resolve CodeSystems and ValueSets during validation. The first server in the list is used as primary; others act as fallback. Drag to reorder."
          />
          <Button 
            onClick={() => {/* This will be handled by TerminologyServerList */}} 
            size="sm"
            variant="outline"
            id="add-terminology-server-button"
          >
            <Plus className="h-4 w-4" />
            Add Server
          </Button>
        </div>
        {loadingTermServers ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TerminologyServerList
            servers={terminologyServers}
            onChange={handleTerminologyServersChange}
            onSave={handleTerminologyServersSave}
          />
        )}
      </div>

      {/* 3. Server Diagnostics (Optional) */}
      <Accordion type="single" collapsible>
        <AccordionItem value="diagnostics" className="border-none">
          <AccordionTrigger className="py-2 hover:no-underline">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="text-sm font-semibold">Server Diagnostics</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground mb-3">
              Shows recent response times and connection information for configured servers.
            </p>

            {/* Terminology Servers Diagnostics */}
            {terminologyServers.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Terminology Servers</h4>
                <div className="space-y-2">
                  {terminologyServers.map((server, index) => (
                    <Card key={server.id} className="p-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {index === 0 ? 'Primary' : `Fallback ${index}`}
                            </span>
                            {index === 0 && (
                              <Badge variant="default" className="h-4 text-xs">Primary</Badge>
                            )}
                          </div>
                          <p className="font-medium mt-1">{server.name}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">URL</span>
                          <p className="text-xs font-mono break-all">{server.url}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {terminologyServers.length === 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  No terminology servers configured. Add servers above to see diagnostics.
                </AlertDescription>
              </Alert>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      </div>
    </div>
  );
}
