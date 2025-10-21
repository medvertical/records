/**
 * ServerForm Component
 * 
 * FHIR server add/edit form with simplified layout
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types
// ============================================================================

type AuthType = 'none' | 'basic' | 'bearer' | 'oauth';

interface ServerFormData {
  name: string;
  url: string;
  fhirVersion?: 'R4' | 'R5' | 'R6';
  authType?: AuthType;
  username?: string;
  password?: string;
  token?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
}

interface FhirServer {
  id: number | string;
  name: string;
  url: string;
  fhirVersion?: string;
  isActive: boolean;
  authType?: AuthType;
  username?: string;
  password?: string;
  token?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
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
  const [formData, setFormData] = useState<ServerFormData>({
    name: editingServer?.name || '',
    url: editingServer?.url || '',
    fhirVersion: editingServer?.fhirVersion as 'R4' | 'R5' | 'R6' | undefined,
    authType: (editingServer?.authType as AuthType) || 'none',
    username: editingServer?.username || '',
    password: editingServer?.password || '',
    token: editingServer?.token || '',
    clientId: editingServer?.clientId || '',
    clientSecret: editingServer?.clientSecret || '',
    tokenUrl: editingServer?.tokenUrl || ''
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

    // Validate auth-specific fields
    if (formData.authType === 'basic') {
      if (!formData.username?.trim() || !formData.password?.trim()) {
        toast({
          title: "Missing Credentials",
          description: "Please enter both username and password for Basic Auth.",
          variant: "destructive",
        });
        return;
      }
    } else if (formData.authType === 'bearer') {
      if (!formData.token?.trim()) {
        toast({
          title: "Missing Token",
          description: "Please enter a bearer token.",
          variant: "destructive",
        });
        return;
      }
    } else if (formData.authType === 'oauth') {
      if (!formData.clientId?.trim() || !formData.clientSecret?.trim() || !formData.tokenUrl?.trim()) {
        toast({
          title: "Missing OAuth Configuration",
          description: "Please enter Client ID, Client Secret, and Token URL.",
          variant: "destructive",
        });
        return;
      }
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

      {/* FHIR Version */}
      <div className="space-y-2">
        <Label htmlFor="fhir-version">FHIR Version</Label>
        <Select
          value={formData.fhirVersion || 'auto'}
          onValueChange={(value) => setFormData({ ...formData, fhirVersion: value === 'auto' ? undefined : value as 'R4' | 'R5' | 'R6' })}
          disabled={isSubmitting}
        >
          <SelectTrigger id="fhir-version">
            <SelectValue placeholder="Auto-detect" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto-detect</SelectItem>
            <SelectItem value="R4">R4</SelectItem>
            <SelectItem value="R5">R5</SelectItem>
            <SelectItem value="R6">R6</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Authentication Type */}
      <div className="space-y-2">
        <Label htmlFor="auth-type">Authentication</Label>
        <Select
          value={formData.authType || 'none'}
          onValueChange={(value) => setFormData({ ...formData, authType: value as AuthType })}
          disabled={isSubmitting}
        >
          <SelectTrigger id="auth-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="basic">Basic Auth</SelectItem>
            <SelectItem value="bearer">Bearer Token</SelectItem>
            <SelectItem value="oauth">OAuth 2.0</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Basic Auth Fields */}
      {formData.authType === 'basic' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={formData.username || ''}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password || ''}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              disabled={isSubmitting}
            />
          </div>
        </>
      )}

      {/* Bearer Token Field */}
      {formData.authType === 'bearer' && (
        <div className="space-y-2">
          <Label htmlFor="token">Bearer Token</Label>
          <Input
            id="token"
            type="password"
            placeholder="Enter your API token"
            value={formData.token || ''}
            onChange={(e) => setFormData({ ...formData, token: e.target.value })}
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* OAuth Fields */}
      {formData.authType === 'oauth' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="client-id">Client ID</Label>
            <Input
              id="client-id"
              type="text"
              value={formData.clientId || ''}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-secret">Client Secret</Label>
            <Input
              id="client-secret"
              type="password"
              value={formData.clientSecret || ''}
              onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="token-url">Token URL</Label>
            <Input
              id="token-url"
              type="url"
              placeholder="https://auth.example.com/token"
              value={formData.tokenUrl || ''}
              onChange={(e) => setFormData({ ...formData, tokenUrl: e.target.value })}
              disabled={isSubmitting}
            />
          </div>
        </>
      )}

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
