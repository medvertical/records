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
      // Try both Simplifier.net and NPM registry search
      const [simplifierResult, npmResult] = await Promise.allSettled([
        this.searchSimplifierPackages(query, offset, count),
        this.searchNpmPackages(query, count)
      ]);

      const simplifierPackages = simplifierResult.status === 'fulfilled' ? simplifierResult.value.packages : [];
      const npmPackages = npmResult.status === 'fulfilled' ? npmResult.value.packages : [];

      // Combine results, prioritizing Simplifier.net packages
      const allPackages = [...simplifierPackages, ...npmPackages];
      
      return {
        packages: allPackages,
        profiles: [],
        total: allPackages.length,
        offset,
        count: allPackages.length
      };
    } catch (error: any) {
      console.error('Failed to search packages:', error);
      return { packages: [], profiles: [], total: 0, offset, count: 0 };
    }
  }

  private async searchSimplifierPackages(query: string, offset = 0, count = 20): Promise<SimplifierSearchResult> {
    try {
      // First check if this is a known package
      const knownPackages = this.searchKnownPackages(query);
      if (knownPackages.packages.length > 0) {
        return knownPackages;
      }

      // Try FHIR Package Registry first
      const fhirRegistryResult = await this.searchFhirRegistry(query, count);
      if (fhirRegistryResult.packages.length > 0) {
        return fhirRegistryResult;
      }

      // Fallback to Simplifier.net API (if it works)
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

  private async searchNpmPackages(query: string, count = 20): Promise<SimplifierSearchResult> {
    try {
      const response: AxiosResponse = await axios.get(
        `https://registry.npmjs.org/-/v1/search`,
        {
          params: { 
            text: query,
            size: count,
            popularity: 1.0,
            quality: 1.0,
            maintenance: 1.0
          },
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'FHIR-Records-App/1.0'
          }
        }
      );

      const packages: SimplifierPackage[] = response.data.objects?.map((result: any) => {
        const pkg = result.package;
        return {
          id: pkg.name,
          name: pkg.name,
          title: pkg.name,
          description: pkg.description || '',
          version: pkg.version,
          fhirVersion: this.extractFhirVersion(pkg.keywords || []),
          author: pkg.author?.name || pkg.publisher?.name || 'Unknown',
          publishedDate: pkg.date || new Date().toISOString(),
          dependencies: Object.keys(pkg.dependencies || {}),
          downloadUrl: `https://registry.npmjs.org/${pkg.name}/-/${pkg.name}-${pkg.version}.tgz`,
          canonicalUrl: pkg.links?.homepage || pkg.links?.repository,
          keywords: pkg.keywords || [],
          status: 'active'
        };
      }).filter((pkg: SimplifierPackage) => 
        // Filter to show only FHIR-related packages
        pkg.keywords.some(k => k.toLowerCase().includes('fhir')) ||
        pkg.name.toLowerCase().includes('fhir') ||
        pkg.description.toLowerCase().includes('fhir') ||
        pkg.name.includes('hl7') ||
        pkg.name.includes('basisprofil')
      ) || [];

      return {
        packages,
        profiles: [],
        total: packages.length,
        offset: 0,
        count: packages.length
      };
    } catch (error: any) {
      console.error('Failed to search NPM packages:', error);
      return { packages: [], profiles: [], total: 0, offset: 0, count: 0 };
    }
  }

  private extractFhirVersion(keywords: string[]): string {
    // Try to extract FHIR version from keywords
    const fhirVersionKeyword = keywords.find(k => 
      k.toLowerCase().includes('fhir') && k.match(/\d+\.\d+/)
    );
    if (fhirVersionKeyword) {
      const match = fhirVersionKeyword.match(/(\d+\.\d+)/);
      if (match) return match[1];
    }
    return '4.0.1'; // Default to R4
  }

  private searchKnownPackages(query: string): SimplifierSearchResult {
    const knownPackages = [
      {
        id: 'de.basisprofil.r4',
        name: 'de.basisprofil.r4',
        title: 'Deutsche Basisprofile für FHIR R4',
        description: 'German base profiles for FHIR R4 implementation',
        version: '1.4.0',
        fhirVersion: '4.0.1',
        author: 'HL7 Deutschland',
        publishedDate: '2023-07-01T00:00:00.000Z',
        dependencies: [],
        downloadUrl: 'https://simplifier.net/packages/de.basisprofil.r4',
        canonicalUrl: 'https://simplifier.net/packages/de.basisprofil.r4',
        keywords: ['german', 'deutschland', 'basisprofil', 'r4'],
        status: 'active' as const
      },
      {
        id: 'hl7.fhir.us.core',
        name: 'hl7.fhir.us.core',
        title: 'US Core Implementation Guide',
        description: 'Official US Core Implementation Guide for FHIR R4',
        version: '6.1.0',
        fhirVersion: '4.0.1',
        author: 'HL7 International',
        publishedDate: '2023-01-01T00:00:00.000Z',
        dependencies: [],
        downloadUrl: 'https://packages.fhir.org/hl7.fhir.us.core',
        canonicalUrl: 'http://hl7.org/fhir/us/core',
        keywords: ['us-core', 'usa', 'implementation-guide'],
        status: 'active' as const
      },
      {
        id: 'hl7.fhir.uv.ips',
        name: 'hl7.fhir.uv.ips',
        title: 'International Patient Summary',
        description: 'IPS Implementation Guide for cross-border patient care',
        version: '1.1.0',
        fhirVersion: '4.0.1',
        author: 'HL7 International',
        publishedDate: '2023-01-01T00:00:00.000Z',
        dependencies: [],
        downloadUrl: 'https://packages.fhir.org/hl7.fhir.uv.ips',
        canonicalUrl: 'http://hl7.org/fhir/uv/ips',
        keywords: ['ips', 'international-patient-summary'],
        status: 'active' as const
      }
    ];

    const matchingPackages = knownPackages.filter(pkg => 
      pkg.id.toLowerCase().includes(query.toLowerCase()) ||
      pkg.name.toLowerCase().includes(query.toLowerCase()) ||
      pkg.title.toLowerCase().includes(query.toLowerCase()) ||
      pkg.keywords.some(k => k.toLowerCase().includes(query.toLowerCase()))
    );

    return {
      packages: matchingPackages,
      profiles: [],
      total: matchingPackages.length,
      offset: 0,
      count: matchingPackages.length
    };
  }

  private async searchFhirRegistry(query: string, count = 20): Promise<SimplifierSearchResult> {
    try {
      // Try packages.fhir.org search
      const response: AxiosResponse = await axios.get(
        `https://packages.fhir.org/catalog`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'FHIR-Records-App/1.0'
          }
        }
      );

      // Filter packages based on query
      const allPackages = response.data || [];
      const matchingPackages = allPackages
        .filter((pkg: any) => 
          pkg.name?.toLowerCase().includes(query.toLowerCase()) ||
          pkg.title?.toLowerCase().includes(query.toLowerCase()) ||
          pkg.description?.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, count)
        .map((pkg: any) => ({
          id: pkg.name || pkg.id,
          name: pkg.name || pkg.id,
          title: pkg.title || pkg.name || pkg.id,
          description: pkg.description || '',
          version: pkg.version || '1.0.0',
          fhirVersion: pkg.fhirVersion || '4.0.1',
          author: pkg.author || 'Unknown',
          publishedDate: pkg.date || new Date().toISOString(),
          dependencies: pkg.dependencies || [],
          downloadUrl: `https://packages.fhir.org/${pkg.name || pkg.id}`,
          canonicalUrl: pkg.canonical || pkg.url,
          keywords: pkg.keywords || [],
          status: 'active' as const
        }));

      return {
        packages: matchingPackages,
        profiles: [],
        total: matchingPackages.length,
        offset: 0,
        count: matchingPackages.length
      };
    } catch (error: any) {
      console.error('Failed to search FHIR registry:', error);
      return { packages: [], profiles: [], total: 0, offset: 0, count: 0 };
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
      // First try NPM registry for packages that come from NPM
      const npmVersions = await this.getNpmPackageVersions(packageId);
      if (npmVersions.versions && Object.keys(npmVersions.versions).length > 0) {
        return npmVersions;
      }

      // Fallback to Simplifier.net API
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

  private async getNpmPackageVersions(packageId: string): Promise<{
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
        `https://registry.npmjs.org/${packageId}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'FHIR-Records-App/1.0'
          }
        }
      );

      const packageData = response.data;
      const versions: Record<string, { fhirVersion: string; date: string; description?: string; }> = {};

      // Process all versions
      for (const [version, versionData] of Object.entries(packageData.versions || {})) {
        const vData = versionData as any;
        versions[version] = {
          fhirVersion: this.extractFhirVersion(vData.keywords || []),
          date: packageData.time?.[version] || new Date().toISOString(),
          description: vData.description || ''
        };
      }

      return {
        versions,
        distTags: packageData['dist-tags'] || { latest: Object.keys(versions)[0] || '1.0.0' }
      };
    } catch (error: any) {
      console.error(`Failed to get NPM package versions for ${packageId}:`, error);
      return {
        versions: {},
        distTags: { latest: '1.0.0' }
      };
    }
  }
}

export const simplifierClient = new SimplifierClient();