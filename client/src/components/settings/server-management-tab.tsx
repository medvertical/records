import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Server, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Edit,
  Trash2,
  Plus,
  Save,
  RefreshCw,
  TestTube,
  Globe,
  Power,
  PowerOff,
  Eye,
  EyeOff
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ServerSettings {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  authType: 'none' | 'basic' | 'bearer';
  username?: string;
  password?: string;
  token?: string;
}

interface ServerManagementTabProps {
  onServersChange?: (servers: ServerSettings[]) => void;
}

// ============================================================================
// Component
// ============================================================================

export function ServerManagementTab({ onServersChange }: ServerManagementTabProps) {
  const { toast } = useToast();
  
  // State management
  const [servers, setServers] = useState<ServerSettings[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  
  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerSettings | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<Partial<ServerSettings>>({
    name: '',
    url: '',
    authType: 'none',
    username: '',
    password: '',
    token: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  // Load servers on mount
  useEffect(() => {
    loadServers();
  }, []);

  // Notify parent of changes
  useEffect(() => {
    onServersChange?.(servers);
  }, [servers, onServersChange]);

  // ========================================================================
  // Data Loading
  // ========================================================================

  const loadServers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/servers');
      if (response.ok) {
        const data = await response.json();
        setServers(data);
      }
    } catch (error) {
      console.error('Failed to load servers:', error);
      toast({
        title: "Error",
        description: "Failed to load servers",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================================================
  // Server Operations
  // ========================================================================

  const addServer = () => {
    setFormData({
      name: '',
      url: '',
      authType: 'none',
      username: '',
      password: '',
      token: ''
    });
    setIsAddDialogOpen(true);
  };

  const editServer = (server: ServerSettings) => {
    setEditingServer(server);
    setFormData({
      name: server.name,
      url: server.url,
      authType: server.authType,
      username: server.username || '',
      password: server.password || '',
      token: server.token || ''
    });
    setIsEditDialogOpen(true);
  };

  const deleteServer = async (serverId: string) => {
    try {
      const response = await fetch(`/api/servers/${serverId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setServers(prev => prev.filter(s => s.id !== serverId));
        toast({
          title: "Success",
          description: "Server deleted successfully",
        });
      } else {
        throw new Error('Failed to delete server');
      }
    } catch (error) {
      console.error('Failed to delete server:', error);
      toast({
        title: "Error",
        description: "Failed to delete server",
        variant: "destructive",
      });
    }
  };

  const toggleServerActive = async (serverId: string) => {
    try {
      const server = servers.find(s => s.id === serverId);
      if (!server) return;

      const response = await fetch(`/api/servers/${serverId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...server,
          isActive: !server.isActive
        }),
      });

      if (response.ok) {
        setServers(prev => prev.map(s => 
          s.id === serverId ? { ...s, isActive: !s.isActive } : s
        ));
        toast({
          title: "Success",
          description: `Server ${!server.isActive ? 'activated' : 'deactivated'} successfully`,
        });
      } else {
        throw new Error('Failed to update server');
      }
    } catch (error) {
      console.error('Failed to update server:', error);
      toast({
        title: "Error",
        description: "Failed to update server",
        variant: "destructive",
      });
    }
  };

  const testServerConnection = async (server: ServerSettings) => {
    setIsTesting(server.id);
    try {
      const response = await fetch('/api/servers/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(server),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Connection Test",
          description: result.success ? "Connection successful" : "Connection failed",
          variant: result.success ? "default" : "destructive",
        });
      } else {
        throw new Error('Test failed');
      }
    } catch (error) {
      console.error('Failed to test server connection:', error);
      toast({
        title: "Test Failed",
        description: "Failed to test server connection",
        variant: "destructive",
      });
    } finally {
      setIsTesting(null);
    }
  };

  const saveServer = async () => {
    setIsSaving(true);
    try {
      const url = editingServer ? `/api/servers/${editingServer.id}` : '/api/servers';
      const method = editingServer ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const savedServer = await response.json();
        
        if (editingServer) {
          setServers(prev => prev.map(s => s.id === editingServer.id ? savedServer : s));
        } else {
          setServers(prev => [...prev, savedServer]);
        }
        
        setIsAddDialogOpen(false);
        setIsEditDialogOpen(false);
        setEditingServer(null);
        
        toast({
          title: "Success",
          description: `Server ${editingServer ? 'updated' : 'added'} successfully`,
        });
      } else {
        throw new Error('Failed to save server');
      }
    } catch (error) {
      console.error('Failed to save server:', error);
      toast({
        title: "Error",
        description: "Failed to save server",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ========================================================================
  // Form Handlers
  // ========================================================================

  const handleFormChange = (field: keyof ServerSettings, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      authType: 'none',
      username: '',
      password: '',
      token: ''
    });
    setEditingServer(null);
  };

  // ========================================================================
  // Render Helpers
  // ========================================================================

  const getAuthTypeLabel = (authType: string) => {
    switch (authType) {
      case 'none': return 'No Authentication';
      case 'basic': return 'Basic Authentication';
      case 'bearer': return 'Bearer Token';
      default: return 'Unknown';
    }
  };

  const getServerStatusBadge = (server: ServerSettings) => {
    if (server.isActive) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
    } else {
      return <Badge variant="secondary">Inactive</Badge>;
    }
  };

  const renderServerCard = (server: ServerSettings) => (
    <Card key={server.id} className={server.isActive ? 'border-green-200' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            <CardTitle className="text-lg">{server.name}</CardTitle>
            {getServerStatusBadge(server)}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testServerConnection(server)}
              disabled={isTesting === server.id}
            >
              {isTesting === server.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => editServer(server)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteServer(server.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-mono">{server.url}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{getAuthTypeLabel(server.authType)}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <Switch
            checked={server.isActive}
            onCheckedChange={() => toggleServerActive(server.id)}
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderServerDialog = (isEdit: boolean) => (
    <Dialog open={isEdit ? isEditDialogOpen : isAddDialogOpen} onOpenChange={isEdit ? setIsEditDialogOpen : setIsAddDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Server' : 'Add New Server'}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update server configuration' : 'Configure a new FHIR server connection'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="server-name">Server Name</Label>
            <Input
              id="server-name"
              value={formData.name || ''}
              onChange={(e) => handleFormChange('name', e.target.value)}
              placeholder="My FHIR Server"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="server-url">Server URL</Label>
            <Input
              id="server-url"
              value={formData.url || ''}
              onChange={(e) => handleFormChange('url', e.target.value)}
              placeholder="https://hapi.fhir.org/baseR4"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="auth-type">Authentication Type</Label>
            <Select
              value={formData.authType || 'none'}
              onValueChange={(value) => handleFormChange('authType', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Authentication</SelectItem>
                <SelectItem value="basic">Basic Authentication</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {formData.authType === 'basic' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username || ''}
                  onChange={(e) => handleFormChange('username', e.target.value)}
                  placeholder="username"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password || ''}
                    onChange={(e) => handleFormChange('password', e.target.value)}
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
            </>
          )}
          
          {formData.authType === 'bearer' && (
            <div className="space-y-2">
              <Label htmlFor="token">Bearer Token</Label>
              <Input
                id="token"
                type="password"
                value={formData.token || ''}
                onChange={(e) => handleFormChange('token', e.target.value)}
                placeholder="your-bearer-token"
              />
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={resetForm}>
            Cancel
          </Button>
          <Button onClick={saveServer} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEdit ? 'Update' : 'Add'} Server
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ========================================================================
  // Render
  // ========================================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading servers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Manage FHIR Servers</h3>
          <Button onClick={addServer}>
            <Plus className="h-4 w-4 mr-2" />
            Add Server
          </Button>
        </div>
        
        {servers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Server className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No servers configured</h3>
              <p className="text-muted-foreground text-center mb-4">
                Add a FHIR server to start validating resources
              </p>
              <Button onClick={addServer}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Server
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {servers.map(renderServerCard)}
          </div>
        )}
      </div>
      
      {/* Dialogs */}
      {renderServerDialog(false)}
      {renderServerDialog(true)}
    </div>
  );
}
