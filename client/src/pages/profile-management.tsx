import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Trash2, RefreshCw, AlertCircle, CheckCircle, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useValidationSettings, useUpdateValidationSettings } from '@/hooks/use-fhir-data';

interface SimplifierPackage {
  id: string;
  name: string;
  title: string;
  description: string;
  version: string;
  fhirVersion: string;
  author: string;
  publishedDate: string;
  status: 'active' | 'draft' | 'retired';
}

interface InstalledPackage {
  id: string;
  name: string;
  version: string;
  installedDate: string;
  profileCount: number;
  status: 'active' | 'inactive' | 'error';
  updateAvailable?: boolean;
  latestVersion?: string;
}

export function ProfileManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SimplifierPackage[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch installed packages
  const { data: installedPackages, isLoading: installedLoading } = useQuery<InstalledPackage[]>({
    queryKey: ['/api/profiles/installed'],
  });

  // Search packages mutation
  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch(`/api/profiles/search?query=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json() as Promise<SimplifierPackage[]>;
    },
    onSuccess: (data) => {
      setSearchResults(data);
    },
    onError: (error: any) => {
      toast({
        title: 'Search Failed',
        description: error.message || 'Failed to search packages',
        variant: 'destructive',
      });
    },
  });

  // Install package mutation
  const installMutation = useMutation({
    mutationFn: async ({ packageId, version }: { packageId: string; version?: string }) => {
      const response = await fetch('/api/profiles/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, version }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Installation failed');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Installation Successful',
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles/installed'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Installation Failed',
        description: error.message || 'Failed to install package',
        variant: 'destructive',
      });
    },
  });

  // Uninstall package mutation
  const uninstallMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const response = await fetch(`/api/profiles/uninstall/${packageId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Uninstallation failed');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Uninstallation Successful',
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles/installed'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Uninstallation Failed',
        description: error.message || 'Failed to uninstall package',
        variant: 'destructive',
      });
    },
  });

  // Update package mutation
  const updateMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const response = await fetch(`/api/profiles/update/${packageId}`, {
        method: 'PUT',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Update failed');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Update Successful',
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles/installed'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update package',
        variant: 'destructive',
      });
    },
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    searchMutation.mutate(searchQuery, {
      onSettled: () => setSearchLoading(false),
    });
  };

  const handleInstall = (packageId: string, version?: string) => {
    installMutation.mutate({ packageId, version });
  };

  const handleUninstall = (packageId: string) => {
    uninstallMutation.mutate(packageId);
  };

  const handleUpdate = (packageId: string) => {
    updateMutation.mutate(packageId);
  };

  const ValidationSettings = () => {
    const { data: settings, isLoading } = useValidationSettings();
    const updateSettings = useUpdateValidationSettings();
    const [localSettings, setLocalSettings] = useState(settings || {
      fetchFromSimplifier: true,
      fetchFromFhirServer: true,
      autoDetectProfiles: true,
      strictMode: false
    });

    const handleSettingChange = (key: string, value: any) => {
      const newSettings = { ...localSettings, [key]: value };
      setLocalSettings(newSettings);
      updateSettings.mutate(newSettings);
    };

    if (isLoading) {
      return <div className="text-center py-8">Loading validation settings...</div>;
    }

    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="fetch-simplifier" className="text-sm font-medium">
                Fetch Profiles from Simplifier.net
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically download validation profiles from Simplifier.net when needed
              </p>
            </div>
            <Switch
              id="fetch-simplifier"
              checked={(localSettings as any).fetchFromSimplifier !== false}
              onCheckedChange={(checked) => handleSettingChange('fetchFromSimplifier', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="fetch-fhir-server" className="text-sm font-medium">
                Fetch Profiles from FHIR Server
              </Label>
              <p className="text-sm text-muted-foreground">
                Try to fetch validation profiles from the connected FHIR server
              </p>
            </div>
            <Switch
              id="fetch-fhir-server"
              checked={(localSettings as any).fetchFromFhirServer !== false}
              onCheckedChange={(checked) => handleSettingChange('fetchFromFhirServer', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-detect-profiles" className="text-sm font-medium">
                Auto-detect Resource Profiles
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically detect and validate against profiles specified in resources
              </p>
            </div>
            <Switch
              id="auto-detect-profiles"
              checked={(localSettings as any).autoDetectProfiles !== false}
              onCheckedChange={(checked) => handleSettingChange('autoDetectProfiles', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="strict-mode" className="text-sm font-medium">
                Strict Validation Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable stricter validation rules and error reporting
              </p>
            </div>
            <Switch
              id="strict-mode"
              checked={(localSettings as any).strictMode === true}
              onCheckedChange={(checked) => handleSettingChange('strictMode', checked)}
            />
          </div>
        </div>

        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            Validation settings are applied immediately when changed. Profile fetching from external sources 
            may take longer depending on network conditions.
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile Management</h1>
        <p className="text-muted-foreground">
          Install and manage FHIR implementation guides and validation profiles from Simplifier.net
        </p>
      </div>

      <Tabs defaultValue="installed" className="space-y-6">
        <TabsList>
          <TabsTrigger value="installed">Installed Packages</TabsTrigger>
          <TabsTrigger value="search">Search & Install</TabsTrigger>
          <TabsTrigger value="settings">Validation Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Installed Packages</CardTitle>
              <CardDescription>
                Manage your installed FHIR validation profiles and implementation guides
              </CardDescription>
            </CardHeader>
            <CardContent>
              {installedLoading ? (
                <div className="text-center py-8">Loading installed packages...</div>
              ) : !installedPackages || installedPackages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No packages installed yet. Use the search tab to find and install packages.
                </div>
              ) : (
                <div className="grid gap-4">
                  {(installedPackages || []).map((pkg: InstalledPackage) => (
                    <Card key={pkg.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h3 className="font-semibold">{pkg.name}</h3>
                            <p className="text-sm text-muted-foreground">Version {pkg.version}</p>
                            <div className="flex items-center space-x-2">
                              <Badge variant={pkg.status === 'active' ? 'default' : 'secondary'}>
                                {pkg.status}
                              </Badge>
                              {pkg.updateAvailable && (
                                <Badge variant="outline" className="text-orange-600">
                                  Update Available ({pkg.latestVersion})
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {pkg.profileCount} profiles • Installed {new Date(pkg.installedDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            {pkg.updateAvailable && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdate(pkg.id)}
                                disabled={updateMutation.isPending}
                              >
                                <RefreshCw className="w-4 h-4 mr-1" />
                                Update
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleUninstall(pkg.id)}
                              disabled={uninstallMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Uninstall
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Simplifier.net</CardTitle>
              <CardDescription>
                Find and install FHIR implementation guides and validation profiles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="Search for packages (e.g., 'us-core', 'hl7.fhir.us.core')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searchLoading || !searchQuery.trim()}>
                  <Search className="w-4 h-4 mr-1" />
                  Search
                </Button>
              </div>

              {searchLoading && (
                <div className="text-center py-8">Searching Simplifier.net...</div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Search Results</h3>
                  <div className="grid gap-4">
                    {searchResults.map((pkg) => (
                      <Card key={pkg.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1 flex-1">
                              <h4 className="font-semibold">{pkg.title || pkg.name}</h4>
                              <p className="text-sm text-muted-foreground">{pkg.description}</p>
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline">v{pkg.version}</Badge>
                                <Badge variant="outline">FHIR {pkg.fhirVersion}</Badge>
                                <Badge variant={pkg.status === 'active' ? 'default' : 'secondary'}>
                                  {pkg.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                By {pkg.author} • Published {new Date(pkg.publishedDate).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              onClick={() => handleInstall(pkg.id, pkg.version)}
                              disabled={installMutation.isPending}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Install
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {searchQuery && !searchLoading && searchResults.length === 0 && searchMutation.isSuccess && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No packages found for "{searchQuery}". Try different search terms or check the package name.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Validation Settings</CardTitle>
              <CardDescription>
                Configure how FHIR resources are validated against profiles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ValidationSettings />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}