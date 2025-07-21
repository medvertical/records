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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  versions?: string[];
}

interface PackageVersionInfo {
  versions: Record<string, {
    fhirVersion: string;
    date: string;
    description?: string;
  }>;
  distTags: {
    latest: string;
  };
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

// Component for inline version selection and install
function PackageInstallControl({ 
  pkg, 
  onInstall, 
  isInstalling 
}: {
  pkg: SimplifierPackage;
  onInstall: (pkg: SimplifierPackage, version?: string) => void;
  isInstalling: boolean;
}) {
  const [packageVersions, setPackageVersions] = useState<PackageVersionInfo | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string>('latest');
  const [loadingVersions, setLoadingVersions] = useState(false);

  const loadVersions = async () => {
    if (packageVersions) return; // Already loaded
    
    setLoadingVersions(true);
    try {
      const response = await fetch(`/api/profiles/versions?packageId=${encodeURIComponent(pkg.id)}`);
      if (!response.ok) throw new Error('Failed to fetch versions');
      const versions = await response.json() as PackageVersionInfo;
      setPackageVersions(versions);
    } catch (error: any) {
      console.error('Failed to load versions:', error);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleInstall = () => {
    const versionToInstall = selectedVersion === 'latest' 
      ? packageVersions?.distTags.latest || pkg.version
      : selectedVersion;
    onInstall(pkg, versionToInstall);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-48">
        <Select 
          value={selectedVersion} 
          onValueChange={setSelectedVersion}
          onOpenChange={(open) => {
            if (open && !packageVersions && !loadingVersions) {
              loadVersions();
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select version" />
          </SelectTrigger>
          <SelectContent>
            {loadingVersions ? (
              <div className="flex items-center justify-center py-2">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
                <span className="text-sm">Loading...</span>
              </div>
            ) : packageVersions ? (
              <>
                <SelectItem value="latest">
                  Latest ({packageVersions.distTags.latest})
                </SelectItem>
                {Object.entries(packageVersions.versions)
                  .sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true }))
                  .map(([version, info]) => (
                    <SelectItem key={version} value={version}>
                      {version} (FHIR {info.fhirVersion})
                    </SelectItem>
                  ))}
              </>
            ) : (
              <SelectItem value="latest">
                Latest ({pkg.version})
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      <Button
        onClick={handleInstall}
        disabled={isInstalling || loadingVersions}
        className="min-w-24"
      >
        <Download className="w-4 h-4 mr-2" />
        {isInstalling ? 'Installing...' : 'Install'}
      </Button>
    </div>
  );
}

export function ProfileManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SimplifierPackage[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('all');
  const [selectedPackage, setSelectedPackage] = useState<SimplifierPackage | null>(null);
  const [packageVersions, setPackageVersions] = useState<PackageVersionInfo | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string>('latest');
  const [loadingVersions, setLoadingVersions] = useState(false);
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

  // Uninstall package mutation
  const uninstallMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const response = await fetch('/api/profiles/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Uninstall failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Package Uninstalled',
        description: `Successfully removed package and ${data.profilesRemoved || 0} profiles`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles/installed'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Uninstall Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update package mutation
  const updateMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const response = await fetch('/api/profiles/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Update failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Package Updated',
        description: `Successfully updated to version ${data.newVersion}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles/installed'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
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

  const handleGetVersions = async (packageId: string) => {
    setLoadingVersions(true);
    try {
      const response = await fetch(`/api/profiles/versions?packageId=${encodeURIComponent(packageId)}`);
      if (!response.ok) throw new Error('Failed to fetch versions');
      const versions = await response.json() as PackageVersionInfo;
      setPackageVersions(versions);
      setSelectedVersion('latest');
    } catch (error: any) {
      toast({
        title: 'Failed to Load Versions',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleSelectPackage = (pkg: SimplifierPackage) => {
    setSelectedPackage(pkg);
    setPackageVersions(null);
    setSelectedVersion('latest');
    handleGetVersions(pkg.id);
  };

  const handleInstall = (pkg: SimplifierPackage, version?: string) => {
    const versionToInstall = version || pkg.version;
    installMutation.mutate({ packageId: pkg.id, version: versionToInstall });
    setSelectedPackage(null);
    setPackageVersions(null);
  };

  const handleUninstall = (packageId: string) => {
    uninstallMutation.mutate(packageId);
  };

  const handleUpdate = (packageId: string) => {
    updateMutation.mutate(packageId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Package Management</h1>
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
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleUpdate(pkg.id)}
                                disabled={updateMutation.isPending}
                              >
                                <RefreshCw className={`w-4 h-4 mr-1 ${updateMutation.isPending ? 'animate-spin' : ''}`} />
                                {updateMutation.isPending ? 'Updating...' : 'Update'}
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleUninstall(pkg.id)}
                              disabled={uninstallMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              {uninstallMutation.isPending ? 'Removing...' : 'Uninstall'}
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
                <div className="flex-1">
                  <Input
                    placeholder="Search for packages (e.g., 'de.basisprofil.r4', 'US Core', 'IPS')..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <Select value={searchFilter} onValueChange={setSearchFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="ig">Implementation Guides</SelectItem>
                    <SelectItem value="profile">Profiles</SelectItem>
                    <SelectItem value="terminology">Terminology</SelectItem>
                    <SelectItem value="us-core">US Core</SelectItem>
                    <SelectItem value="ips">IPS</SelectItem>
                    <SelectItem value="ihe">IHE</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleSearch} disabled={searchLoading}>
                  <Search className="w-4 h-4 mr-2" />
                  {searchLoading ? 'Searching...' : 'Search'}
                </Button>
              </div>

              {/* Popular Packages Section */}
              {searchResults.length === 0 && !searchLoading && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Popular Packages</h3>
                  </div>
                  <div className="grid gap-4">
                    {[
                      { id: 'hl7.fhir.us.core', title: 'US Core', description: 'Official US Core Implementation Guide for FHIR R4', version: '6.1.0', fhirVersion: '4.0.1', author: 'HL7 International' },
                      { id: 'hl7.fhir.uv.ips', title: 'International Patient Summary', description: 'IPS Implementation Guide for cross-border patient care', version: '1.1.0', fhirVersion: '4.0.1', author: 'HL7 International' },
                      { id: 'ihe.iti.pcc', title: 'IHE Patient Care Coordination', description: 'IHE PCC profiles for patient care coordination', version: '1.0.0', fhirVersion: '4.0.1', author: 'IHE International' },
                      { id: 'hl7.fhir.uv.sdc', title: 'Structured Data Capture', description: 'SDC Implementation Guide for form-based data capture', version: '3.0.0', fhirVersion: '4.0.1', author: 'HL7 International' },
                      { id: 'hl7.fhir.uv.smart', title: 'SMART App Launch', description: 'SMART on FHIR application launch framework', version: '2.0.0', fhirVersion: '4.0.1', author: 'HL7 International' },
                    ].map((pkg) => (
                      <Card key={pkg.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{pkg.title}</h3>
                              <Badge variant="secondary">Popular</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{pkg.description}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>Latest Version {pkg.version}</span>
                              <span>FHIR {pkg.fhirVersion}</span>
                              <span>By {pkg.author}</span>
                            </div>
                          </div>
                          <PackageInstallControl 
                            pkg={{
                              ...pkg,
                              publishedDate: new Date().toISOString(),
                              status: 'active' as const
                            }} 
                            onInstall={handleInstall}
                            isInstalling={installMutation.isPending}
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Search Results</h3>
                    <Badge variant="outline">{searchResults.length} results</Badge>
                  </div>
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
                              {pkg.id.includes('us.core') && (
                                <Badge variant="outline" className="text-blue-600">US Core</Badge>
                              )}
                              {pkg.id.includes('ips') && (
                                <Badge variant="outline" className="text-green-600">IPS</Badge>
                              )}
                              {pkg.id.includes('ihe') && (
                                <Badge variant="outline" className="text-purple-600">IHE</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{pkg.description}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>Latest Version {pkg.version}</span>
                              <span>FHIR {pkg.fhirVersion}</span>
                              <span>By {pkg.author}</span>
                              <span>{new Date(pkg.publishedDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <PackageInstallControl 
                            pkg={pkg} 
                            onInstall={handleInstall}
                            isInstalling={installMutation.isPending}
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.length === 0 && searchLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Searching packages...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


    </div>
  );
}

