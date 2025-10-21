/**
 * TerminologyServerList Component
 * 
 * Terminology-specific wrapper for ServerListContainer.
 * Handles drag-and-drop reordering, testing, enable/disable, and CRUD operations.
 */

import React, { useState, useEffect } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import type { TerminologyServer } from '@shared/validation-settings';
import { ServerListContainer } from './ServerListContainer';
import { ServerItemProps } from './ServerItem';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types
// ============================================================================

interface TerminologyServerListProps {
  servers: TerminologyServer[];
  onChange: (servers: TerminologyServer[]) => void;
  onSave?: () => void;
  onAddServer?: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function TerminologyServerList({
  servers,
  onChange,
  onSave,
  onAddServer: onAddServerProp
}: TerminologyServerListProps) {
  const { toast } = useToast();
  const [localServers, setLocalServers] = useState<TerminologyServer[]>(servers);
  const [testingUrl, setTestingUrl] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<TerminologyServer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    enabled: true
  });

  // Expose handleAddServer via callback when button is clicked
  React.useEffect(() => {
    if (onAddServerProp) {
      const button = document.getElementById('add-terminology-server-button');
      if (button) {
        button.onclick = handleAddServer;
      }
    }
  }, [onAddServerProp]);

  // Update local state when props change
  useEffect(() => {
    setLocalServers(servers);
    setHasChanges(false);
  }, [servers]);

  /**
   * Handle reorder from drag & drop
   */
  const handleReorder = (reorderedItems: ServerItemProps[]) => {
    // Map back to TerminologyServer objects
    const reorderedServers = reorderedItems.map(item => {
      const server = localServers.find(s => s.id === item.id);
      return server!;
    }).filter(Boolean);

    setLocalServers(reorderedServers);
    onChange(reorderedServers);
    setHasChanges(true);
  };

  /**
   * Toggle server enabled/disabled
   */
  const handleToggle = (serverId: string, enabled: boolean) => {
    const updated = localServers.map(s =>
      s.id === serverId ? { ...s, enabled } : s
    );
    
    setLocalServers(updated);
    onChange(updated);
    setHasChanges(true);
  };


  /**
   * Edit server
   */
  const handleEdit = (serverId: string) => {
    const server = localServers.find(s => s.id === serverId);
    if (server) {
      setEditingServer(server);
      setFormData({
        name: server.name,
        url: server.url,
        enabled: server.enabled
      });
      setDialogOpen(true);
    }
  };

  /**
   * Delete server
   */
  const handleDelete = (serverId: string) => {
    const updated = localServers.filter(s => s.id !== serverId);
    setLocalServers(updated);
    onChange(updated);
    setHasChanges(true);
  };

  /**
   * Add new server
   */
  const handleAddServer = () => {
    setEditingServer(null);
    setFormData({
      name: '',
      url: '',
      enabled: true
    });
    setDialogOpen(true);
  };

  /**
   * Save server from dialog
   */
  const handleSaveServer = () => {
    if (!formData.name.trim() || !formData.url.trim()) {
      return; // Validation failed
    }

    if (editingServer) {
      // Update existing server
      const updated = localServers.map(s =>
        s.id === editingServer.id
          ? { ...s, name: formData.name, url: formData.url, enabled: formData.enabled }
          : s
      );
      setLocalServers(updated);
      onChange(updated);
    } else {
      // Add new server
      const newServer: TerminologyServer = {
        id: `term-${Date.now()}`,
        name: formData.name,
        url: formData.url,
        enabled: formData.enabled,
        fhirVersions: ['R4'], // Default, will be auto-detected
        status: 'unknown',
        failureCount: 0,
        lastFailureTime: null,
        circuitOpen: false,
        responseTimeAvg: 0
      };
      const updated = [...localServers, newServer];
      setLocalServers(updated);
      onChange(updated);
    }
    
    setHasChanges(true);
    setDialogOpen(false);
  };

  /**
   * Test URL in dialog
   */
  const handleTestUrl = async () => {
    if (!formData.url.trim()) {
      toast({
        title: "Missing URL",
        description: "Please enter a URL before testing.",
        variant: "destructive",
      });
      return;
    }

    setTestingUrl(true);
    
    try {
      // Import the test function dynamically
      const { testFhirConnection } = await import('../connection-testing');
      const result = await testFhirConnection(formData.url);
      
      if (result.success) {
        toast({
          title: "✅ Connection Successful",
          description: `Successfully connected to ${result.serverInfo?.name || formData.url} (${result.serverInfo?.version || 'Unknown version'})`,
          variant: "default",
        });
      } else {
        toast({
          title: "❌ Connection Failed",
          description: result.error || "Failed to connect to the server",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('[TerminologyServerList] URL test failed:', error);
      toast({
        title: "❌ Test Failed",
        description: "An error occurred while testing the connection",
        variant: "destructive",
      });
    } finally {
      setTestingUrl(false);
    }
  };

  /**
   * Cancel dialog
   */
  const handleCancelDialog = () => {
    setDialogOpen(false);
    setEditingServer(null);
    setFormData({ name: '', url: '', enabled: true });
  };

  /**
   * Map terminology servers to ServerItem props
   */
  const serverItems: ServerItemProps[] = localServers.map((server, index) => ({
    type: 'terminology' as const,
    id: server.id,
    name: server.name,
    url: server.url,
    versions: server.fhirVersions,
    isPrimary: index === 0,
    priorityIndex: index + 1,
    circuitOpen: server.circuitOpen,
    failureCount: server.failureCount > 0 ? server.failureCount : undefined,
    lastFailureTime: server.lastFailureTime,
    enabled: server.enabled,
    reorderable: true,
    toggleable: true,
    onToggle: (enabled) => handleToggle(server.id, enabled),
    onEdit: () => handleEdit(server.id),
    onDelete: () => handleDelete(server.id), // Allow deleting all servers, next becomes primary
  }));

  const enabledCount = localServers.filter(s => s.enabled).length;

  return (
    <div className="space-y-4">
      {/* Header with unsaved changes indicator */}
      {hasChanges && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-yellow-600">
            Unsaved changes
          </Badge>
        </div>
      )}

      {/* Server list */}
      <ServerListContainer
        servers={serverItems}
        enableDragDrop={true}
        emptyStateMessage="No terminology servers configured"
        emptyStateSubMessage="Add at least one server to enable terminology validation"
        emptyStateIcon={Globe}
        onReorder={handleReorder}
      />

      {/* Help text */}
      {localServers.length > 0 && (
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            • <strong>Drag to reorder:</strong> Priority is determined by order (top = highest priority)
          </p>
          <p>
            • <strong>Sequential fallback:</strong> If primary server fails, next server is tried automatically
          </p>
          <p>
            • <strong>Circuit breaker:</strong> Failing servers are temporarily skipped after 5 consecutive failures
          </p>
          <p>
            • <strong>Enabled servers:</strong> {enabledCount} of {localServers.length} active
          </p>
        </div>
      )}

      {/* Save reminder */}
      {hasChanges && onSave && (
        <Alert>
          <AlertDescription className="flex items-center justify-between">
            <span>You have unsaved changes to terminology server configuration</span>
            <Button onClick={onSave} size="sm">
              Save Changes
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Add/Edit Server Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingServer ? 'Edit' : 'Add'} Terminology Server</DialogTitle>
            <DialogDescription>
              {editingServer 
                ? 'Update the terminology server configuration'
                : 'Add a new terminology server for code validation'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="server-name">Server Name</Label>
              <Input
                id="server-name"
                placeholder="e.g., HL7 TX Server"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="server-url">Server URL</Label>
              <div className="flex gap-2">
                <Input
                  id="server-url"
                  placeholder="https://tx.fhir.org/r4"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestUrl}
                  disabled={testingUrl || !formData.url.trim()}
                >
                  {testingUrl ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Globe className="h-4 w-4 mr-1" />
                  )}
                  Test
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Base FHIR URL for terminology operations. Test connection to verify server.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="server-enabled">Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Server will be used for terminology validation
                </p>
              </div>
              <Switch
                id="server-enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDialog}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveServer}
              disabled={!formData.name.trim() || !formData.url.trim()}
            >
              {editingServer ? 'Save Changes' : 'Add Server'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

