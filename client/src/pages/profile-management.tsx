import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Trash2, RefreshCw, AlertCircle, CheckCircle, Settings, Package, Server, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useValidationSettings, useUpdateValidationSettings, useFhirServerPackages } from '@/hooks/use-fhir-data';

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
  const { data: installedPackages, isLoading: isLoadingInstalled } = useQuery<InstalledPackage[]>({
    queryKey: ['/api/profiles/installed'],
  });

  // FHIR Server packages
  const { data: fhirServerPackages, isLoading: isLoadingFhirPackages } = useFhirServerPackages();

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
    onSuccess: (data) => {
      toast({
        title: 'Package Installed',
        description: `Successfully installed package: ${data.packageName}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles/installed'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Installation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      await searchMutation.mutateAsync(searchQuery);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleInstall = (pkg: SimplifierPackage) => {
    installMutation.mutate({ packageId: pkg.id, version: pkg.version });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile Management</h1>
        <p className="text-muted-foreground">
          Manage FHIR validation profiles and implementation guides
        </p>
      </div>

      <Tabs defaultValue="installed" className="space-y-6">
        <TabsList>
          <TabsTrigger value="installed">Installed Packages</TabsTrigger>
          <TabsTrigger value="fhir-server">FHIR Server Packages</TabsTrigger>
          <TabsTrigger value="search">Search & Install</TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Installed Packages</CardTitle>
              <CardDescription>
                Packages installed in your local profile repository
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoadingInstalled ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading installed packages...</p>
                  </div>
                ) : installedPackages && installedPackages.length > 0 ? (
                  <div className="grid gap-4">
                    {(installedPackages || []).map((pkg: InstalledPackage) => (
                      <Card key={pkg.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{pkg.name}</h3>
                              <Badge variant={pkg.status === 'active' ? 'default' : pkg.status === 'error' ? 'destructive' : 'secondary'}>
                                {pkg.status}
                              </Badge>
                              {pkg.updateAvailable && (
                                <Badge variant="outline" className="text-orange-600">
                                  Update Available
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Version {pkg.version} • {pkg.profileCount} profiles • Installed {new Date(pkg.installedDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {pkg.updateAvailable && (
                              <Button size="sm" variant="outline">
                                <RefreshCw className="w-4 h-4 mr-1" />
                                Update
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4 mr-1" />
                              Uninstall
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No packages installed</h3>
                    <p className="text-muted-foreground mb-4">
                      Install validation packages to start validating FHIR resources
                    </p>
                    <Button>
                      <Download className="w-4 h-4 mr-2" />
                      Browse Available Packages
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fhir-server" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>FHIR Server Packages</CardTitle>
              <CardDescription>
                Packages and profiles available on the connected FHIR server
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoadingFhirPackages ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Scanning FHIR server packages...</p>
                  </div>
                ) : fhirServerPackages && fhirServerPackages.length > 0 ? (
                  <div className="grid gap-4">
                    {fhirServerPackages.map((pkg: any) => (
                      <Card key={pkg.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <Server className="w-4 h-4 text-muted-foreground" />
                              <h3 className="font-semibold">{pkg.title || pkg.name}</h3>
                              <Badge variant={pkg.status === 'active' ? 'default' : 'secondary'}>
                                {pkg.status}
                              </Badge>
                              <Badge variant="outline" className="text-blue-600">
                                {pkg.type}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {pkg.description || 'No description available'}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>Version {pkg.version}</span>
                              <span>FHIR {pkg.fhirVersion}</span>
                              <span>{pkg.profileCount} profiles</span>
                              <span>Publisher: {pkg.publisher}</span>
                            </div>
                            {pkg.url && (
                              <p className="text-sm text-muted-foreground font-mono">
                                {pkg.url}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No packages found</h3>
                    <p className="text-muted-foreground mb-4">
                      No implementation guides or profile packages detected on the FHIR server
                    </p>
                    <Button onClick={() => window.location.reload()}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh Scan
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search & Install Packages</CardTitle>
              <CardDescription>
                Search for FHIR validation packages from Simplifier.net
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search for packages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searchLoading}>
                  <Search className="w-4 h-4 mr-2" />
                  {searchLoading ? 'Searching...' : 'Search'}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Search Results</h3>
                  <div className="grid gap-4">
                    {searchResults.map((pkg) => (
                      <Card key={pkg.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{pkg.title}</h3>
                              <Badge variant={pkg.status === 'active' ? 'default' : 'secondary'}>
                                {pkg.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{pkg.description}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>Version {pkg.version}</span>
                              <span>FHIR {pkg.fhirVersion}</span>
                              <span>By {pkg.author}</span>
                              <span>{new Date(pkg.publishedDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleInstall(pkg)}
                            disabled={installMutation.isPending}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Install
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>
    </div>
  );
}

