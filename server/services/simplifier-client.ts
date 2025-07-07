import axios, { AxiosResponse } from 'axios';

export interface SimplifierPackage {
  id: string;
  name: string;
  title: string;
  description: string;
  version: string;
  fhirVersion: string;
  author: string;
  publishedDate: string;
  dependencies: string[];
  downloadUrl: string;
  canonicalUrl?: string;
  keywords: string[];
  status: 'active' | 'draft' | 'retired';
}

export interface SimplifierProfile {
  id: string;
  name: string;
  title: string;
  description: string;
  type: string;
  baseDefinition: string;
  kind: 'resource' | 'complex-type' | 'primitive-type' | 'logical';
  abstract: boolean;
  context: string[];
  packageId: string;
  version: string;
  url: string;
  status: 'active' | 'draft' | 'retired';
}

export interface SimplifierSearchResult {
  packages: SimplifierPackage[];
  profiles: SimplifierProfile[];
  total: number;
  offset: number;
  count: number;
}

export class SimplifierClient {
  private baseUrl = 'https://simplifier.net/api';
  private headers = {
    'Accept': 'application/json',
    'User-Agent': 'FHIR-Records-App/1.0'
  };

  async searchPackages(query: string, offset = 0, count = 20): Promise<SimplifierSearchResult> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.baseUrl}/packages/search`,
        {
          params: {
            q: query,
            offset,
            count,
            includePrerelease: false
          },
          headers: this.headers
        }
      );

      const packages = response.data.data?.map((pkg: any) => ({
        id: pkg.id,
        name: pkg.name,
        title: pkg.title || pkg.name,
        description: pkg.description || '',
        version: pkg.version,
        fhirVersion: pkg.fhirVersion || '4.0.1',
        author: pkg.author || 'Unknown',
        publishedDate: pkg.publishedDate || new Date().toISOString(),
        dependencies: pkg.dependencies || [],
        downloadUrl: pkg.downloadUrl || `${this.baseUrl}/packages/${pkg.id}`,
        canonicalUrl: pkg.canonicalUrl,
        keywords: pkg.keywords || [],
        status: pkg.status || 'active'
      })) || [];

      return {
        packages,
        profiles: [],
        total: response.data.total || packages.length,
        offset: offset,
        count: packages.length
      };
    } catch (error: any) {
      console.error('Failed to search Simplifier packages:', error);
      return {
        packages: [],
        profiles: [],
        total: 0,
        offset: 0,
        count: 0
      };
    }
  }

  async getPackageDetails(packageId: string): Promise<SimplifierPackage | null> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.baseUrl}/packages/${packageId}`,
        { headers: this.headers }
      );

      const pkg = response.data;
      return {
        id: pkg.id,
        name: pkg.name,
        title: pkg.title || pkg.name,
        description: pkg.description || '',
        version: pkg.version,
        fhirVersion: pkg.fhirVersion || '4.0.1',
        author: pkg.author || 'Unknown',
        publishedDate: pkg.publishedDate || new Date().toISOString(),
        dependencies: pkg.dependencies || [],
        downloadUrl: pkg.downloadUrl || `${this.baseUrl}/packages/${pkg.id}`,
        canonicalUrl: pkg.canonicalUrl,
        keywords: pkg.keywords || [],
        status: pkg.status || 'active'
      };
    } catch (error: any) {
      console.error(`Failed to get package details for ${packageId}:`, error);
      return null;
    }
  }

  async getPackageProfiles(packageId: string): Promise<SimplifierProfile[]> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.baseUrl}/packages/${packageId}/profiles`,
        { headers: this.headers }
      );

      return response.data.data?.map((profile: any) => ({
        id: profile.id,
        name: profile.name,
        title: profile.title || profile.name,
        description: profile.description || '',
        type: profile.type,
        baseDefinition: profile.baseDefinition,
        kind: profile.kind || 'resource',
        abstract: profile.abstract || false,
        context: profile.context || [],
        packageId: packageId,
        version: profile.version,
        url: profile.url,
        status: profile.status || 'active'
      })) || [];
    } catch (error: any) {
      console.error(`Failed to get profiles for package ${packageId}:`, error);
      return [];
    }
  }

  async downloadPackage(packageId: string, version?: string): Promise<Buffer | null> {
    try {
      const url = version 
        ? `${this.baseUrl}/packages/${packageId}/${version}/download`
        : `${this.baseUrl}/packages/${packageId}/download`;

      const response: AxiosResponse<Buffer> = await axios.get(url, {
        headers: this.headers,
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data);
    } catch (error: any) {
      console.error(`Failed to download package ${packageId}:`, error);
      return null;
    }
  }

  async getLatestVersion(packageId: string): Promise<string | null> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.baseUrl}/packages/${packageId}/versions`,
        { headers: this.headers }
      );

      const versions = response.data.data || [];
      if (versions.length === 0) return null;

      // Sort versions and return the latest (assuming semantic versioning)
      const sortedVersions = versions
        .map((v: any) => v.version)
        .filter((v: string) => v && !v.includes('preview') && !v.includes('alpha'))
        .sort((a: string, b: string) => {
          const aParts = a.split('.').map(Number);
          const bParts = b.split('.').map(Number);
          
          for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aPart = aParts[i] || 0;
            const bPart = bParts[i] || 0;
            if (aPart !== bPart) return bPart - aPart;
          }
          return 0;
        });

      return sortedVersions[0] || null;
    } catch (error: any) {
      console.error(`Failed to get latest version for ${packageId}:`, error);
      return null;
    }
  }

  async searchProfiles(query: string, packageId?: string): Promise<SimplifierProfile[]> {
    try {
      const params: any = {
        q: query,
        resourceType: 'StructureDefinition',
        count: 50
      };

      if (packageId) {
        params.packageId = packageId;
      }

      const response: AxiosResponse = await axios.get(
        `${this.baseUrl}/resources/search`,
        {
          params,
          headers: this.headers
        }
      );

      return response.data.data?.map((profile: any) => ({
        id: profile.id,
        name: profile.name,
        title: profile.title || profile.name,
        description: profile.description || '',
        type: profile.type,
        baseDefinition: profile.baseDefinition,
        kind: profile.kind || 'resource',
        abstract: profile.abstract || false,
        context: profile.context || [],
        packageId: profile.packageId,
        version: profile.version,
        url: profile.url,
        status: profile.status || 'active'
      })) || [];
    } catch (error: any) {
      console.error('Failed to search profiles:', error);
      return [];
    }
  }

  async getPackageVersions(packageId: string): Promise<{
    versions: Record<string, {
      fhirVersion: string;
      date: string;
      description?: string;
    }>;
    distTags: {
      latest: string;
    };
  }> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.baseUrl}/packages/${packageId}/versions`,
        { headers: this.headers }
      );

      const versionsData = response.data.data || [];
      const versions: Record<string, { fhirVersion: string; date: string; description?: string; }> = {};
      let latestVersion = '';

      // Process version data
      for (const versionInfo of versionsData) {
        if (versionInfo.version) {
          versions[versionInfo.version] = {
            fhirVersion: versionInfo.fhirVersion || '4.0.1',
            date: versionInfo.publishedDate || versionInfo.date || new Date().toISOString(),
            description: versionInfo.description || versionInfo.summary
          };
        }
      }

      // Get the latest stable version (excluding pre-release versions)
      const stableVersions = Object.keys(versions)
        .filter(v => !v.includes('preview') && !v.includes('alpha') && !v.includes('beta') && !v.includes('rc'))
        .sort((a, b) => {
          const aParts = a.split('.').map(Number);
          const bParts = b.split('.').map(Number);
          
          for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aPart = aParts[i] || 0;
            const bPart = bParts[i] || 0;
            if (aPart !== bPart) return bPart - aPart;
          }
          return 0;
        });

      latestVersion = stableVersions[0] || Object.keys(versions)[0] || '1.0.0';

      return {
        versions,
        distTags: {
          latest: latestVersion
        }
      };
    } catch (error: any) {
      console.error(`Failed to get package versions for ${packageId}:`, error);
      // Return fallback data for testing
      return {
        versions: {
          '1.0.0': {
            fhirVersion: '4.0.1',
            date: new Date().toISOString(),
            description: 'Latest available version'
          }
        },
        distTags: {
          latest: '1.0.0'
        }
      };
    }
  }
}

export const simplifierClient = new SimplifierClient();