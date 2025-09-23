/**
 * Server Operations Component
 * 
 * Handles server CRUD operations (create, update, delete, connect, disconnect)
 * with proper error handling and optimistic updates.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types
// ============================================================================

interface ServerFormData {
  name: string;
  url: string;
  authType: 'none' | 'basic' | 'bearer' | 'oauth2';
  username?: string;
  password?: string;
  token?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
}

interface FhirServer {
  id: number;
  name: string;
  url: string;
  isActive: boolean;
}

interface ServerOperationsProps {
  existingServers: FhirServer[];
  refreshServerData: () => void;
}

// ============================================================================
// Server Operations Hook
// ============================================================================

export function useServerOperations({ existingServers, refreshServerData }: ServerOperationsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Create Server Mutation
  const createServerMutation = useMutation({
    mutationFn: async (data: ServerFormData) => {
      const response = await fetch('/api/fhir/servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorData = errorText ? JSON.parse(errorText) : { error: 'Failed to create server' };
        throw new Error(errorData.error || errorText || 'Failed to create server');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.refetchQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/fhir/servers" 
      });
      
      queryClient.invalidateQueries({ queryKey: ['validation-settings'] });
      
      toast({
        title: "✅ Server Added Successfully",
        description: `FHIR server "${data.name}" has been added to your configuration.`,
        variant: "default",
        duration: 4000,
      });
      
      refreshServerData();
    },
    onError: (error: any) => {
      console.error('Server creation error:', error);
      
      const errorData = error.response?.data || error;
      const errorMessage = errorData.error || errorData.message || error.message || "Failed to create server";
      
      toast({
        title: "Server Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Update Server Mutation
  const updateServerMutation = useMutation({
    mutationFn: async ({ id, ...data }: ServerFormData & { id: number }) => {
      const response = await fetch(`/api/fhir/servers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorData = errorText ? JSON.parse(errorText) : { error: 'Failed to update server' };
        throw new Error(errorData.error || errorText || 'Failed to update server');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.refetchQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/fhir/servers" 
      });
      
      queryClient.invalidateQueries({ queryKey: ['validation-settings'] });
      
      toast({
        title: "✅ Server Updated Successfully",
        description: `FHIR server "${data.name}" has been updated.`,
        variant: "default",
        duration: 4000,
      });
      
      refreshServerData();
    },
    onError: (error: any) => {
      console.error('Server update error:', error);
      
      const errorData = error.response?.data || error;
      const errorMessage = errorData.error || errorData.message || error.message || "Failed to update server";
      
      toast({
        title: "Server Update Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Delete Server Mutation
  const deleteServerMutation = useMutation({
    mutationFn: async (serverId: number) => {
      return fetch(`/api/fhir/servers/${serverId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: (_, serverId) => {
      queryClient.refetchQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/fhir/servers" || 
          query.queryKey[0] === "/api/fhir/connection/test"
      });
      
      queryClient.invalidateQueries({ queryKey: ['validation-settings'] });
      
      const deletedServer = existingServers?.find((s) => s.id === serverId);
      toast({
        title: "🗑️ Server Deleted Successfully",
        description: `FHIR server "${deletedServer?.name || 'Unknown'}" has been removed from your configuration.`,
        variant: "default",
        duration: 4000,
      });
      
      refreshServerData();
    },
    onError: (error: any) => {
      console.error('Server deletion error:', error);
      
      const errorData = error.response?.data || error;
      const errorMessage = errorData.error || errorData.message || error.message || "Failed to delete server";
      const errorType = errorData.type || 'UnknownError';
      const isDatabaseError = errorData.isDatabaseError || false;
      
      let title = "Deletion Failed";
      let description = errorMessage;
      
      if (isDatabaseError) {
        title = "Database Connection Issue";
        description = "The server deletion may not persist due to database connectivity issues. Please check your database connection.";
      } else if (errorType === 'NotFoundError') {
        title = "Server Not Found";
        description = "The server you're trying to delete no longer exists. Please refresh the page.";
      } else if (errorType === 'ForeignKeyConstraintError') {
        title = "Cannot Delete Server";
        description = "This server cannot be deleted because it has associated validation data. Please remove all validation results first.";
      } else if (errorType === 'ActiveServerError') {
        title = "Cannot Delete Active Server";
        description = "You cannot delete the currently active server. Please activate another server first.";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    }
  });

  // Connect Server Mutation
  const connectServerMutation = useMutation({
    mutationFn: async (serverId: number) => {
      const res = await fetch(`/api/fhir/servers/${serverId}/activate`, { method: 'POST' });
      if (!res.ok) {
        const errorText = await res.text();
        const errorData = errorText ? JSON.parse(errorText) : { error: 'Failed to activate server' };
        throw new Error(errorData.error || errorText || 'Failed to activate server');
      }
      return await res.json();
    },
    onMutate: async (serverId: number) => {
      // Cancel any outgoing refetches to avoid race conditions
      await queryClient.cancelQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/fhir/servers" 
      });
      
      // Optimistically update the server status to prevent flashing
      queryClient.setQueriesData(
        { predicate: (query) => query.queryKey[0] === "/api/fhir/servers" },
        (old: any) => {
          if (!old) return old;
          return old.map((server: any) => ({
            ...server,
            isActive: server.id === serverId
          }));
        }
      );
    },
    onSuccess: (data, serverId) => {
      console.log('Connect mutation successful, refreshing data...', data);
      
      queryClient.refetchQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/fhir/servers" || 
          query.queryKey[0] === "/api/fhir/connection/test"
      });
      
      queryClient.invalidateQueries({ queryKey: ['validation-settings'] });
      
      const connectedServer = existingServers?.find((s) => s.id === serverId);
      toast({
        title: "🔌 Server Connected Successfully",
        description: `Successfully connected to "${connectedServer?.name || 'Unknown'}" FHIR server. You can now validate resources against this server.`,
        variant: "default",
        duration: 4000,
      });
      
      refreshServerData();
    },
    onError: (err, serverId) => {
      console.error('Server connection error:', err);
      
      // Revert optimistic update on error
      queryClient.refetchQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/fhir/servers" 
      });
      
      queryClient.invalidateQueries({ queryKey: ['validation-settings'] });
      
      const errorData = (err as any).response?.data || err;
      const errorMessage = errorData.error || errorData.message || err.message || "Failed to connect to server";
      
      let title = "Connection Failed";
      let description = errorMessage;
      
      if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')) {
        title = "Server Unreachable";
        description = "Unable to communicate with the server. Please check if the server is running and accessible.";
      } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        title = "Server Not Found";
        description = "The server no longer exists. Please refresh the page and try again.";
      } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        title = "Authentication Failed";
        description = "Invalid credentials. Please check your authentication settings.";
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        title = "Access Denied";
        description = "You don't have permission to access this server. Please check your credentials.";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    }
  });

  // Disconnect Server Mutation
  const disconnectServerMutation = useMutation({
    mutationFn: async (serverId: number) => {
      const res = await fetch(`/api/fhir/servers/${serverId}/deactivate`, { method: 'POST' });
      if (!res.ok) {
        const errorText = await res.text();
        const errorData = errorText ? JSON.parse(errorText) : { error: 'Failed to deactivate server' };
        throw new Error(errorData.error || errorText || 'Failed to deactivate server');
      }
      return await res.json();
    },
    onMutate: async (serverId: number) => {
      // Cancel any outgoing refetches to avoid race conditions
      await queryClient.cancelQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/fhir/servers" 
      });
      
      // Optimistically update the server status to prevent flashing
      queryClient.setQueriesData(
        { predicate: (query) => query.queryKey[0] === "/api/fhir/servers" },
        (old: any) => {
          if (!old) return old;
          return old.map((server: any) => ({
            ...server,
            isActive: server.id === serverId ? false : server.isActive
          }));
        }
      );
    },
    onSuccess: (data, serverId) => {
      console.log('Disconnect mutation successful, refreshing data...', data);
      
      queryClient.refetchQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/fhir/servers" || 
          query.queryKey[0] === "/api/fhir/connection/test"
      });
      
      queryClient.invalidateQueries({ queryKey: ['validation-settings'] });
      
      const disconnectedServer = existingServers?.find((s) => s.id === serverId);
      toast({
        title: "🔌 Server Disconnected Successfully",
        description: `Successfully disconnected from "${disconnectedServer?.name || 'Unknown'}" FHIR server. You can connect to a different server or configure a new one.`,
        variant: "default",
        duration: 4000,
      });
      
      refreshServerData();
    },
    onError: (err, serverId) => {
      console.error('Server disconnection error:', err);
      
      // Revert optimistic update on error
      queryClient.refetchQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/fhir/servers" 
      });
      
      queryClient.invalidateQueries({ queryKey: ['validation-settings'] });
      
      const errorData = (err as any).response?.data || err;
      const errorMessage = errorData.error || errorData.message || err.message || "Failed to disconnect from server";
      
      let title = "Disconnection Failed";
      let description = errorMessage;
      
      if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')) {
        title = "Server Unreachable";
        description = "Unable to communicate with the server. The disconnection may have succeeded on the server side.";
      } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        title = "Server Not Found";
        description = "The server no longer exists. The disconnection may have already occurred.";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    }
  });

  return {
    createServerMutation,
    updateServerMutation,
    deleteServerMutation,
    connectServerMutation,
    disconnectServerMutation
  };
}
