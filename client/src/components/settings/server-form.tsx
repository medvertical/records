import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Globe, 
  Shield, 
  Key, 
  Eye, 
  EyeOff,
  Loader2,
  AlertTriangle
} from 'lucide-react';
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
// Helper Functions
// ============================================================================

const validateFhirUrl = (url: string) => {
  if (!url.trim()) {
    return { isValid: false, error: 'URL is required' };
  }

  try {
    const urlObj = new URL(url);
    
    // Check if it's a valid HTTP/HTTPS URL
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }

    // Check for common FHIR server patterns
    const path = urlObj.pathname.toLowerCase();
    const hasFhirEndpoint = path.includes('/fhir') || 
                           path.includes('/base') || 
                           path.includes('/r4') || 
                           path.includes('/r5') ||
                           path.includes('/stu3');

    if (!hasFhirEndpoint) {
      return { 
        isValid: true, 
        warning: 'URL doesn\'t appear to be a FHIR endpoint. Consider adding /fhir or /baseR4 to the path.',
        normalizedUrl: url.endsWith('/') ? url + 'fhir' : url + '/fhir'
      };
    }

    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' };
  }
};

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
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ServerFormData>({
    defaultValues: {
      name: editingServer?.name || '',
      url: editingServer?.url || '',
      authType: 'none',
      username: '',
      password: '',
      token: '',
      clientId: '',
      clientSecret: '',
      tokenUrl: ''
    }
  });

  const authType = watch('authType');
  const url = watch('url');

  const handleFormSubmit = (data: ServerFormData) => {
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
    if (urlValidation.warning && urlValidation.isValid) {
      toast({
        title: "URL Suggestion",
        description: urlValidation.warning,
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

    onSubmit(data);
  };

  const handleTestConnection = () => {
    if (!url.trim()) {
      toast({
        title: "Missing Server URL",
        description: "Please enter a URL before testing the connection.",
        variant: "destructive",
      });
      return;
    }

    const urlValidation = validateFhirUrl(url);
    if (!urlValidation.isValid) {
      toast({
        title: "Invalid Server URL",
        description: urlValidation.error || "Please enter a valid FHIR server URL",
        variant: "destructive",
      });
      return;
    }

    onTestConnection(url);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Server Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Server Name</Label>
            <Input
              id="name"
              {...register('name', { required: 'Server name is required' })}
              placeholder="Enter a descriptive name for this server"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Server URL</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                {...register('url', { required: 'Server URL is required' })}
                placeholder="https://example.com/fhir"
                className={`flex-1 ${errors.url ? 'border-red-500' : ''}`}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTestingConnection || !url.trim()}
                className="flex items-center gap-2"
              >
                {isTestingConnection ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                Test
              </Button>
            </div>
            {errors.url && (
              <p className="text-sm text-red-500">{errors.url.message}</p>
            )}
            {urlValidationStatus.error && (
              <p className="text-sm text-red-500">{urlValidationStatus.error}</p>
            )}
            {urlValidationStatus.warning && (
              <p className="text-sm text-yellow-600 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                {urlValidationStatus.warning}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Authentication Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="authType">Authentication Type</Label>
            <Select value={authType} onValueChange={(value: any) => setValue('authType', value)}>
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

          <Separator />

          {/* Basic Authentication */}
          {authType === 'basic' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  {...register('username')}
                  placeholder="Enter username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    {...register('password')}
                    placeholder="Enter password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Bearer Token */}
          {authType === 'bearer' && (
            <div className="space-y-2">
              <Label htmlFor="token">Bearer Token</Label>
              <Input
                id="token"
                {...register('token')}
                placeholder="Enter bearer token"
                type="password"
              />
            </div>
          )}

          {/* OAuth 2.0 */}
          {authType === 'oauth2' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  {...register('clientId')}
                  placeholder="Enter OAuth client ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientSecret">Client Secret</Label>
                <Input
                  id="clientSecret"
                  {...register('clientSecret')}
                  placeholder="Enter OAuth client secret"
                  type="password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tokenUrl">Token URL</Label>
                <Input
                  id="tokenUrl"
                  {...register('tokenUrl')}
                  placeholder="https://example.com/oauth/token"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end gap-3">
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
          disabled={isSubmitting}
          className="flex items-center gap-2"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Saving...' : editingServer ? 'Update Server' : 'Add Server'}
        </Button>
      </div>
    </form>
  );
}
