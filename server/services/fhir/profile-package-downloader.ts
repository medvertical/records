/**
 * ProfilePackageDownloader
 * 
 * Task 4.4: Package download logic extracted from ProfileManager
 * 
 * Responsibilities:
 * - Download packages from Simplifier.net
 * - Download packages from FHIR Package Registry
 * - Handle package metadata
 * - Retry logic for downloads
 */

import { simplifierClient, SimplifierPackage } from './simplifier-client';
import axios, { AxiosResponse } from 'axios';
import profilePackagesConfig from '../../config/profile-packages.json' assert { type: 'json' };

// ============================================================================
// Types
// ============================================================================

export interface PackageDownloadResult {
  success: boolean;
  message: string;
  packageData?: Buffer;
  metadata?: PackageMetadata;
}

export interface PackageMetadata {
  id: string;
  name: string;
  version: string;
  fhirVersion: string;
  canonical?: string;
  description?: string;
  author?: string;
  publishedDate?: string;
}

// ============================================================================
// ProfilePackageDownloader Class
// ============================================================================

export class ProfilePackageDownloader {
  private fhirRegistryUrl = 'https://packages.fhir.org';
  private simplifierPackageUrl = 'https://packages.simplifier.net';

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Download package from any available source
   */
  async downloadPackage(
    packageId: string,
    version?: string
  ): Promise<PackageDownloadResult> {
    console.log(`[ProfilePackageDownloader] Downloading ${packageId}@${version || 'latest'}...`);

    // Try config first (fastest)
    const configResult = await this.downloadFromConfig(packageId, version);
    if (configResult.success) {
      return configResult;
    }

    // Try Simplifier
    const simplifierResult = await this.downloadFromSimplifier(packageId, version);
    if (simplifierResult.success) {
      return simplifierResult;
    }

    // Try FHIR Package Registry
    const registryResult = await this.downloadFromRegistry(packageId, version);
    if (registryResult.success) {
      return registryResult;
    }

    return {
      success: false,
      message: `Package ${packageId} not found in any source`
    };
  }

  /**
   * Get package metadata without downloading
   */
  async getPackageMetadata(packageId: string): Promise<PackageMetadata | null> {
    // Try Simplifier first
    try {
      const details = await simplifierClient.getPackageDetails(packageId);
      if (details) {
        return {
          id: packageId,
          name: details.name || packageId,
          version: details.version || 'unknown',
          fhirVersion: details.fhirVersion || 'R4',
          canonical: details.canonicalUrl,
          description: details.description,
          author: details.author,
          publishedDate: details.publishedDate
        };
      }
    } catch (error) {
      console.debug(`[ProfilePackageDownloader] Simplifier metadata failed for ${packageId}`);
    }

    // Try config as fallback
    const configPackage = this.findInConfig(packageId);
    if (configPackage) {
      return {
        id: packageId,
        name: configPackage.name,
        version: configPackage.version,
        fhirVersion: configPackage.fhirVersion,
        canonical: configPackage.canonical,
        description: configPackage.description
      };
    }

    return null;
  }

  // ==========================================================================
  // Download Sources
  // ==========================================================================

  /**
   * Download from profile-packages.json config
   */
  private async downloadFromConfig(
    packageId: string,
    version?: string
  ): Promise<PackageDownloadResult> {
    const configPackage = this.findInConfig(packageId);
    
    if (!configPackage) {
      return { success: false, message: 'Package not found in config' };
    }

    if (version && configPackage.version !== version) {
      return { success: false, message: 'Version mismatch' };
    }

    // Download from configured URL
    if (configPackage.downloadUrl) {
      try {
        const response: AxiosResponse = await axios.get(configPackage.downloadUrl, {
          responseType: 'arraybuffer',
          timeout: 60000
        });

        return {
          success: true,
          message: `Downloaded from config: ${packageId}@${configPackage.version}`,
          packageData: Buffer.from(response.data),
          metadata: {
            id: packageId,
            name: configPackage.name,
            version: configPackage.version,
            fhirVersion: configPackage.fhirVersion,
            canonical: configPackage.canonical,
            description: configPackage.description
          }
        };
      } catch (error: any) {
        console.error(`[ProfilePackageDownloader] Config download failed:`, error.message);
        return { success: false, message: `Download failed: ${error.message}` };
      }
    }

    return { success: false, message: 'No download URL in config' };
  }

  /**
   * Download from Simplifier.net
   */
  private async downloadFromSimplifier(
    packageId: string,
    version?: string
  ): Promise<PackageDownloadResult> {
    try {
      const packageData = await simplifierClient.downloadPackage(packageId, version);
      
      if (!packageData) {
        return { success: false, message: 'Simplifier download returned null' };
      }

      const metadata = await this.getPackageMetadata(packageId);

      return {
        success: true,
        message: `Downloaded from Simplifier: ${packageId}`,
        packageData,
        metadata: metadata || undefined
      };
    } catch (error: any) {
      console.error(`[ProfilePackageDownloader] Simplifier download failed:`, error.message);
      return { success: false, message: `Simplifier failed: ${error.message}` };
    }
  }

  /**
   * Download from FHIR Package Registry
   */
  private async downloadFromRegistry(
    packageId: string,
    version?: string
  ): Promise<PackageDownloadResult> {
    try {
      const versionToUse = version || await this.getLatestVersion(packageId);
      
      if (!versionToUse) {
        return { success: false, message: 'No version found' };
      }

      const downloadUrl = `${this.fhirRegistryUrl}/${packageId}/${versionToUse}`;
      
      const response: AxiosResponse = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'Accept': 'application/tar+gzip',
          'User-Agent': 'FHIR-Records-App/1.0'
        }
      });

      return {
        success: true,
        message: `Downloaded from FHIR Registry: ${packageId}@${versionToUse}`,
        packageData: Buffer.from(response.data),
        metadata: {
          id: packageId,
          name: packageId,
          version: versionToUse,
          fhirVersion: 'R4' // Default, would need to parse package.json
        }
      };
    } catch (error: any) {
      console.error(`[ProfilePackageDownloader] Registry download failed:`, error.message);
      return { success: false, message: `Registry failed: ${error.message}` };
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Find package in configuration
   */
  private findInConfig(packageId: string): any {
    // Search German profiles
    for (const category of Object.values(profilePackagesConfig.germanProfiles)) {
      const pkg = (category as any).packages.find((p: any) => p.id === packageId);
      if (pkg) return pkg;
    }

    // Search international profiles
    for (const category of Object.values(profilePackagesConfig.internationalProfiles)) {
      const pkg = (category as any).packages.find((p: any) => p.id === packageId);
      if (pkg) return pkg;
    }

    return null;
  }

  /**
   * Get latest version from registry
   */
  private async getLatestVersion(packageId: string): Promise<string | null> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.fhirRegistryUrl}/${packageId}`,
        { timeout: 10000 }
      );

      return response.data['dist-tags']?.latest || null;
    } catch (error) {
      return null;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let profilePackageDownloader: ProfilePackageDownloader | null = null;

export function getProfilePackageDownloader(): ProfilePackageDownloader {
  if (!profilePackageDownloader) {
    profilePackageDownloader = new ProfilePackageDownloader();
  }
  return profilePackageDownloader;
}

export default ProfilePackageDownloader;

