/**
 * ProfileManager (Refactored)
 * 
 * Task 4.4: Main orchestrator for profile package management
 * Reduced from 826 lines to <400 lines by extracting services
 * 
 * Services used:
 * - ProfileCacheManager: Offline cache management
 * - ProfilePackageDownloader: Package downloads
 * - SimplifierClient: Package search and metadata
 * 
 * Responsibilities:
 * - Orchestrate package installation/uninstallation/updates
 * - Coordinate between downloader, cache, and database
 * - Provide high-level API for profile management
 */

import { simplifierClient, SimplifierPackage } from './simplifier-client';
import { storage } from '../../storage';
import { ValidationProfile, InsertValidationProfile } from '@shared/schema.js';
import { getProfileCacheManager } from './profile-cache-manager';
import { getProfilePackageDownloader } from './profile-package-downloader';

// ============================================================================
// Types
// ============================================================================

export interface InstalledPackage {
  id: string;
  name: string;
  version: string;
  installedDate: string;
  profileCount: number;
  status: 'active' | 'inactive' | 'error';
  updateAvailable?: boolean;
  latestVersion?: string;
}

export interface ProfileInstallResult {
  success: boolean;
  message: string;
  profilesInstalled?: number;
  errors?: string[];
}

// ============================================================================
// ProfileManager Class (Refactored)
// ============================================================================

export class ProfileManager {
  private cacheManager = getProfileCacheManager();
  private downloader = getProfilePackageDownloader();

  constructor() {
    console.log('[ProfileManager] Initialized (refactored version)');
  }

  // ==========================================================================
  // Package Search
  // ==========================================================================

  async searchPackages(query: string): Promise<SimplifierPackage[]> {
    try {
      const result = await simplifierClient.searchPackages(query);
      return result.packages;
    } catch (error) {
      console.error('[ProfileManager] Failed to search packages:', error);
      return [];
    }
  }

  // ==========================================================================
  // Package Installation
  // ==========================================================================

  async installPackage(packageId: string, version?: string): Promise<ProfileInstallResult> {
    try {
      console.log(`[ProfileManager] Installing package: ${packageId}@${version || 'latest'}`);

      // Check if already installed
      const existingProfiles = await storage.getValidationProfiles();
      const existingPackageProfiles = existingProfiles.filter(p => p.packageId === packageId);
      
      if (existingPackageProfiles.length > 0) {
        return {
          success: false,
          message: `Package ${packageId} is already installed. Use update instead.`
        };
      }

      // Check cache first
      const versionToInstall = version || 'latest';
      let packageData: Buffer | null = null;
      
      if (version) {
        packageData = await this.cacheManager.retrievePackage(packageId, version);
      }

      // Download if not cached
      if (!packageData) {
        const downloadResult = await this.downloader.downloadPackage(packageId, version);
        
        if (!downloadResult.success || !downloadResult.packageData) {
          return {
            success: false,
            message: downloadResult.message
          };
        }

        packageData = downloadResult.packageData;
        const actualVersion = downloadResult.metadata?.version || versionToInstall;

        // Store in cache
        await this.cacheManager.storePackage(packageId, actualVersion, packageData);
      }

      // Get profiles from package (simplified - would need proper extraction)
      const profiles = await simplifierClient.getPackageProfiles(packageId);
      
      let installedCount = 0;
      const errors: string[] = [];

      // Install each profile to database
      for (const profile of profiles) {
        try {
          const profileData: InsertValidationProfile = {
            packageId,
            name: profile.name,
            title: profile.title || profile.name,
            description: profile.description || '',
            url: profile.url,
            resourceType: profile.resourceType || 'StructureDefinition',
            version: profile.version || version || '1.0.0',
            fhirVersion: profile.fhirVersion || 'R4',
            config: profile.config || {}
          };

          await storage.createValidationProfile(profileData);
          installedCount++;
        } catch (error: any) {
          errors.push(`Failed to install profile ${profile.name}: ${error.message}`);
        }
      }

      return {
        success: installedCount > 0,
        message: `Installed ${installedCount} profiles from ${packageId}`,
        profilesInstalled: installedCount,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error: any) {
      console.error('[ProfileManager] Installation failed:', error);
      return {
        success: false,
        message: `Installation failed: ${error.message}`,
        errors: [error.message]
      };
    }
  }

  // ==========================================================================
  // Package Uninstallation
  // ==========================================================================

  async uninstallPackage(packageId: string): Promise<ProfileInstallResult> {
    try {
      console.log(`[ProfileManager] Uninstalling package: ${packageId}`);

      // Get profiles for this package
      const profiles = await storage.getValidationProfiles();
      const packageProfiles = profiles.filter(p => p.packageId === packageId);

      if (packageProfiles.length === 0) {
        return {
          success: false,
          message: `Package ${packageId} is not installed`
        };
      }

      // Delete profiles from database
      for (const profile of packageProfiles) {
        await storage.deleteValidationProfile(profile.id);
      }

      // Delete from cache (all versions)
      const cacheStats = await this.cacheManager.getCacheStats();
      const cachedVersions = cacheStats.packages.filter(p => p.packageId === packageId);
      
      for (const cached of cachedVersions) {
        await this.cacheManager.deletePackage(packageId, cached.version);
      }

      return {
        success: true,
        message: `Uninstalled ${packageProfiles.length} profiles from ${packageId}`,
        profilesInstalled: packageProfiles.length
      };

    } catch (error: any) {
      console.error('[ProfileManager] Uninstallation failed:', error);
      return {
        success: false,
        message: `Uninstallation failed: ${error.message}`,
        errors: [error.message]
      };
    }
  }

  // ==========================================================================
  // Package Update
  // ==========================================================================

  async updatePackage(packageId: string): Promise<ProfileInstallResult> {
    try {
      console.log(`[ProfileManager] Updating package: ${packageId}`);

      // Get current version
      const profiles = await storage.getValidationProfiles();
      const packageProfiles = profiles.filter(p => p.packageId === packageId);

      if (packageProfiles.length === 0) {
        return {
          success: false,
          message: `Package ${packageId} is not installed`
        };
      }

      const currentVersion = packageProfiles[0].version;

      // Check for updates
      const metadata = await this.downloader.getPackageMetadata(packageId);
      const latestVersion = metadata?.version;

      if (!latestVersion || latestVersion === currentVersion) {
        return {
          success: false,
          message: `Package ${packageId} is already up to date (${currentVersion})`
        };
      }

      // Uninstall old version
      await this.uninstallPackage(packageId);

      // Install new version
      return await this.installPackage(packageId, latestVersion);

    } catch (error: any) {
      console.error('[ProfileManager] Update failed:', error);
      return {
        success: false,
        message: `Update failed: ${error.message}`,
        errors: [error.message]
      };
    }
  }

  // ==========================================================================
  // Package Queries
  // ==========================================================================

  async getInstalledPackages(): Promise<InstalledPackage[]> {
    try {
      const profiles = await storage.getValidationProfiles();
      
      // Group by package
      const packageMap = new Map<string, ValidationProfile[]>();
      
      for (const profile of profiles) {
        if (!profile.packageId) continue;
        
        if (!packageMap.has(profile.packageId)) {
          packageMap.set(profile.packageId, []);
        }
        packageMap.get(profile.packageId)!.push(profile);
      }

      // Build installed packages list
      const installedPackages: InstalledPackage[] = [];

      for (const [packageId, packageProfiles] of packageMap.entries()) {
        const firstProfile = packageProfiles[0];
        
        installedPackages.push({
          id: packageId,
          name: packageId,
          version: firstProfile.version || 'unknown',
          installedDate: new Date().toISOString(), // Would need to track this
          profileCount: packageProfiles.length,
          status: 'active'
        });
      }

      return installedPackages;

    } catch (error: any) {
      console.error('[ProfileManager] Failed to get installed packages:', error);
      return [];
    }
  }

  async checkForUpdates(): Promise<{ packageId: string; currentVersion: string; latestVersion: string }[]> {
    const updates: { packageId: string; currentVersion: string; latestVersion: string }[] = [];

    try {
      const installed = await this.getInstalledPackages();

      for (const pkg of installed) {
        const metadata = await this.downloader.getPackageMetadata(pkg.id);
        
        if (metadata && metadata.version !== pkg.version) {
          updates.push({
            packageId: pkg.id,
            currentVersion: pkg.version,
            latestVersion: metadata.version
          });
        }
      }

    } catch (error) {
      console.error('[ProfileManager] Failed to check for updates:', error);
    }

    return updates;
  }

  async getPackageVersions(packageId: string): Promise<{ versions: string[]; current?: string }> {
    try {
      // Get current installed version
      const profiles = await storage.getValidationProfiles();
      const packageProfiles = profiles.filter(p => p.packageId === packageId);
      const currentVersion = packageProfiles[0]?.version;

      // Get available versions (simplified - would need proper API)
      const metadata = await this.downloader.getPackageMetadata(packageId);
      const availableVersions = metadata ? [metadata.version] : [];

      return {
        versions: availableVersions,
        current: currentVersion
      };

    } catch (error) {
      console.error('[ProfileManager] Failed to get package versions:', error);
      return { versions: [] };
    }
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  async getCacheStats() {
    return await this.cacheManager.getCacheStats();
  }

  async clearCache() {
    return await this.cacheManager.clearCache();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let profileManager: ProfileManager | null = null;

export function getProfileManager(): ProfileManager {
  if (!profileManager) {
    profileManager = new ProfileManager();
  }
  return profileManager;
}

export const profileManager = new ProfileManager();
export default profileManager;

