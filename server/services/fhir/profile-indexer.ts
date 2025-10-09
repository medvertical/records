/**
 * ProfileIndexer
 * 
 * Task 4.7: Index StructureDefinitions from packages into database
 * 
 * Responsibilities:
 * - Index extracted profiles to validation_profiles table
 * - Handle profile updates and versioning
 * - Validate profile data before indexing
 * - Provide search and lookup functions
 */

import { storage } from '../../storage';
import { InsertValidationProfile, ValidationProfile } from '@shared/schema.js';
import { StructureDefinitionProfile } from './profile-package-extractor';

// ============================================================================
// Types
// ============================================================================

export interface IndexingResult {
  success: boolean;
  message: string;
  indexed: number;
  skipped: number;
  errors?: string[];
}

export interface ProfileLookupOptions {
  url?: string;
  packageId?: string;
  fhirVersion?: string;
  resourceType?: string;
}

// ============================================================================
// ProfileIndexer Class
// ============================================================================

export class ProfileIndexer {

  // ==========================================================================
  // Indexing
  // ==========================================================================

  /**
   * Index profiles from extraction result
   */
  async indexProfiles(
    packageId: string,
    profiles: StructureDefinitionProfile[],
    options?: { overwrite?: boolean }
  ): Promise<IndexingResult> {
    const errors: string[] = [];
    let indexed = 0;
    let skipped = 0;

    try {
      console.log(`[ProfileIndexer] Indexing ${profiles.length} profiles for package ${packageId}`);

      for (const profile of profiles) {
        try {
          const indexed_success = await this.indexProfile(packageId, profile, options);
          
          if (indexed_success) {
            indexed++;
          } else {
            skipped++;
          }
        } catch (error: any) {
          errors.push(`Failed to index ${profile.name || profile.url}: ${error.message}`);
          skipped++;
        }
      }

      return {
        success: indexed > 0,
        message: `Indexed ${indexed} profiles, skipped ${skipped}`,
        indexed,
        skipped,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error: any) {
      console.error('[ProfileIndexer] Indexing failed:', error);
      return {
        success: false,
        message: `Indexing failed: ${error.message}`,
        indexed: 0,
        skipped: profiles.length,
        errors: [error.message]
      };
    }
  }

  /**
   * Index a single profile
   */
  private async indexProfile(
    packageId: string,
    profile: StructureDefinitionProfile,
    options?: { overwrite?: boolean }
  ): Promise<boolean> {
    // Validate profile data
    if (!profile.url || !profile.name) {
      console.warn(`[ProfileIndexer] Skipping invalid profile (missing url or name)`);
      return false;
    }

    // Check if profile already exists
    const existingProfiles = await storage.getValidationProfiles();
    const existing = existingProfiles.find(p => p.url === profile.url && p.packageId === packageId);

    if (existing) {
      if (!options?.overwrite) {
        console.log(`[ProfileIndexer] Profile already exists: ${profile.url}`);
        return false; // Skipped
      }

      // Update existing
      await this.updateProfile(existing.id, profile);
      return true;
    }

    // Insert new profile
    const profileData: InsertValidationProfile = {
      packageId,
      name: profile.name,
      title: profile.title || profile.name,
      description: profile.description || '',
      url: profile.url,
      resourceType: profile.type || 'StructureDefinition',
      version: profile.content?.version || '1.0.0',
      fhirVersion: profile.fhirVersion || profile.content?.fhirVersion || 'R4',
      config: {
        id: profile.id,
        kind: profile.kind,
        abstract: profile.abstract,
        status: profile.status,
        baseDefinition: profile.baseDefinition,
        derivation: profile.derivation,
        // Store full StructureDefinition for validation
        structureDefinition: profile.content
      }
    };

    await storage.createValidationProfile(profileData);
    console.log(`[ProfileIndexer] Indexed profile: ${profile.name} (${profile.url})`);
    
    return true;
  }

  /**
   * Update existing profile
   */
  private async updateProfile(
    profileId: number,
    profile: StructureDefinitionProfile
  ): Promise<void> {
    // Note: storage.updateValidationProfile would need to be implemented
    // For now, we'll log it
    console.log(`[ProfileIndexer] Profile update not yet implemented: ${profileId}`);
    
    // Implementation would be:
    // await storage.updateValidationProfile(profileId, {
    //   title: profile.title || profile.name,
    //   description: profile.description || '',
    //   version: profile.content?.version || '1.0.0',
    //   config: { ...profile.content }
    // });
  }

  // ==========================================================================
  // Profile Lookup
  // ==========================================================================

  /**
   * Find profile by URL
   */
  async findProfileByUrl(url: string, packageId?: string): Promise<ValidationProfile | null> {
    try {
      const profiles = await storage.getValidationProfiles();
      
      const matches = profiles.filter(p => p.url === url);
      
      if (matches.length === 0) {
        return null;
      }

      // If packageId specified, prefer that package
      if (packageId) {
        const packageMatch = matches.find(p => p.packageId === packageId);
        if (packageMatch) {
          return packageMatch;
        }
      }

      // Return first match (could be enhanced with version resolution)
      return matches[0];

    } catch (error) {
      console.error('[ProfileIndexer] Profile lookup failed:', error);
      return null;
    }
  }

  /**
   * Search profiles by criteria
   */
  async searchProfiles(options: ProfileLookupOptions): Promise<ValidationProfile[]> {
    try {
      let profiles = await storage.getValidationProfiles();

      // Filter by URL pattern
      if (options.url) {
        profiles = profiles.filter(p => 
          p.url.toLowerCase().includes(options.url!.toLowerCase())
        );
      }

      // Filter by package
      if (options.packageId) {
        profiles = profiles.filter(p => p.packageId === options.packageId);
      }

      // Filter by FHIR version
      if (options.fhirVersion) {
        profiles = profiles.filter(p => p.fhirVersion === options.fhirVersion);
      }

      // Filter by resource type
      if (options.resourceType) {
        profiles = profiles.filter(p => p.resourceType === options.resourceType);
      }

      return profiles;

    } catch (error) {
      console.error('[ProfileIndexer] Profile search failed:', error);
      return [];
    }
  }

  /**
   * Get all profiles for a package
   */
  async getPackageProfiles(packageId: string): Promise<ValidationProfile[]> {
    return this.searchProfiles({ packageId });
  }

  /**
   * Get profile count for a package
   */
  async getPackageProfileCount(packageId: string): Promise<number> {
    const profiles = await this.getPackageProfiles(packageId);
    return profiles.length;
  }

  // ==========================================================================
  // Profile Removal
  // ==========================================================================

  /**
   * Remove all profiles for a package
   */
  async removePackageProfiles(packageId: string): Promise<number> {
    try {
      const profiles = await this.getPackageProfiles(packageId);
      
      for (const profile of profiles) {
        await storage.deleteValidationProfile(profile.id);
      }

      console.log(`[ProfileIndexer] Removed ${profiles.length} profiles for package ${packageId}`);
      return profiles.length;

    } catch (error) {
      console.error('[ProfileIndexer] Profile removal failed:', error);
      return 0;
    }
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get indexing statistics
   */
  async getIndexStats(): Promise<{
    totalProfiles: number;
    byPackage: Record<string, number>;
    byFhirVersion: Record<string, number>;
    byResourceType: Record<string, number>;
  }> {
    try {
      const profiles = await storage.getValidationProfiles();

      const byPackage: Record<string, number> = {};
      const byFhirVersion: Record<string, number> = {};
      const byResourceType: Record<string, number> = {};

      for (const profile of profiles) {
        // By package
        if (profile.packageId) {
          byPackage[profile.packageId] = (byPackage[profile.packageId] || 0) + 1;
        }

        // By FHIR version
        if (profile.fhirVersion) {
          byFhirVersion[profile.fhirVersion] = (byFhirVersion[profile.fhirVersion] || 0) + 1;
        }

        // By resource type
        if (profile.resourceType) {
          byResourceType[profile.resourceType] = (byResourceType[profile.resourceType] || 0) + 1;
        }
      }

      return {
        totalProfiles: profiles.length,
        byPackage,
        byFhirVersion,
        byResourceType
      };

    } catch (error) {
      console.error('[ProfileIndexer] Failed to get stats:', error);
      return {
        totalProfiles: 0,
        byPackage: {},
        byFhirVersion: {},
        byResourceType: {}
      };
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let profileIndexer: ProfileIndexer | null = null;

export function getProfileIndexer(): ProfileIndexer {
  if (!profileIndexer) {
    profileIndexer = new ProfileIndexer();
  }
  return profileIndexer;
}

export default ProfileIndexer;

