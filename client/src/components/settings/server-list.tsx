import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  CheckCircle, 
  Edit, 
  Trash2, 
  Power, 
  PowerOff, 
  Loader2,
  Server
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types
// ============================================================================

interface FhirServer {
  id: number;
  name: string;
  url: string;
  isActive: boolean;
}

interface ServerListProps {
  servers: FhirServer[];
  isConnecting: boolean;
  isDisconnecting: boolean;
  isAnyOperationPending: boolean;
  connectingId: number | null;
  disconnectingId: number | null;
  onEditServer: (server: FhirServer) => void;
  onConnectServer: (serverId: number) => void;
  onDisconnectServer: (serverId: number) => void;
  onDeleteServer: (serverId: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function ServerList({
  servers,
  isConnecting,
  isDisconnecting,
  isAnyOperationPending,
  connectingId,
  disconnectingId,
  onEditServer,
  onConnectServer,
  onDisconnectServer,
  onDeleteServer
}: ServerListProps) {
  const { toast } = useToast();

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

  const handleDelete = (server: FhirServer) => {
    if (server.isActive) {
      toast({
        title: "Cannot Delete Active Server",
        description: `Please disconnect from "${server.name}" before deleting it.`,
        variant: "destructive",
      });
      return;
    }
    onDeleteServer(server.id);
  };

  if (!servers || servers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Server className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>No FHIR servers configured</p>
        <p className="text-sm">Add your first server to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {servers
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((server) => {
          const isConnectingThis = connectingId === server.id;
          const isDisconnectingThis = disconnectingId === server.id;

          return (
            <Card key={server.id} className={isAnyOperationPending ? "opacity-75" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${server.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div>
                      <h4 className="font-medium flex items-center gap-2">
                        {server.name}
                        {server.fhirVersion && (
                          <span className="text-xs">
                            {server.fhirVersion === 'R4' && '🔵'}
                            {server.fhirVersion === 'R5' && '🟢'}
                            {server.fhirVersion === 'R6' && '🟣'}
                            {' '}{server.fhirVersion}
                          </span>
                        )}
                        {(isConnectingThis || isDisconnectingThis) && (
                          <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                        )}
                      </h4>
                      <p className="text-sm text-gray-600">{server.url}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {server.isActive && (
                      <Badge variant="default">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onEditServer(server)}
                      disabled={isAnyOperationPending}
                      className="flex items-center gap-1 disabled:opacity-50"
                    >
                      <Edit className="h-3 w-3" />
                      Edit
                    </Button>
                    
                    {server.isActive ? (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDisconnect(server)}
                        disabled={isAnyOperationPending}
                        className="flex items-center gap-1 text-orange-600 hover:text-orange-700 disabled:opacity-50"
                      >
                        {isDisconnectingThis ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <PowerOff className="h-3 w-3" />
                        )}
                        {isDisconnectingThis ? "Disconnecting..." : "Disconnect"}
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleConnect(server)}
                        disabled={isAnyOperationPending}
                        className="flex items-center gap-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                      >
                        {isConnectingThis ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Power className="h-3 w-3" />
                        )}
                        {isConnectingThis ? "Connecting..." : "Connect"}
                      </Button>
                    )}
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDelete(server)}
                      disabled={isAnyOperationPending}
                      className="flex items-center gap-1 text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}
