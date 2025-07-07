import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  PowerOff
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<ServerFormData>({
    defaultValues: {
      authType: 'none'
    }
  });

  const authType = watch('authType');

  const { data: existingServers } = useQuery<FhirServer[]>({
    queryKey: ["/api/fhir/servers"],
  });

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
      queryClient.invalidateQueries({ queryKey: ["/api/fhir/servers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir/connection/test"] });
      toast({
        title: "Server Added",
        description: "FHIR server connection has been configured successfully.",
      });
      setIsAddingNew(false);
      setEditingServer(null);
      reset();
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to configure server connection.",
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
      queryClient.invalidateQueries({ queryKey: ["/api/fhir/servers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir/connection/test"] });
      toast({
        title: "Server Updated",
        description: "FHIR server settings have been updated successfully.",
      });
      setIsAddingNew(false);
      setEditingServer(null);
      reset();
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update server settings.",
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
      queryClient.invalidateQueries({ queryKey: ["/api/fhir/servers"] });
      toast({
        title: "Server Deleted",
        description: "FHIR server connection removed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete server",
        variant: "destructive",
      });
    }
  });

  const connectServerMutation = useMutation({
    mutationFn: (serverId: number) => {
      return fetch(`/api/fhir/servers/${serverId}/activate`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir/servers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir/connection/test"] });
      toast({
        title: "Server Connected",
        description: "Successfully connected to FHIR server",
      });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to connect to server",
        variant: "destructive",
      });
    }
  });

  const disconnectServerMutation = useMutation({
    mutationFn: (serverId: number) => {
      return fetch(`/api/fhir/servers/${serverId}/deactivate`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir/servers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir/connection/test"] });
      toast({
        title: "Server Disconnected",
        description: "Successfully disconnected from FHIR server",
      });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to disconnect from server",
        variant: "destructive",
      });
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
    setIsAddingNew(true);
    setEditingServer(null);
    reset();
    setSelectedTab('configure');
  };

  const handleEditServer = (server: FhirServer) => {
    setEditingServer(server);
    setIsAddingNew(false);
    setValue('name', server.name);
    setValue('url', server.url);
    setValue('authType', 'none'); // Default since we don't store auth details
    setSelectedTab('configure');
  };

  const handleTestConnection = async () => {
    const url = watch('url');
    if (!url) {
      toast({
        title: "Missing URL",
        description: "Please enter a server URL to test.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await testConnectionMutation.mutateAsync(url);
      if (result.connected) {
        toast({
          title: "Connection Successful",
          description: `Connected to FHIR ${result.version || 'R4'} server`,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "Unable to connect to server",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Failed to test server connection",
        variant: "destructive",
      });
    }
  };

  const onSubmit = (data: ServerFormData) => {
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
              <Button onClick={handleAddNewServer} className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                Add Server
              </Button>
            </div>
            
            <div className="space-y-3">
              {existingServers?.sort((a, b) => a.name.localeCompare(b.name)).map((server) => (
                <Card key={server.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${server.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <div>
                          <h4 className="font-medium">{server.name}</h4>
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
                          onClick={() => handleEditServer(server)}
                          className="flex items-center gap-1"
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </Button>
                        {server.isActive ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => disconnectServerMutation.mutate(server.id)}
                            disabled={disconnectServerMutation.isPending}
                            className="flex items-center gap-1 text-orange-600 hover:text-orange-700"
                          >
                            <PowerOff className="h-3 w-3" />
                            {disconnectServerMutation.isPending ? "Disconnecting..." : "Disconnect"}
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => connectServerMutation.mutate(server.id)}
                            disabled={connectServerMutation.isPending}
                            className="flex items-center gap-1 text-green-600 hover:text-green-700"
                          >
                            <Power className="h-3 w-3" />
                            {connectServerMutation.isPending ? "Connecting..." : "Connect"}
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => deleteServerMutation.mutate(server.id)}
                          disabled={server.isActive || deleteServerMutation.isPending}
                          className="flex items-center gap-1 text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          {deleteServerMutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                    <Input
                      {...register("url", { required: "Server URL is required" })}
                      placeholder="https://your-fhir-server.com/fhir"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={isTestingConnection}
                    >
                      {isTestingConnection ? "Testing..." : "Test"}
                    </Button>
                  </div>
                  {errors.url && (
                    <p className="text-sm text-red-600">{errors.url.message}</p>
                  )}
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
                <Button type="submit" disabled={createServerMutation.isPending || updateServerMutation.isPending} className="flex items-center gap-2">
                  <Server className="h-4 w-4" />
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