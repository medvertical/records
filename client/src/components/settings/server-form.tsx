/**
 * ServerForm Component
 * 
 * Simplified FHIR server add/edit form
 * Analog to Terminology Server modal - keep it simple!
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types
// ============================================================================

interface ServerFormData {
  name: string;
  url: string;
  fhirVersion?: 'R4' | 'R5' | 'R6';
}

interface FhirServer {
  id: number | string;
  name: string;
  url: string;
  fhirVersion?: string;
  isActive: boolean;
}

interface ServerFormProps {
  editingServer: FhirServer | null;
  isSubmitting: boolean;
  onSubmit: (data: ServerFormData) => void;
  onCancel: () => void;
  onTestConnection: (url: string) => void;
  isTestingConnection: boolean;
  urlValidationStatus: { isValid: boolean; error?: string; warning?: string };
}

// ============================================================================
// Component
// ============================================================================

export function ServerForm({
  editingServer,
  isSubmitting,
  onSubmit,
  onCancel,
  onTestConnection,
  isTestingConnection,
  urlValidationStatus
}: ServerFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: editingServer?.name || '',
    url: editingServer?.url || '',
    fhirVersion: editingServer?.fhirVersion as 'R4' | 'R5' | 'R6' | undefined
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.name.trim()) {
      toast({
        title: "Missing Server Name",
        description: "Please enter a name for the FHIR server.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.url.trim()) {
      toast({
        title: "Missing Server URL",
        description: "Please enter the URL of the FHIR server.",
        variant: "destructive",
      });
      return;
    }

    onSubmit(formData);
  };

  const handleTestConnection = () => {
    if (!formData.url.trim()) {
      toast({
        title: "Missing Server URL",
        description: "Please enter a URL before testing the connection.",
        variant: "destructive",
      });
      return;
    }

    onTestConnection(formData.url);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      {/* Server Name */}
      <div className="space-y-2">
        <Label htmlFor="server-name">Server Name</Label>
        <Input
          id="server-name"
          placeholder="e.g., Fire.ly Server"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          disabled={isSubmitting}
        />
      </div>

      {/* Server URL */}
      <div className="space-y-2">
        <Label htmlFor="server-url">Server URL</Label>
        <div className="flex gap-2">
          <Input
            id="server-url"
            placeholder="https://server.fire.ly"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            disabled={isSubmitting}
            className={urlValidationStatus.error ? 'border-red-500' : ''}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTestingConnection || isSubmitting || !formData.url.trim()}
          >
            {isTestingConnection ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Globe className="h-4 w-4 mr-1" />
            )}
            Test
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Base FHIR server URL. Test connection to auto-detect FHIR version.
        </p>
        {urlValidationStatus.error && (
          <p className="text-xs text-red-600">{urlValidationStatus.error}</p>
        )}
        {urlValidationStatus.warning && (
          <p className="text-xs text-yellow-600">{urlValidationStatus.warning}</p>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !formData.name.trim() || !formData.url.trim()}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {editingServer ? 'Updating...' : 'Adding...'}
            </>
          ) : (
            editingServer ? 'Update Server' : 'Add Server'
          )}
        </Button>
      </div>
    </form>
  );
}
