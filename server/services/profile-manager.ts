import { simplifierClient, SimplifierPackage, SimplifierProfile } from './simplifier-client.js';
import { storage } from '../storage.js';
import { ValidationProfile, InsertValidationProfile } from '@shared/schema.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROFILES_DIR = path.join(__dirname, '../../profiles');

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

export class ProfileManager {
  constructor() {
    this.ensureProfilesDirectory();
  }

  private async ensureProfilesDirectory(): Promise<void> {
    try {
      await fs.mkdir(PROFILES_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create profiles directory:', error);
    }
  }

  async searchPackages(query: string): Promise<SimplifierPackage[]> {
    try {
      const result = await simplifierClient.searchPackages(query);
      return result.packages;
    } catch (error) {
      console.error('Failed to search packages:', error);
      return [];
    }
  }

  async installPackage(packageId: string, version?: string): Promise<ProfileInstallResult> {
    try {
      // Check if package already exists
      const existingProfiles = await storage.getValidationProfiles();
      const existingPackageProfiles = existingProfiles.filter(p => p.packageId === packageId);
      
      if (existingPackageProfiles.length > 0) {
        return {
          success: false,
          message: `Package ${packageId} is already installed. Use update instead.`
        };
      }

      // Get package details
      const packageDetails = await simplifierClient.getPackageDetails(packageId);
      if (!packageDetails) {
        return {
          success: false,
          message: `Package ${packageId} not found on Simplifier.net`
        };
      }

      // Download package content
      const packageData = await simplifierClient.downloadPackage(packageId, version);
      if (!packageData) {
        return {
          success: false,
          message: `Failed to download package ${packageId}`
        };
      }

      // Save package locally
      const packageDir = path.join(PROFILES_DIR, packageId);
      await fs.mkdir(packageDir, { recursive: true });
      
      const packagePath = path.join(packageDir, `${packageId}-${packageDetails.version}.tgz`);
      await fs.writeFile(packagePath, packageData);

      // Get profiles from the package
      const profiles = await simplifierClient.getPackageProfiles(packageId);
      
      let installedCount = 0;
      const errors: string[] = [];

      // Install each profile
      for (const profile of profiles) {
        try {
          const validationProfile: InsertValidationProfile = {
            name: profile.name,
            title: profile.title,
            description: profile.description,
            version: profile.version,
            url: profile.url,
            resourceType: profile.type,
            packageId: packageId,
            packageVersion: packageDetails.version,
            status: profile.status,
            isActive: true,
            config: {
              kind: profile.kind,
              abstract: profile.abstract,
              baseDefinition: profile.baseDefinition,
              context: profile.context
            }
          };

          await storage.createValidationProfile(validationProfile);
          installedCount++;
        } catch (error: any) {
          errors.push(`Failed to install profile ${profile.name}: ${error.message}`);
        }
      }

      // Create package metadata file
      const packageMeta = {
        id: packageId,
        name: packageDetails.name,
        title: packageDetails.title,
        version: packageDetails.version,
        installedDate: new Date().toISOString(),
        profileCount: installedCount,
        author: packageDetails.author,
        description: packageDetails.description,
        fhirVersion: packageDetails.fhirVersion
      };

      await fs.writeFile(
        path.join(packageDir, 'package.json'),
        JSON.stringify(packageMeta, null, 2)
      );

      return {
        success: true,
        message: `Successfully installed package ${packageDetails.title} (${installedCount} profiles)`,
        profilesInstalled: installedCount,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to install package: ${error.message}`
      };
    }
  }

  async uninstallPackage(packageId: string): Promise<ProfileInstallResult> {
    try {
      // Get all profiles for this package
      const profiles = await storage.getValidationProfiles();
      const packageProfiles = profiles.filter(p => p.packageId === packageId);

      if (packageProfiles.length === 0) {
        return {
          success: false,
          message: `Package ${packageId} is not installed`
        };
      }

      // Remove profiles from database
      let removedCount = 0;
      const errors: string[] = [];

      for (const profile of packageProfiles) {
        try {
          // Note: This would require adding a delete method to storage
          // For now, we'll mark profiles as inactive
          await storage.updateValidationProfile(profile.id, { isActive: false, status: 'retired' });
          removedCount++;
        } catch (error: any) {
          errors.push(`Failed to remove profile ${profile.name}: ${error.message}`);
        }
      }

      // Remove package directory
      const packageDir = path.join(PROFILES_DIR, packageId);
      try {
        await fs.rm(packageDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to remove package directory: ${error}`);
      }

      return {
        success: true,
        message: `Successfully uninstalled package ${packageId} (${removedCount} profiles)`,
        profilesInstalled: removedCount,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to uninstall package: ${error.message}`
      };
    }
  }

  async updatePackage(packageId: string): Promise<ProfileInstallResult> {
    try {
      // Check current version
      const packageDir = path.join(PROFILES_DIR, packageId);
      let currentVersion: string | null = null;
      
      try {
        const packageMetaPath = path.join(packageDir, 'package.json');
        const packageMeta = JSON.parse(await fs.readFile(packageMetaPath, 'utf-8'));
        currentVersion = packageMeta.version;
      } catch (error) {
        return {
          success: false,
          message: `Package ${packageId} is not installed`
        };
      }

      // Get latest version
      const latestVersion = await simplifierClient.getLatestVersion(packageId);
      if (!latestVersion) {
        return {
          success: false,
          message: `Could not determine latest version for ${packageId}`
        };
      }

      if (currentVersion === latestVersion) {
        return {
          success: true,
          message: `Package ${packageId} is already up to date (${currentVersion})`
        };
      }

      // Uninstall current version
      const uninstallResult = await this.uninstallPackage(packageId);
      if (!uninstallResult.success) {
        return uninstallResult;
      }

      // Install latest version
      const installResult = await this.installPackage(packageId, latestVersion);
      if (installResult.success) {
        installResult.message = `Successfully updated ${packageId} from ${currentVersion} to ${latestVersion}`;
      }

      return installResult;
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to update package: ${error.message}`
      };
    }
  }

  async getInstalledPackages(): Promise<InstalledPackage[]> {
    try {
      const packagesDir = await fs.readdir(PROFILES_DIR);
      const installedPackages: InstalledPackage[] = [];

      for (const packageId of packagesDir) {
        const packageDir = path.join(PROFILES_DIR, packageId);
        const stats = await fs.stat(packageDir);
        
        if (!stats.isDirectory()) continue;

        try {
          const packageMetaPath = path.join(packageDir, 'package.json');
          const packageMeta = JSON.parse(await fs.readFile(packageMetaPath, 'utf-8'));
          
          // Check for updates
          const latestVersion = await simplifierClient.getLatestVersion(packageId);
          const updateAvailable = !!(latestVersion && latestVersion !== packageMeta.version);

          // Get current profile count
          const profiles = await storage.getValidationProfiles();
          const packageProfiles = profiles.filter(p => p.packageId === packageId && p.isActive);

          installedPackages.push({
            id: packageId,
            name: packageMeta.name || packageId,
            version: packageMeta.version,
            installedDate: packageMeta.installedDate,
            profileCount: packageProfiles.length,
            status: packageProfiles.length > 0 ? 'active' : 'inactive',
            updateAvailable: updateAvailable || undefined,
            latestVersion: latestVersion ?? undefined
          });
        } catch (error) {
          console.warn(`Failed to read package metadata for ${packageId}:`, error);
        }
      }

      return installedPackages;
    } catch (error: any) {
      console.error('Failed to get installed packages:', error);
      return [];
    }
  }

  async checkForUpdates(): Promise<{ packageId: string; currentVersion: string; latestVersion: string }[]> {
    const installedPackages = await this.getInstalledPackages();
    const updatesAvailable = [];

    for (const pkg of installedPackages) {
      if (pkg.updateAvailable && pkg.latestVersion) {
        updatesAvailable.push({
          packageId: pkg.id,
          currentVersion: pkg.version,
          latestVersion: pkg.latestVersion
        });
      }
    }

    return updatesAvailable;
  }
}

export const profileManager = new ProfileManager();