/**
 * ProfileCacheManager
 * 
 * Task 4.4/4.5: Offline cache management for FHIR profile packages
 * 
 * Responsibilities:
 * - Manage offline cache directory structure
 * - Handle package file storage and retrieval
 * - Cache cleanup and size management
 * - Version-specific cache paths
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

export interface CacheConfig {
  cacheDirectory: string;
  maxCacheSize: number; // in bytes
  autoCleanup: boolean;
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  cacheDirectory: process.env.FHIR_PROFILE_CACHE_DIR || path.join(__dirname, '../../profiles'),
  maxCacheSize: 5 * 1024 * 1024 * 1024, // 5GB
  autoCleanup: true
};

// ============================================================================
// Types
// ============================================================================

export interface CachedPackage {
  packageId: string;
  version: string;
  path: string;
  size: number;
  cachedAt: Date;
}

export interface CacheStats {
  totalPackages: number;
  totalSize: number;
  availableSpace: number;
  packages: CachedPackage[];
}

// ============================================================================
// ProfileCacheManager Class
// ============================================================================

export class ProfileCacheManager {
  private config: CacheConfig;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.ensureCacheDirectory();
  }

  // ==========================================================================
  // Directory Management
  // ==========================================================================

  /**
   * Ensure cache directory exists
   */
  private async ensureCacheDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.cacheDirectory, { recursive: true });
      console.log(`[ProfileCacheManager] Cache directory ready: ${this.config.cacheDirectory}`);
    } catch (error) {
      console.error('[ProfileCacheManager] Failed to create cache directory:', error);
    }
  }

  /**
   * Get package cache directory path
   * Format: /opt/fhir/igs/{package-id}/{version}/
   */
  getPackageCacheDir(packageId: string, version: string): string {
    return path.join(this.config.cacheDirectory, packageId, version);
  }

  /**
   * Get package file path (.tgz)
   */
  getPackageFilePath(packageId: string, version: string): string {
    return path.join(
      this.getPackageCacheDir(packageId, version),
      `${packageId}-${version}.tgz`
    );
  }

  /**
   * Check if package is cached
   */
  async isPackageCached(packageId: string, version: string): Promise<boolean> {
    const packagePath = this.getPackageFilePath(packageId, version);
    return existsSync(packagePath);
  }

  // ==========================================================================
  // Package Storage
  // ==========================================================================

  /**
   * Store package in cache
   */
  async storePackage(
    packageId: string,
    version: string,
    packageData: Buffer
  ): Promise<string> {
    const packageDir = this.getPackageCacheDir(packageId, version);
    const packagePath = this.getPackageFilePath(packageId, version);

    // Create directory
    await fs.mkdir(packageDir, { recursive: true });

    // Check available space before writing
    if (this.config.autoCleanup) {
      const stats = await this.getCacheStats();
      const requiredSpace = packageData.length;

      if (stats.totalSize + requiredSpace > this.config.maxCacheSize) {
        console.log('[ProfileCacheManager] Cache size limit reached, cleaning up...');
        await this.cleanupOldestPackages(requiredSpace);
      }
    }

    // Write package file
    await fs.writeFile(packagePath, packageData);

    console.log(`[ProfileCacheManager] Stored package: ${packageId}@${version} (${packageData.length} bytes)`);

    return packagePath;
  }

  /**
   * Retrieve package from cache
   */
  async retrievePackage(packageId: string, version: string): Promise<Buffer | null> {
    const packagePath = this.getPackageFilePath(packageId, version);

    if (!existsSync(packagePath)) {
      console.log(`[ProfileCacheManager] Package not found in cache: ${packageId}@${version}`);
      return null;
    }

    try {
      const data = await fs.readFile(packagePath);
      console.log(`[ProfileCacheManager] Retrieved package from cache: ${packageId}@${version}`);
      return data;
    } catch (error) {
      console.error(`[ProfileCacheManager] Failed to read cached package:`, error);
      return null;
    }
  }

  /**
   * Delete package from cache
   */
  async deletePackage(packageId: string, version: string): Promise<boolean> {
    const packageDir = this.getPackageCacheDir(packageId, version);

    if (!existsSync(packageDir)) {
      return false;
    }

    try {
      await fs.rm(packageDir, { recursive: true, force: true });
      console.log(`[ProfileCacheManager] Deleted package: ${packageId}@${version}`);
      return true;
    } catch (error) {
      console.error(`[ProfileCacheManager] Failed to delete package:`, error);
      return false;
    }
  }

  // ==========================================================================
  // Cache Statistics & Cleanup
  // ==========================================================================

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    const packages: CachedPackage[] = [];
    let totalSize = 0;

    try {
      // List all packages in cache
      const packageIds = await fs.readdir(this.config.cacheDirectory);

      for (const packageId of packageIds) {
        const packagePath = path.join(this.config.cacheDirectory, packageId);
        const stat = await fs.stat(packagePath);

        if (!stat.isDirectory()) continue;

        // List versions
        const versions = await fs.readdir(packagePath);

        for (const version of versions) {
          const versionPath = path.join(packagePath, version);
          const versionStat = await fs.stat(versionPath);

          if (!versionStat.isDirectory()) continue;

          // Get package file
          const packageFile = path.join(versionPath, `${packageId}-${version}.tgz`);

          if (existsSync(packageFile)) {
            const fileStat = await fs.stat(packageFile);
            const size = fileStat.size;
            totalSize += size;

            packages.push({
              packageId,
              version,
              path: packageFile,
              size,
              cachedAt: fileStat.mtime
            });
          }
        }
      }
    } catch (error) {
      console.error('[ProfileCacheManager] Failed to get cache stats:', error);
    }

    return {
      totalPackages: packages.length,
      totalSize,
      availableSpace: this.config.maxCacheSize - totalSize,
      packages: packages.sort((a, b) => a.cachedAt.getTime() - b.cachedAt.getTime())
    };
  }

  /**
   * Clean up oldest packages to free space
   */
  private async cleanupOldestPackages(requiredSpace: number): Promise<void> {
    const stats = await this.getCacheStats();
    let freedSpace = 0;

    // Sort by oldest first
    const sortedPackages = stats.packages.sort((a, b) => 
      a.cachedAt.getTime() - b.cachedAt.getTime()
    );

    for (const pkg of sortedPackages) {
      if (freedSpace >= requiredSpace) {
        break;
      }

      const deleted = await this.deletePackage(pkg.packageId, pkg.version);
      if (deleted) {
        freedSpace += pkg.size;
        console.log(`[ProfileCacheManager] Cleaned up ${pkg.packageId}@${pkg.version} (freed ${pkg.size} bytes)`);
      }
    }

    console.log(`[ProfileCacheManager] Cleanup complete. Freed ${freedSpace} bytes`);
  }

  /**
   * Clear entire cache
   */
  async clearCache(): Promise<void> {
    try {
      await fs.rm(this.config.cacheDirectory, { recursive: true, force: true });
      await this.ensureCacheDirectory();
      console.log('[ProfileCacheManager] Cache cleared successfully');
    } catch (error) {
      console.error('[ProfileCacheManager] Failed to clear cache:', error);
    }
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Get cache directory path
   */
  getCacheDirectory(): string {
    return this.config.cacheDirectory;
  }

  /**
   * Get cache configuration
   */
  getCacheConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   */
  updateCacheConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[ProfileCacheManager] Configuration updated:', this.config);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let profileCacheManager: ProfileCacheManager | null = null;

export function getProfileCacheManager(config?: Partial<CacheConfig>): ProfileCacheManager {
  if (!profileCacheManager) {
    profileCacheManager = new ProfileCacheManager(config);
  }
  return profileCacheManager;
}

export default ProfileCacheManager;

