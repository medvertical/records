/**
 * Terminology Servers Section Component
 * 
 * Manages multiple terminology servers with:
 * - Drag & drop reordering (priority = order)
 * - Server enable/disable toggles
 * - Test server connectivity
 * - Add/edit/delete servers
 * - Real-time status indicators
 * - Circuit breaker status
 */

import { useState, useEffect } from 'react';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Plus, HelpCircle } from 'lucide-react';
import type { TerminologyServer } from '@shared/validation-settings';
import { TerminologyServerCard } from './terminology-server-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TerminologyServersSectionProps {
  servers: TerminologyServer[];
  onChange: (servers: TerminologyServer[]) => void;
  onSave: () => void;
  hideHeader?: boolean; // Hide title and help tooltip (useful when used within a tab with its own SectionTitle)
}

export function TerminologyServersSection({
  servers,
  onChange,
  onSave,
  hideHeader = false
}: TerminologyServersSectionProps) {
  const [localServers, setLocalServers] = useState<TerminologyServer[]>(servers);
  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<TerminologyServer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    enabled: true
  });

  // Update local state when props change
  useEffect(() => {
    setLocalServers(servers);
    setHasChanges(false);
  }, [servers]);

  // Drag & drop sensors (require mouse movement to prevent accidental drags)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    })
  );

  /**
   * Handle drag end event - reorder servers
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = localServers.findIndex(s => s.id === active.id);
    const newIndex = localServers.findIndex(s => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const newOrder = arrayMove(localServers, oldIndex, newIndex);
    setLocalServers(newOrder);
    onChange(newOrder);
    setHasChanges(true);

    console.log('[TerminologyServers] Reordered:', newOrder.map((s, i) => `${i + 1}. ${s.name}`));
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
   * Test server connectivity
   */
  const handleTest = async (serverId: string) => {
    setTestingServerId(serverId);
    
    try {
      const response = await fetch('/api/validation/terminology/test-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update server status
        const updated = localServers.map(s =>
          s.id === serverId
            ? {
                ...s,
                status: 'healthy' as const,
                responseTimeAvg: result.responseTime,
                fhirVersions: result.fhirVersion ? [result.fhirVersion.toUpperCase().replace(/\./g, '')] : s.fhirVersions
              }
            : s
        );
        
        setLocalServers(updated);
        onChange(updated);
        setHasChanges(true);
      }
    } catch (error) {
      console.error('[TerminologyServers] Test failed:', error);
    } finally {
      setTestingServerId(null);
    }
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
   * Cancel dialog
   */
  const handleCancelDialog = () => {
    setDialogOpen(false);
    setEditingServer(null);
    setFormData({ name: '', url: '', enabled: true });
  };

  /**
   * Get count of enabled servers
   */
  const enabledCount = localServers.filter(s => s.enabled).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        {!hideHeader && (
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Terminology Servers</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p>
                    Terminology servers are tried in order (top to bottom) until one succeeds.
                    Drag to reorder. Failed servers are automatically skipped via circuit breaker.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        <div className={`flex items-center gap-2 ${hideHeader ? 'ml-auto' : ''}`}>
          {hasChanges && (
            <Badge variant="outline" className="text-yellow-600">
              Unsaved changes
            </Badge>
          )}
          <Button onClick={handleAddServer} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add Server
          </Button>
        </div>
      </div>

      {/* Server list with drag & drop */}
      {localServers.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localServers.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {localServers.map((server, index) => (
                <TerminologyServerCard
                  key={server.id}
                  server={server}
                  index={index}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onTest={handleTest}
                  testing={testingServerId === server.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <Alert>
          <AlertDescription>
            No terminology servers configured. Add at least one server to enable terminology validation.
          </AlertDescription>
        </Alert>
      )}

      {/* Help text */}
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

      {/* Save reminder */}
      {hasChanges && (
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
        <DialogContent>
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
              <Label htmlFor="server-name">Name</Label>
              <Input
                id="server-name"
                placeholder="e.g., HL7 TX Server"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="server-url">URL</Label>
              <Input
                id="server-url"
                placeholder="https://tx.fhir.org/r4"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Base FHIR URL for terminology operations
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

/**
 * Loading skeleton for terminology servers section
 */
export function TerminologyServersSectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-6 w-20" />
              <div className="flex-1">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-9 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

