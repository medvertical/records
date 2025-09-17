import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerData } from "@/hooks/use-server-data";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { 
  Globe, 
  Shield, 
  Key, 
  Server, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Loader2
} from "lucide-react";

interface ServerConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FhirServer {
  id: number;
  name: string;
  url: string;
  isActive: boolean;
}

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

const predefinedServers = [
  {
    name: "HAPI FHIR R4 (Fire.ly)",
    url: "https://server.fire.ly",
    description: "Public test server with R4 sample data",
    authType: "none" as const,
    featured: true
  },
  {
    name: "HAPI FHIR R4 (UHN)",
    url: "http://hapi.fhir.org/baseR4",
    description: "University Health Network test server",
    authType: "none" as const,
    featured: true
  },
  {
    name: "Synthea Sample Data",
    url: "https://r4.smarthealthit.org",
    description: "SMART on FHIR test server with synthetic data",
    authType: "none" as const,
    featured: false
  },
  {
    name: "Custom Server",
    url: "",
    description: "Configure your own FHIR server connection",
    authType: "none" as const,
    featured: false,
    custom: true
  }
];

export default function ServerConnectionModal({ open, onOpenChange }: ServerConnectionModalProps) {
  const [selectedTab, setSelectedTab] = useState("servers");
  const [selectedServer, setSelectedServer] = useState<typeof predefinedServers[0] | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [editingServer, setEditingServer] = useState<FhirServer | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [retryAttempts, setRetryAttempts] = useState<{ [key: string]: number }>({});
  const [retryErrors, setRetryErrors] = useState<{ [key: string]: any }>({});
  const [isRetrying, setIsRetrying] = useState<{ [key: string]: boolean }>({});
  const [urlValidationStatus, setUrlValidationStatus] = useState<{ isValid: boolean; error?: string; warning?: string }>({ isValid: true });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { servers: existingServers, refreshServerData } = useServerData();

  // Enhanced URL validation utility
  const validateFhirUrl = (url: string): { isValid: boolean; error?: string; normalizedUrl?: string } => {
    if (!url || !url.trim()) {
      return { isValid: false, error: "URL is required" };
    }

    const trimmedUrl = url.trim();
    
    // Basic URL format validation
    try {
      const urlObj = new URL(trimmedUrl);
      
      // Check protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { 
          isValid: false, 
          error: "URL must use HTTP or HTTPS protocol" 
        };
      }
      
      // Check for common FHIR server patterns
      const pathname = urlObj.pathname.toLowerCase();
      const hasFhirPath = pathname.includes('/fhir') || 
                         pathname.includes('/base') || 
                         pathname.includes('/r4') || 
                         pathname.includes('/stu3') ||
                         pathname.includes('/dstu2');
      
      // Normalize URL (remove trailing slash, ensure proper format)
      let normalizedUrl = trimmedUrl;
      if (normalizedUrl.endsWith('/')) {
        normalizedUrl = normalizedUrl.slice(0, -1);
      }
      
      // Add common FHIR endpoints if missing
      if (!hasFhirPath) {
        if (normalizedUrl.endsWith('/fhir')) {
          // Already has /fhir, keep as is
        } else if (normalizedUrl.endsWith('/baseR4')) {
          // Already has /baseR4, keep as is
        } else {
          // Suggest adding a FHIR endpoint
          return {
            isValid: true,
            normalizedUrl,
            error: "Consider adding a FHIR endpoint (e.g., /fhir, /baseR4) to your URL"
          };
        }
      }
      
      return { isValid: true, normalizedUrl };
      
    } catch (error) {
      return { 
        isValid: false, 
        error: "Invalid URL format. Please enter a valid URL (e.g., https://hapi.fhir.org/baseR4)" 
      };
    }
  };

  // Real-time URL validation handler
  const handleUrlChange = (url: string) => {
    if (!url || url.trim() === '') {
      setUrlValidationStatus({ isValid: true });
      return;
    }

    const validation = validateFhirUrl(url);
    if (validation.isValid) {
      if (validation.error) {
        // Valid URL but with suggestion
        setUrlValidationStatus({ 
          isValid: true, 
          warning: validation.error 
        });
      } else {
        setUrlValidationStatus({ isValid: true });
      }
    } else {
      setUrlValidationStatus({ 
        isValid: false, 
        error: validation.error 
      });
    }
  };

  // Retry utility function with exponential backoff
  const retryWithBackoff = async (
    operation: () => Promise<any>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    operationKey: string
  ): Promise<any> => {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Update retry attempts state
        setRetryAttempts(prev => ({ ...prev, [operationKey]: attempt }));
        
        if (attempt > 0) {
          // Set retry loading state
          setIsRetrying(prev => ({ ...prev, [operationKey]: true }));
          
          // Show retry notification
          const operationType = operationKey.includes('connect') ? 'connection' : 'disconnection';
          const serverName = existingServers?.find((s: any) => operationKey.includes(s.id.toString()))?.name || 'server';
          
          toast({
            title: "Retrying Operation",
            description: `Attempting ${operationType} to ${serverName} (${attempt + 1}/${maxRetries + 1})`,
            variant: "default",
          });
          
          // Exponential backoff delay
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const result = await operation();
        
        // Clear retry state on success
        setRetryAttempts(prev => {
          const newState = { ...prev };
          delete newState[operationKey];
          return newState;
        });
        setRetryErrors(prev => {
          const newState = { ...prev };
          delete newState[operationKey];
          return newState;
        });
        setIsRetrying(prev => {
          const newState = { ...prev };
          delete newState[operationKey];
          return newState;
        });
        
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Store error for manual retry
        setRetryErrors(prev => ({ ...prev, [operationKey]: error }));
        
        // Clear retry loading state on final failure
        if (attempt === maxRetries) {
          setIsRetrying(prev => {
            const newState = { ...prev };
            delete newState[operationKey];
            return newState;
          });
        }
        
        // Don't retry on certain error types
        const retryErrorData = (error as any).response?.data || error;
        const retryErrorType = retryErrorData.type || 'UnknownError';
        const isRetryableError = !['ValidationError', 'NotFoundError', 'AuthenticationError'].includes(retryErrorType);
        
        if (!isRetryableError || attempt === maxRetries) {
          break;
        }
      }
    }
    
    throw lastError;
  };

  // Manual retry function
  const handleManualRetry = async (operationKey: string, serverId: number, operation: 'connect' | 'disconnect') => {
    try {
      // Set retry loading state
      setIsRetrying(prev => ({ ...prev, [operationKey]: true }));
      
      const serverName = existingServers?.find((s: any) => s.id === serverId)?.name || 'Unknown';
      const operationType = operation === 'connect' ? 'connection' : 'disconnection';
      
      // Show retry start notification
      toast({
        title: "Retrying Operation",
        description: `Attempting ${operationType} to "${serverName}"...`,
        variant: "default",
      });
      
      if (operation === 'connect') {
        await connectServerMutation.mutateAsync(serverId);
      } else {
        await disconnectServerMutation.mutateAsync(serverId);
      }
    } catch (error) {
      // Error handling is done in the mutation's onError handler
      console.error(`Manual retry failed for ${operation}:`, error);
    } finally {
      // Clear retry loading state
      setIsRetrying(prev => {
        const newState = { ...prev };
        delete newState[operationKey];
        return newState;
      });
    }
  };

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<ServerFormData>({
    defaultValues: {
      authType: 'none'
    }
  });

  const authType = watch('authType');

  const createServerMutation = useMutation({
    mutationFn: async (data: ServerFormData) => {
      const response = await fetch('/api/fhir/servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          url: data.url,
          authConfig: {
            type: data.authType,
            username: data.username,
            password: data.password,
            token: data.token,
            clientId: data.clientId,
            clientSecret: data.clientSecret,
            tokenUrl: data.tokenUrl
          }
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create server');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Use refetchQueries to prevent data flashing while updating
      queryClient.refetchQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/fhir/servers" || 
          query.queryKey[0] === "/api/fhir/connection/test"
      });
      
      toast({
        title: "Server Added Successfully",
        description: `FHIR server has been configured and is ready to use.`,
        variant: "default",
      });
      
      setIsAddingNew(false);
      setEditingServer(null);
      setUrlValidationStatus({ isValid: true });
      reset();
      refreshServerData();
    },
    onError: (error: any) => {
      console.error('Server creation error:', error);
      
      // Extract detailed error information
      const createErrorData = (error as any).response?.data || error;
      const createErrorMessage = createErrorData.error || createErrorData.message || error.message || "Failed to configure server connection.";
      const createErrorType = createErrorData.type || 'UnknownError';
      const isDatabaseError = createErrorData.isDatabaseError || false;
      
      // Provide specific error messages based on error type
      let title = "Connection Failed";
      let description = createErrorMessage;
      
      if (isDatabaseError) {
        title = "Database Connection Issue";
        description = "The server was created but may not persist due to database connectivity issues. Please check your database connection.";
      } else if (createErrorType === 'ValidationError') {
        title = "Invalid Server Configuration";
        description = "Please check your server URL and authentication settings.";
      } else if (createErrorType === 'NetworkError') {
        title = "Network Error";
        description = "Unable to reach the server. Please check your network connection and server URL.";
      } else if (createErrorType === 'AuthenticationError') {
        title = "Authentication Failed";
        description = "The provided credentials are invalid. Please check your username and password.";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    }
  });

  const updateServerMutation = useMutation({
    mutationFn: async (data: ServerFormData & { id: number }) => {
      const response = await fetch(`/api/fhir/servers/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          url: data.url,
          authConfig: {
            type: data.authType,
            username: data.username,
            password: data.password,
            token: data.token,
            clientId: data.clientId,
            clientSecret: data.clientSecret,
            tokenUrl: data.tokenUrl
          }
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update server');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Use refetchQueries to prevent data flashing while updating
      queryClient.refetchQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/fhir/servers" || 
          query.queryKey[0] === "/api/fhir/connection/test"
      });
      
      toast({
        title: "Server Updated Successfully",
        description: `FHIR server settings have been updated successfully.`,
        variant: "default",
      });
      
      setIsAddingNew(false);
      setEditingServer(null);
      setUrlValidationStatus({ isValid: true });
      reset();
      refreshServerData();
    },
    onError: (error: any) => {
      console.error('Server update error:', error);
      
      // Extract detailed error information
      const updateErrorData = (error as any).response?.data || error;
      const updateErrorMessage = updateErrorData.error || updateErrorData.message || error.message || "Failed to update server settings.";
      const updateErrorType = updateErrorData.type || 'UnknownError';
      const isDatabaseError = updateErrorData.isDatabaseError || false;
      
      // Provide specific error messages based on error type
      let title = "Update Failed";
      let description = updateErrorMessage;
      
      if (isDatabaseError) {
        title = "Database Connection Issue";
        description = "The server settings were updated but may not persist due to database connectivity issues. Please check your database connection.";
      } else if (createErrorType === 'ValidationError') {
        title = "Invalid Server Configuration";
        description = "Please check your server URL and authentication settings.";
      } else if (createErrorType === 'NetworkError') {
        title = "Network Error";
        description = "Unable to reach the server. Please check your network connection and server URL.";
      } else if (createErrorType === 'AuthenticationError') {
        title = "Authentication Failed";
        description = "The provided credentials are invalid. Please check your username and password.";
      } else if (errorType === 'NotFoundError') {
        title = "Server Not Found";
        description = "The server you're trying to update no longer exists. Please refresh the page.";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    }
  });

  const deleteServerMutation = useMutation({
    mutationFn: (serverId: number) => {
      return fetch(`/api/fhir/servers/${serverId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      // Use refetchQueries to prevent data flashing while updating
      queryClient.refetchQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/fhir/servers" || 
          query.queryKey[0] === "/api/fhir/connection/test"
      });
      
      const deletedServer = existingServers?.find(s => s.id === serverId);
      toast({
        title: "Server Deleted Successfully",
        description: `FHIR server "${deletedServer?.name || 'Unknown'}" has been removed from your configuration.`,
        variant: "default",
      });
      
      refreshServerData();
    },
    onError: (error: any) => {
      console.error('Server deletion error:', error);
      
      // Extract detailed error information
      const errorData = error.response?.data || error;
      const errorMessage = errorData.error || errorData.message || error.message || "Failed to delete server";
      const errorType = errorData.type || 'UnknownError';
      const isDatabaseError = createErrorData.isDatabaseError || false;
      
      // Provide specific error messages based on error type
      let title = "Deletion Failed";
      let description = createErrorMessage;
      
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

  const connectServerMutation = useMutation({
    mutationFn: async (serverId: number) => {
      setConnectingId(serverId);
      const operationKey = `connect-${serverId}`;
      
      return await retryWithBackoff(
        async () => {
          const res = await fetch(`/api/fhir/servers/${serverId}/activate`, { method: 'POST' });
          if (!res.ok) {
            const errorText = await res.text();
            const errorData = errorText ? JSON.parse(errorText) : { error: 'Failed to activate server' };
            throw new Error(errorData.error || errorText || 'Failed to activate server');
          }
          return await res.json();
        },
        3, // maxRetries
        1000, // baseDelay
        operationKey
      );
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
      
      // Use refetchQueries to get fresh data without flashing
      queryClient.refetchQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/fhir/servers" || 
          query.queryKey[0] === "/api/fhir/connection/test"
      });
      
      const connectedServer = existingServers?.find((s: any) => s.id === serverId);
      toast({
        title: "Server Connected Successfully",
        description: `Successfully connected to "${connectedServer?.name || 'Unknown'}" FHIR server.`,
        variant: "default",
      });
      
      // Force refresh using the shared hook
      refreshServerData();
    },
    onError: (err, serverId) => {
      console.error('Server connection error:', err);
      
      // Revert optimistic update on error
      queryClient.refetchQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/fhir/servers" 
      });
      
      // Extract detailed error information
      const errorData = err.response?.data || err;
      const errorMessage = errorData.error || errorData.message || err.message || "Failed to connect to server";
      const errorType = errorData.type || 'UnknownError';
      const isDatabaseError = createErrorData.isDatabaseError || false;
      
      // Provide specific error messages based on error type
      let title = "Connection Failed";
      let description = createErrorMessage;
      
      if (isDatabaseError) {
        title = "Database Connection Issue";
        description = "The server connection may not persist due to database connectivity issues. Please check your database connection.";
      } else if (errorType === 'NotFoundError') {
        title = "Server Not Found";
        description = "The server you're trying to connect to no longer exists. Please refresh the page.";
      } else if (createErrorType === 'NetworkError') {
        title = "Network Error";
        description = "Unable to reach the server. Please check your network connection and server URL.";
      } else if (createErrorType === 'AuthenticationError') {
        title = "Authentication Failed";
        description = "The server credentials are invalid. Please check your authentication settings.";
      } else if (errorType === 'ServerUnavailableError') {
        title = "Server Unavailable";
        description = "The FHIR server is currently unavailable. Please try again later or check if the server is running.";
      }
      
      // Check if this is a retryable error and show retry option
        const connectErrorData = (err as any).response?.data || err;
        const connectErrorType = connectErrorData.type || 'UnknownError';
        const isRetryableError = !['ValidationError', 'NotFoundError', 'AuthenticationError'].includes(connectErrorType);
      const operationKey = `connect-${serverId}`;
      const attemptCount = retryAttempts[operationKey] || 0;
      
      if (isRetryableError && attemptCount < 3) {
        // Show retry option for retryable errors
      toast({
          title,
          description: `${description} (Attempt ${attemptCount + 1}/4)`,
          variant: "destructive",
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleManualRetry(operationKey, serverId, 'connect')}
              className="ml-2"
            >
              Retry
            </Button>
          ),
        });
      } else {
        toast({
          title,
          description,
        variant: "destructive",
      });
      }
    },
    onSettled: () => {
      setConnectingId(null);
    }
  });

  const disconnectServerMutation = useMutation({
    mutationFn: async (serverId: number) => {
      setDisconnectingId(serverId);
      const operationKey = `disconnect-${serverId}`;
      
      return await retryWithBackoff(
        async () => {
          const res = await fetch(`/api/fhir/servers/${serverId}/deactivate`, { method: 'POST' });
          if (!res.ok) {
            const errorText = await res.text();
            const errorData = errorText ? JSON.parse(errorText) : { error: 'Failed to deactivate server' };
            throw new Error(errorData.error || errorText || 'Failed to deactivate server');
          }
          return await res.json();
        },
        3, // maxRetries
        1000, // baseDelay
        operationKey
      );
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
      
      // Use refetchQueries to get fresh data without flashing
      queryClient.refetchQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/fhir/servers" || 
          query.queryKey[0] === "/api/fhir/connection/test"
      });
      
      const disconnectedServer = existingServers?.find((s: any) => s.id === serverId);
      toast({
        title: "Server Disconnected Successfully",
        description: `Successfully disconnected from "${disconnectedServer?.name || 'Unknown'}" FHIR server.`,
        variant: "default",
      });
      
      // Force refresh using the shared hook
      refreshServerData();
    },
    onError: (err, serverId) => {
      console.error('Server disconnection error:', err);
      
      // Revert optimistic update on error
      queryClient.refetchQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/fhir/servers" 
      });
      
      // Extract detailed error information
      const errorData = err.response?.data || err;
      const errorMessage = errorData.error || errorData.message || err.message || "Failed to disconnect from server";
      const errorType = errorData.type || 'UnknownError';
      const isDatabaseError = createErrorData.isDatabaseError || false;
      
      // Provide specific error messages based on error type
      let title = "Disconnection Failed";
      let description = createErrorMessage;
      
      if (isDatabaseError) {
        title = "Database Connection Issue";
        description = "The server disconnection may not persist due to database connectivity issues. Please check your database connection.";
      } else if (errorType === 'NotFoundError') {
        title = "Server Not Found";
        description = "The server you're trying to disconnect from no longer exists. Please refresh the page.";
      } else if (createErrorType === 'NetworkError') {
        title = "Network Error";
        description = "Unable to communicate with the server. Please check your network connection.";
      }
      
      // Check if this is a retryable error and show retry option
        const connectErrorData = (err as any).response?.data || err;
        const connectErrorType = connectErrorData.type || 'UnknownError';
        const isRetryableError = !['ValidationError', 'NotFoundError', 'AuthenticationError'].includes(connectErrorType);
      const operationKey = `disconnect-${serverId}`;
      const attemptCount = retryAttempts[operationKey] || 0;
      
      if (isRetryableError && attemptCount < 3) {
        // Show retry option for retryable errors
      toast({
          title,
          description: `${description} (Attempt ${attemptCount + 1}/4)`,
          variant: "destructive",
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleManualRetry(operationKey, serverId, 'disconnect')}
              className="ml-2"
            >
              Retry
            </Button>
          ),
        });
      } else {
        toast({
          title,
          description,
        variant: "destructive",
      });
      }
    },
    onSettled: () => {
      setDisconnectingId(null);
    }
  });

  const testConnectionMutation = useMutation({
    mutationFn: (url: string) => {
      setIsTestingConnection(true);
      return fetch(`/api/fhir/connection/test-custom?url=${encodeURIComponent(url)}`)
        .then(res => res.json())
        .finally(() => setIsTestingConnection(false));
    }
  });

  const handleServerSelect = (server: typeof predefinedServers[0]) => {
    setSelectedServer(server);
    if (!server.custom) {
      setValue('name', server.name);
      setValue('url', server.url);
      setValue('authType', server.authType);
      setSelectedTab('configure');
    } else {
      setValue('name', '');
      setValue('url', '');
      setValue('authType', 'none');
      setSelectedTab('configure');
    }
  };

  const handleAddNewServer = () => {
    // Check if any operations are pending
    const isAnyOperationPending = createServerMutation.isPending || updateServerMutation.isPending || 
      deleteServerMutation.isPending || connectingId !== null || disconnectingId !== null ||
      Object.values(isRetrying).some(Boolean);
    
    if (isAnyOperationPending) {
      toast({
        title: "Operation in Progress",
        description: "Please wait for the current operation to complete before adding new servers.",
        variant: "destructive",
      });
      return;
    }
    
    setIsAddingNew(true);
    setEditingServer(null);
    setUrlValidationStatus({ isValid: true });
    reset();
    setSelectedTab('configure');
  };

  const handleEditServer = (server: FhirServer) => {
    // Check if any operations are pending
    const isAnyOperationPending = createServerMutation.isPending || updateServerMutation.isPending || 
      deleteServerMutation.isPending || connectingId !== null || disconnectingId !== null ||
      Object.values(isRetrying).some(Boolean);
    
    if (isAnyOperationPending) {
      toast({
        title: "Operation in Progress",
        description: "Please wait for the current operation to complete before editing servers.",
        variant: "destructive",
      });
      return;
    }
    
    setEditingServer(server);
    setIsAddingNew(false);
    setValue('name', server.name);
    setValue('url', server.url);
    setValue('authType', 'none'); // Default since we don't store auth details
    setUrlValidationStatus({ isValid: true });
    setSelectedTab('configure');
  };

  const handleTestConnection = async () => {
    const url = watch('url');
    if (!url) {
      toast({
        title: "Missing Server URL",
        description: "Please enter a valid FHIR server URL to test the connection.",
        variant: "destructive",
      });
      return;
    }

    // Enhanced URL validation
    const urlValidation = validateFhirUrl(url);
    if (!urlValidation.isValid) {
      toast({
        title: "Invalid Server URL",
        description: urlValidation.error || "Please enter a valid FHIR server URL",
        variant: "destructive",
      });
      return;
    }
    
    // Use normalized URL for testing
    const testUrl = urlValidation.normalizedUrl || url;
    if (testUrl !== url) {
      setValue('url', testUrl);
    }

    try {
      const result = await testConnectionMutation.mutateAsync(testUrl);
      if (result.connected) {
        toast({
          title: "Connection Test Successful",
          description: `Successfully connected to FHIR ${result.version || 'R4'} server at ${testUrl}`,
          variant: "default",
        });
      } else {
        // Enhanced error handling for connection test failures
        const errorMessage = result.error || "Unable to connect to server";
        let title = "Connection Failed";
        let description = createErrorMessage;
        
        // Provide specific error messages based on error type
        if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')) {
          title = "Server Unreachable";
          description = "The server is not responding. Please check if the server is running and the URL is correct.";
        } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
          title = "Invalid Server URL";
          description = "The server URL appears to be incorrect or the FHIR endpoint is not available.";
        } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
          title = "Authentication Required";
          description = "The server requires authentication. Please configure your credentials.";
        } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
          title = "Access Denied";
          description = "You don't have permission to access this server. Please check your credentials.";
        } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
          title = "Server Error";
          description = "The server encountered an internal error. Please try again later.";
        } else if (errorMessage.includes('SSL') || errorMessage.includes('certificate')) {
          title = "SSL/TLS Error";
          description = "There's an issue with the server's SSL certificate. Please check the server configuration.";
        }
        
        toast({
          title,
          description,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Test connection error:', error);
      
      // Enhanced error handling for network/request failures
      let title = "Connection Error";
      let description = "Failed to test server connection";
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        title = "Network Error";
        description = "Unable to reach the server. Please check your network connection and server URL.";
      } else if (error.message?.includes('timeout')) {
        title = "Connection Timeout";
        description = "The server took too long to respond. Please check if the server is running.";
      } else if (error.message?.includes('CORS')) {
        title = "CORS Error";
        description = "The server doesn't allow cross-origin requests. This may be a configuration issue.";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    }
  };

  const onSubmit = (data: ServerFormData) => {
    // Validate required fields
    if (!data.name?.trim()) {
      toast({
        title: "Missing Server Name",
        description: "Please enter a name for the FHIR server.",
        variant: "destructive",
      });
      return;
    }

    if (!data.url?.trim()) {
      toast({
        title: "Missing Server URL",
        description: "Please enter the URL of the FHIR server.",
        variant: "destructive",
      });
      return;
    }

    // Enhanced URL validation
    const urlValidation = validateFhirUrl(data.url);
    if (!urlValidation.isValid) {
      toast({
        title: "Invalid Server URL",
        description: urlValidation.error || "Please enter a valid FHIR server URL",
        variant: "destructive",
      });
      return;
    }
    
    // Use normalized URL if available
    if (urlValidation.normalizedUrl && urlValidation.normalizedUrl !== data.url) {
      setValue('url', urlValidation.normalizedUrl);
      data.url = urlValidation.normalizedUrl;
    }
    
    // Show warning if URL might need FHIR endpoint
    if (urlValidation.error && urlValidation.isValid) {
      toast({
        title: "URL Suggestion",
        description: urlValidation.error,
        variant: "default",
      });
    }

    // Validate authentication fields if required
    if (data.authType === 'basic' && (!data.username || !data.password)) {
      toast({
        title: "Missing Authentication Credentials",
        description: "Please enter both username and password for basic authentication.",
        variant: "destructive",
      });
      return;
    }

    if (data.authType === 'bearer' && !data.token) {
      toast({
        title: "Missing Bearer Token",
        description: "Please enter a bearer token for authentication.",
        variant: "destructive",
      });
      return;
    }

    if (editingServer) {
      updateServerMutation.mutate({ ...data, id: editingServer.id });
    } else {
      createServerMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Configure FHIR Server Connection
          </DialogTitle>
        </DialogHeader>

        <div className="w-full">
          {!isAddingNew && !editingServer ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Manage FHIR Servers</h3>
              <Button 
                onClick={handleAddNewServer} 
                disabled={createServerMutation.isPending || updateServerMutation.isPending || deleteServerMutation.isPending}
                className="flex items-center gap-2 disabled:opacity-50"
              >
                {createServerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                <Server className="h-4 w-4" />
                )}
                {createServerMutation.isPending ? "Adding..." : "Add Server"}
              </Button>
            </div>
            
            <div className="space-y-3">
              {existingServers?.sort((a, b) => a.name.localeCompare(b.name)).map((server) => {
                const isConnecting = connectingId === server.id;
                const isDisconnecting = disconnectingId === server.id;
                const connectRetryAttempts = retryAttempts[`connect-${server.id}`] || 0;
                const disconnectRetryAttempts = retryAttempts[`disconnect-${server.id}`] || 0;
                const hasRetryError = retryErrors[`connect-${server.id}`] || retryErrors[`disconnect-${server.id}`];
                const isRetryingConnect = isRetrying[`connect-${server.id}`] || false;
                const isRetryingDisconnect = isRetrying[`disconnect-${server.id}`] || false;
                
                // Comprehensive loading state check
                const isAnyOperationPending = isConnecting || isDisconnecting || 
                  isRetryingConnect || isRetryingDisconnect ||
                  createServerMutation.isPending || updateServerMutation.isPending || 
                  deleteServerMutation.isPending;

                return (
                  <Card key={server.id} className={isAnyOperationPending ? "opacity-75" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${server.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <div>
                            <h4 className="font-medium flex items-center gap-2">
                              {server.name}
                              {(isConnecting || isDisconnecting || isRetryingConnect || isRetryingDisconnect) && (
                                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                              )}
                              {hasRetryError && !isRetryingConnect && !isRetryingDisconnect && (
                                <AlertTriangle className="h-3 w-3 text-orange-500" />
                              )}
                            </h4>
                          <p className="text-sm text-gray-600">{server.url}</p>
                            {(connectRetryAttempts > 0 || disconnectRetryAttempts > 0) && (
                              <p className="text-xs text-orange-600">
                                Retry attempts: {connectRetryAttempts + disconnectRetryAttempts}
                                {(isRetryingConnect || isRetryingDisconnect) && " (Retrying...)"}
                              </p>
                            )}
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
                          onClick={() => handleEditServer(server)}
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
                              onClick={() => {
                                if (!server.isActive) {
                                  toast({
                                    title: "Server Not Connected",
                                    description: `"${server.name}" is not currently connected.`,
                                    variant: "default",
                                  });
                                  return;
                                }
                                disconnectServerMutation.mutate(server.id);
                              }}
                              disabled={isAnyOperationPending}
                              className="flex items-center gap-1 text-orange-600 hover:text-orange-700 disabled:opacity-50"
                            >
                              {(isDisconnecting || isRetryingDisconnect) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                            <PowerOff className="h-3 w-3" />
                              )}
                              {(isDisconnecting || isRetryingDisconnect) ? "Disconnecting..." : "Disconnect"}
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                              onClick={() => {
                                if (server.isActive) {
                                  toast({
                                    title: "Server Already Connected",
                                    description: `"${server.name}" is already the active server.`,
                                    variant: "default",
                                  });
                                  return;
                                }
                                connectServerMutation.mutate(server.id);
                              }}
                              disabled={isAnyOperationPending}
                              className="flex items-center gap-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                            >
                              {(isConnecting || isRetryingConnect) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                            <Power className="h-3 w-3" />
                              )}
                              {(isConnecting || isRetryingConnect) ? "Connecting..." : "Connect"}
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                            onClick={() => {
                              if (server.isActive) {
                                toast({
                                  title: "Cannot Delete Active Server",
                                  description: `Please disconnect from "${server.name}" before deleting it.`,
                                  variant: "destructive",
                                });
                                return;
                              }
                              deleteServerMutation.mutate(server.id);
                            }}
                            disabled={isAnyOperationPending}
                          className="flex items-center gap-1 text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                            {deleteServerMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                          <Trash2 className="h-3 w-3" />
                            )}
                          {deleteServerMutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
              {(!existingServers || existingServers.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  <Server className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No FHIR servers configured</p>
                  <p className="text-sm">Add your first server to get started</p>
                </div>
              )}
            </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">
                  {editingServer ? `Edit ${editingServer.name}` : 'Add New Server'}
                </h3>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setEditingServer(null);
                    setIsAddingNew(false);
                    setUrlValidationStatus({ isValid: true });
                    reset();
                  }}
                >
                  Back to Servers
                </Button>
              </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="name">Server Name</Label>
                  <Input
                    {...register("name", { required: "Server name is required" })}
                    placeholder="My FHIR Server"
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="url">Server URL</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                    <Input
                        {...register("url", { 
                          required: "Server URL is required",
                          onChange: (e) => handleUrlChange(e.target.value)
                        })}
                      placeholder="https://your-fhir-server.com/fhir"
                        className={`flex-1 ${
                          !urlValidationStatus.isValid 
                            ? 'border-red-500 focus:border-red-500' 
                            : urlValidationStatus.warning 
                            ? 'border-yellow-500 focus:border-yellow-500' 
                            : 'border-green-500 focus:border-green-500'
                        }`}
                      />
                      {/* Real-time validation feedback */}
                      {!urlValidationStatus.isValid && urlValidationStatus.error && (
                        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {urlValidationStatus.error}
                        </p>
                      )}
                      {urlValidationStatus.warning && (
                        <p className="text-sm text-yellow-600 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {urlValidationStatus.warning}
                        </p>
                      )}
                      {urlValidationStatus.isValid && !urlValidationStatus.warning && watch('url') && (
                        <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Valid FHIR server URL
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={isTestingConnection || !urlValidationStatus.isValid}
                      className="flex items-center gap-2 disabled:opacity-50"
                    >
                      {isTestingConnection ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Globe className="h-4 w-4" />
                      )}
                      {isTestingConnection ? "Testing..." : "Test"}
                    </Button>
                  </div>
                  {errors.url && (
                    <p className="text-sm text-red-600">{errors.url.message}</p>
                  )}
                  {/* URL examples and help text */}
                  <div className="mt-2 text-xs text-gray-500">
                    <p className="mb-1">Examples of valid FHIR server URLs:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>https://hapi.fhir.org/baseR4</li>
                      <li>https://server.fire.ly</li>
                      <li>https://r4.smarthealthit.org</li>
                      <li>https://your-server.com/fhir</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <Label htmlFor="authType">Authentication Type</Label>
                  <Select value={authType} onValueChange={(value) => setValue('authType', value as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Authentication</SelectItem>
                      <SelectItem value="basic">Basic Authentication</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                      <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {authType === 'basic' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input
                        {...register("username")}
                        placeholder="username"
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          {...register("password")}
                          type={showPassword ? "text" : "password"}
                          placeholder="password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {authType === 'bearer' && (
                  <div>
                    <Label htmlFor="token">Bearer Token</Label>
                    <Input
                      {...register("token")}
                      type={showPassword ? "text" : "password"}
                      placeholder="Bearer token"
                    />
                  </div>
                )}

                {authType === 'oauth2' && (
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="clientId">Client ID</Label>
                        <Input
                          {...register("clientId")}
                          placeholder="OAuth client ID"
                        />
                      </div>
                      <div>
                        <Label htmlFor="clientSecret">Client Secret</Label>
                        <Input
                          {...register("clientSecret")}
                          type={showPassword ? "text" : "password"}
                          placeholder="OAuth client secret"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="tokenUrl">Token URL</Label>
                      <Input
                        {...register("tokenUrl")}
                        placeholder="https://your-auth-server.com/oauth/token"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button 
                  type="submit" 
                  disabled={createServerMutation.isPending || updateServerMutation.isPending || deleteServerMutation.isPending || isTestingConnection} 
                  className="flex items-center gap-2 disabled:opacity-50"
                >
                  {(createServerMutation.isPending || updateServerMutation.isPending) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                  <Server className="h-4 w-4" />
                  )}
                  {(createServerMutation.isPending || updateServerMutation.isPending) ? "Saving..." : editingServer ? "Update Server" : "Add Server"}
                </Button>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
              </div>
            </form>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
