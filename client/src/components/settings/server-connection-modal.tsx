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
import { apiRequest } from "@/lib/queryClient";
import { 
  Globe, 
  Shield, 
  Key, 
  Server, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  EyeOff
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
  const [selectedTab, setSelectedTab] = useState("browse");
  const [selectedServer, setSelectedServer] = useState<typeof predefinedServers[0] | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
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
    mutationFn: (data: ServerFormData) => apiRequest('/api/fhir/servers', {
      method: 'POST',
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
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir/servers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir/connection/test"] });
      toast({
        title: "Server Added",
        description: "FHIR server connection has been configured successfully.",
      });
      onOpenChange(false);
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
    createServerMutation.mutate(data);
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

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="browse">Browse Servers</TabsTrigger>
            <TabsTrigger value="configure">Configure Connection</TabsTrigger>
            <TabsTrigger value="existing">Existing Servers</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-4">
            <div className="grid gap-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Featured Servers</h3>
                <div className="grid gap-3">
                  {predefinedServers.filter(s => s.featured).map((server, index) => (
                    <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleServerSelect(server)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Globe className="h-8 w-8 text-blue-600" />
                            <div>
                              <h4 className="font-medium">{server.name}</h4>
                              <p className="text-sm text-gray-600">{server.description}</p>
                              <p className="text-xs text-gray-400 mt-1">{server.url}</p>
                            </div>
                          </div>
                          <Badge variant="secondary">
                            <Shield className="h-3 w-3 mr-1" />
                            Public
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-2">Other Options</h3>
                <div className="grid gap-3">
                  {predefinedServers.filter(s => !s.featured).map((server, index) => (
                    <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleServerSelect(server)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {server.custom ? <Key className="h-6 w-6 text-green-600" /> : <Globe className="h-6 w-6 text-blue-600" />}
                            <div>
                              <h4 className="font-medium">{server.name}</h4>
                              <p className="text-sm text-gray-600">{server.description}</p>
                            </div>
                          </div>
                          {server.custom && (
                            <Badge variant="outline">
                              <Key className="h-3 w-3 mr-1" />
                              Custom
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="configure" className="space-y-4">
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
                <Button type="submit" disabled={createServerMutation.isPending}>
                  {createServerMutation.isPending ? "Connecting..." : "Add Server"}
                </Button>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="existing" className="space-y-4">
            <div className="space-y-3">
              {existingServers?.map((server) => (
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
                        <Button variant="outline" size="sm">
                          {server.isActive ? "Disconnect" : "Connect"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!existingServers || existingServers.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  No servers configured yet. Add a server from the Browse or Configure tabs.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}