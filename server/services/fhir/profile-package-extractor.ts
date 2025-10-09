/**
 * ProfilePackageExtractor
 * 
 * Task 4.6: Extract StructureDefinitions from .tgz FHIR packages
 * 
 * Responsibilities:
 * - Extract .tgz (tar.gz) package files
 * - Parse package.json manifest
 * - Locate and extract StructureDefinition JSON files
 * - Validate extracted profiles
 */

import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Extract } from 'tar';
import { createGunzip } from 'zlib';
import { existsSync } from 'fs';

// ============================================================================
// Types
// ============================================================================

export interface PackageManifest {
  name: string;
  version: string;
  fhirVersion?: string;
  description?: string;
  author?: string;
  dependencies?: Record<string, string>;
}

export interface StructureDefinitionProfile {
  id: string;
  url: string;
  name: string;
  title?: string;
  description?: string;
  resourceType: string;
  type: string;
  baseDefinition?: string;
  derivation?: string;
  fhirVersion?: string;
  kind?: string;
  abstract?: boolean;
  status?: string;
  content?: any; // Full StructureDefinition JSON
}

export interface ExtractionResult {
  success: boolean;
  message: string;
  manifest?: PackageManifest;
  profiles: StructureDefinitionProfile[];
  errors?: string[];
}

// ============================================================================
// ProfilePackageExtractor Class
// ============================================================================

export class ProfilePackageExtractor {

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Extract profiles from .tgz package file
   */
  async extractPackage(packagePath: string, outputDir: string): Promise<ExtractionResult> {
    const errors: string[] = [];
    
    try {
      console.log(`[ProfilePackageExtractor] Extracting package: ${packagePath}`);

      // Verify package exists
      if (!existsSync(packagePath)) {
        return {
          success: false,
          message: 'Package file not found',
          profiles: [],
          errors: ['Package file does not exist']
        };
      }

      // Create output directory
      await fs.mkdir(outputDir, { recursive: true });

      // Extract .tgz
      await this.extractTarGz(packagePath, outputDir);

      // Read package.json manifest
      const manifest = await this.readManifest(outputDir);

      // Find and parse StructureDefinitions
      const profiles = await this.findStructureDefinitions(outputDir);

      console.log(`[ProfilePackageExtractor] Extracted ${profiles.length} profiles from package`);

      return {
        success: true,
        message: `Extracted ${profiles.length} profiles`,
        manifest,
        profiles,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error: any) {
      console.error('[ProfilePackageExtractor] Extraction failed:', error);
      return {
        success: false,
        message: `Extraction failed: ${error.message}`,
        profiles: [],
        errors: [error.message]
      };
    }
  }

  /**
   * Extract profiles directly from buffer (without saving to disk)
   */
  async extractFromBuffer(packageBuffer: Buffer): Promise<ExtractionResult> {
    const tempDir = path.join('/tmp', `fhir-package-${Date.now()}`);
    const tempFile = path.join(tempDir, 'package.tgz');

    try {
      // Create temp directory
      await fs.mkdir(tempDir, { recursive: true });

      // Write buffer to temp file
      await fs.writeFile(tempFile, packageBuffer);

      // Extract
      const result = await this.extractPackage(tempFile, tempDir);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      return result;

    } catch (error: any) {
      // Cleanup on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {}

      return {
        success: false,
        message: `Buffer extraction failed: ${error.message}`,
        profiles: [],
        errors: [error.message]
      };
    }
  }

  // ==========================================================================
  // Extraction Logic
  // ==========================================================================

  /**
   * Extract tar.gz file
   */
  private async extractTarGz(tarGzPath: string, outputDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const readStream = createReadStream(tarGzPath);
      const gunzip = createGunzip();
      const extract = Extract({ cwd: outputDir, strip: 1 }); // strip=1 removes top-level "package/" folder

      readStream
        .pipe(gunzip)
        .pipe(extract)
        .on('finish', () => {
          console.log('[ProfilePackageExtractor] Extraction complete');
          resolve();
        })
        .on('error', (error) => {
          console.error('[ProfilePackageExtractor] Extraction error:', error);
          reject(error);
        });
    });
  }

  /**
   * Read package.json manifest
   */
  private async readManifest(packageDir: string): Promise<PackageManifest | undefined> {
    const manifestPath = path.join(packageDir, 'package.json');

    if (!existsSync(manifestPath)) {
      console.warn('[ProfilePackageExtractor] No package.json found');
      return undefined;
    }

    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      return {
        name: manifest.name,
        version: manifest.version,
        fhirVersion: manifest.fhirVersion || manifest['fhir-version'] || manifest.fhirVersions?.[0],
        description: manifest.description,
        author: manifest.author,
        dependencies: manifest.dependencies
      };
    } catch (error) {
      console.error('[ProfilePackageExtractor] Failed to parse manifest:', error);
      return undefined;
    }
  }

  /**
   * Find all StructureDefinition JSON files in package
   */
  private async findStructureDefinitions(packageDir: string): Promise<StructureDefinitionProfile[]> {
    const profiles: StructureDefinitionProfile[] = [];

    try {
      // Common directories for StructureDefinitions in FHIR packages
      const searchDirs = [
        path.join(packageDir, 'package'),
        path.join(packageDir, 'StructureDefinition'),
        packageDir // Sometimes profiles are in root
      ];

      for (const dir of searchDirs) {
        if (existsSync(dir)) {
          const foundProfiles = await this.scanDirectoryForProfiles(dir);
          profiles.push(...foundProfiles);
        }
      }

      // Remove duplicates based on URL
      const uniqueProfiles = profiles.filter((profile, index, self) =>
        index === self.findIndex(p => p.url === profile.url)
      );

      return uniqueProfiles;

    } catch (error) {
      console.error('[ProfilePackageExtractor] Failed to find profiles:', error);
      return [];
    }
  }

  /**
   * Recursively scan directory for StructureDefinition JSON files
   */
  private async scanDirectoryForProfiles(dir: string): Promise<StructureDefinitionProfile[]> {
    const profiles: StructureDefinitionProfile[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Recurse into subdirectories
          const subProfiles = await this.scanDirectoryForProfiles(fullPath);
          profiles.push(...subProfiles);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          // Try to parse as StructureDefinition
          const profile = await this.parseStructureDefinition(fullPath);
          if (profile) {
            profiles.push(profile);
          }
        }
      }
    } catch (error) {
      console.error(`[ProfilePackageExtractor] Failed to scan directory ${dir}:`, error);
    }

    return profiles;
  }

  /**
   * Parse StructureDefinition JSON file
   */
  private async parseStructureDefinition(filePath: string): Promise<StructureDefinitionProfile | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const json = JSON.parse(content);

      // Check if it's a StructureDefinition
      if (json.resourceType !== 'StructureDefinition') {
        return null;
      }

      return {
        id: json.id,
        url: json.url,
        name: json.name,
        title: json.title,
        description: json.description,
        resourceType: json.resourceType,
        type: json.type,
        baseDefinition: json.baseDefinition,
        derivation: json.derivation,
        fhirVersion: json.fhirVersion,
        kind: json.kind,
        abstract: json.abstract,
        status: json.status,
        content: json // Store full definition
      };

    } catch (error) {
      // Not a valid JSON or StructureDefinition - ignore
      return null;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let profilePackageExtractor: ProfilePackageExtractor | null = null;

export function getProfilePackageExtractor(): ProfilePackageExtractor {
  if (!profilePackageExtractor) {
    profilePackageExtractor = new ProfilePackageExtractor();
  }
  return profilePackageExtractor;
}

export default ProfilePackageExtractor;

