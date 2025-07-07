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

      // Handle known packages that may not be available through Simplifier.net API
      if (this.isKnownPackage(packageId)) {
        return await this.installKnownPackage(packageId, version);
      }

      // Get package details from Simplifier.net
      const packageDetails = await simplifierClient.getPackageDetails(packageId);
      if (!packageDetails) {
        return {
          success: false,
          message: `Package ${packageId} not found on Simplifier.net or FHIR Package Registry`
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
      const installedPackages: InstalledPackage[] = [];
      
      // Get all validation profiles from database
      const allProfiles = await storage.getValidationProfiles();
      
      // Group profiles by package ID
      const packageGroups = allProfiles.reduce((groups, profile) => {
        if (!profile.packageId || !profile.isActive) return groups;
        
        if (!groups[profile.packageId]) {
          groups[profile.packageId] = [];
        }
        groups[profile.packageId].push(profile);
        return groups;
      }, {} as Record<string, any[]>);

      // Process each package
      for (const [packageId, profiles] of Object.entries(packageGroups)) {
        if (profiles.length === 0) continue;

        // Use the first profile to get package metadata
        const firstProfile = profiles[0];
        
        // Try to get metadata from filesystem first (for downloaded packages)
        let packageMeta: any = null;
        try {
          const packageDir = path.join(PROFILES_DIR, packageId);
          const packageMetaPath = path.join(packageDir, 'package.json');
          packageMeta = JSON.parse(await fs.readFile(packageMetaPath, 'utf-8'));
        } catch (error) {
          // If filesystem metadata doesn't exist, get data from known packages or profile data
          if (this.isKnownPackage(packageId)) {
            const knownData = this.getKnownPackageData(packageId);
            packageMeta = {
              name: knownData?.name || packageId,
              version: firstProfile.packageVersion || '1.0.0',
              installedDate: firstProfile.createdAt || new Date().toISOString(),
              author: 'Local Installation',
              description: knownData?.description || `${packageId} profiles`
            };
          } else {
            // Fallback for unknown packages
            packageMeta = {
              name: packageId,
              version: firstProfile.packageVersion || '1.0.0', 
              installedDate: firstProfile.createdAt || new Date().toISOString(),
              author: 'Unknown',
              description: `${packageId} profiles`
            };
          }
        }

        // Check for updates (only for known packages or those with downloadable versions)
        let updateAvailable = false;
        let latestVersion: string | undefined;
        try {
          if (this.isKnownPackage(packageId)) {
            const knownData = this.getKnownPackageData(packageId);
            latestVersion = knownData?.version;
            updateAvailable = !!(latestVersion && latestVersion !== packageMeta.version);
          } else {
            latestVersion = await simplifierClient.getLatestVersion(packageId);
            updateAvailable = !!(latestVersion && latestVersion !== packageMeta.version);
          }
        } catch (error) {
          // Ignore update check errors
        }

        installedPackages.push({
          id: packageId,
          name: packageMeta.name || packageId,
          version: packageMeta.version,
          installedDate: packageMeta.installedDate,
          profileCount: profiles.length,
          status: profiles.length > 0 ? 'active' : 'inactive',
          updateAvailable: updateAvailable || undefined,
          latestVersion: latestVersion ?? undefined
        });
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
      // For known packages, return predefined version information
      if (this.isKnownPackage(packageId)) {
        return this.getKnownPackageVersions(packageId);
      }

      // Use the Simplifier client to get package versions for external packages
      const versionInfo = await simplifierClient.getPackageVersions(packageId);
      return versionInfo;
    } catch (error: any) {
      console.error(`Failed to get versions for package ${packageId}:`, error);
      throw new Error(`Failed to get package versions: ${error.message}`);
    }
  }

  private getKnownPackageVersions(packageId: string): {
    versions: Record<string, {
      fhirVersion: string;
      date: string;
      description?: string;
    }>;
    distTags: {
      latest: string;
    };
  } {
    const knownVersions: Record<string, any> = {
      'de.basisprofil.r4': {
        versions: {
          '1.5.4': {
            fhirVersion: '4.0.1',
            date: '2024-12-01T00:00:00.000Z',
            description: 'Latest German base profiles for FHIR R4'
          },
          '1.5.3': {
            fhirVersion: '4.0.1',
            date: '2024-10-01T00:00:00.000Z',
            description: 'Updated German base profiles'
          },
          '1.5.0': {
            fhirVersion: '4.0.1',
            date: '2024-06-01T00:00:00.000Z',
            description: 'Major update to German base profiles'
          },
          '1.4.0': {
            fhirVersion: '4.0.1',
            date: '2023-12-01T00:00:00.000Z',
            description: 'Stable German base profiles release'
          }
        },
        distTags: {
          latest: '1.5.4'
        }
      },
      'de.medizininformatikinitiative.kerndatensatz.person': {
        versions: {
          '2024.0.0': {
            fhirVersion: '4.0.1',
            date: '2024-01-01T00:00:00.000Z',
            description: 'MII Core Dataset Person 2024 release'
          },
          '1.0.17': {
            fhirVersion: '4.0.1',
            date: '2023-10-01T00:00:00.000Z',
            description: 'MII Core Dataset Person v1.0.17'
          },
          '1.0.16': {
            fhirVersion: '4.0.1',
            date: '2023-06-01T00:00:00.000Z',
            description: 'MII Core Dataset Person v1.0.16'
          }
        },
        distTags: {
          latest: '2024.0.0'
        }
      },
      'de.medizininformatikinitiative.kerndatensatz.diagnose': {
        versions: {
          '2.0.0-alpha3': {
            fhirVersion: '4.0.1',
            date: '2024-11-01T00:00:00.000Z',
            description: 'MII Core Dataset Diagnosis module (alpha version)'
          },
          '1.0.1': {
            fhirVersion: '4.0.1',
            date: '2024-06-01T00:00:00.000Z',
            description: 'MII Core Dataset Diagnosis module v1.0.1'
          }
        },
        distTags: {
          latest: '2.0.0-alpha3'
        }
      },
      'de.medizininformatikinitiative.kerndatensatz.medikation': {
        versions: {
          '2.0.0': {
            fhirVersion: '4.0.1',
            date: '2024-10-01T00:00:00.000Z',
            description: 'MII Core Dataset Medication module v2.0.0'
          },
          '0.9.0': {
            fhirVersion: '4.0.1',
            date: '2024-03-01T00:00:00.000Z',
            description: 'MII Core Dataset Medication module v0.9.0'
          }
        },
        distTags: {
          latest: '2.0.0'
        }
      },
      'de.medizininformatikinitiative.kerndatensatz.prozedur': {
        versions: {
          '1.0.1': {
            fhirVersion: '4.0.1',
            date: '2024-08-01T00:00:00.000Z',
            description: 'MII Core Dataset Procedure module v1.0.1'
          }
        },
        distTags: {
          latest: '1.0.1'
        }
      },
      'de.medizininformatikinitiative.kerndatensatz.fall': {
        versions: {
          '1.0.1': {
            fhirVersion: '4.0.1',
            date: '2024-07-01T00:00:00.000Z',
            description: 'MII Core Dataset Case/Fall module v1.0.1'
          }
        },
        distTags: {
          latest: '1.0.1'
        }
      },
      'hl7.fhir.us.core': {
        versions: {
          '6.1.0': {
            fhirVersion: '4.0.1',
            date: '2023-01-01T00:00:00.000Z',
            description: 'US Core Implementation Guide v6.1.0'
          },
          '5.0.1': {
            fhirVersion: '4.0.1',
            date: '2022-01-01T00:00:00.000Z',
            description: 'US Core Implementation Guide v5.0.1'
          }
        },
        distTags: {
          latest: '6.1.0'
        }
      },
      'hl7.fhir.uv.ips': {
        versions: {
          '1.1.0': {
            fhirVersion: '4.0.1',
            date: '2023-01-01T00:00:00.000Z',
            description: 'International Patient Summary v1.1.0'
          },
          '1.0.0': {
            fhirVersion: '4.0.1',
            date: '2022-01-01T00:00:00.000Z',
            description: 'International Patient Summary v1.0.0'
          }
        },
        distTags: {
          latest: '1.1.0'
        }
      }
    };

    return knownVersions[packageId] || {
      versions: { '1.0.0': { fhirVersion: '4.0.1', date: new Date().toISOString() } },
      distTags: { latest: '1.0.0' }
    };
  }

  private isKnownPackage(packageId: string): boolean {
    // Known packages are disabled - all packages must be found through external sources
    return false;
  }

  private async installKnownPackage(packageId: string, version?: string): Promise<ProfileInstallResult> {
    // Known packages are disabled - all packages must be found through external sources
    console.log(`[ProfileManager] Known packages disabled - package ${packageId} must be found externally`);
    
    return {
      success: false,
      message: `Package ${packageId} not found in external repositories`,
      errors: [`Package must be found through external search (Simplifier.net, FHIR Package Registry)`]
    };
  }

  private getKnownPackageData(packageId: string): any {
    const knownPackages: Record<string, any> = {
      'de.basisprofil.r4': {
        name: 'Deutsche Basisprofile für FHIR R4',
        version: '1.5.4',
        profiles: [
          {
            name: 'Patient-de-basis',
            title: 'Patient - Deutsche Basisprofile',
            description: 'German base profile for Patient resource',
            url: 'https://fhir.kbv.de/StructureDefinition/KBV_PR_Base_Patient',
            resourceType: 'Patient',
            config: {
              kind: 'resource',
              abstract: false,
              baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Patient'
            }
          },
          {
            name: 'Observation-de-basis',
            title: 'Observation - Deutsche Basisprofile',
            description: 'German base profile for Observation resource',
            url: 'https://fhir.kbv.de/StructureDefinition/KBV_PR_Base_Observation',
            resourceType: 'Observation',
            config: {
              kind: 'resource',
              abstract: false,
              baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Observation'
            }
          },
          {
            name: 'Practitioner-de-basis',
            title: 'Practitioner - Deutsche Basisprofile',
            description: 'German base profile for Practitioner resource',
            url: 'https://fhir.kbv.de/StructureDefinition/KBV_PR_Base_Practitioner',
            resourceType: 'Practitioner',
            config: {
              kind: 'resource',
              abstract: false,
              baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Practitioner'
            }
          }
        ]
      },
      'de.medizininformatikinitiative.kerndatensatz.person': {
        name: 'MII Kerndatensatz - Person',
        version: '2024.0.0',
        profiles: [
          {
            name: 'mii-pr-person-patient',
            title: 'MII PR Person Patient',
            description: 'Medical Informatics Initiative profile for Patient as Person',
            url: 'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient',
            resourceType: 'Patient',
            config: {
              kind: 'resource',
              abstract: false,
              baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Patient'
            }
          },
          {
            name: 'mii-pr-person-practitioner',
            title: 'MII PR Person Practitioner',
            description: 'Medical Informatics Initiative profile for Practitioner as Person',
            url: 'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Practitioner',
            resourceType: 'Practitioner',
            config: {
              kind: 'resource',
              abstract: false,
              baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Practitioner'
            }
          },
          {
            name: 'mii-pr-person-researchsubject',
            title: 'MII PR Person ResearchSubject',
            description: 'Medical Informatics Initiative profile for ResearchSubject as Person',
            url: 'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/ResearchSubject',
            resourceType: 'ResearchSubject',
            config: {
              kind: 'resource',
              abstract: false,
              baseDefinition: 'http://hl7.org/fhir/StructureDefinition/ResearchSubject'
            }
          }
        ]
      },
      'de.medizininformatikinitiative.kerndatensatz.diagnose': {
        name: 'MII Kerndatensatz - Diagnose',
        version: '2.0.0-alpha3',
        profiles: [
          {
            name: 'mii-pr-diagnose-condition',
            title: 'MII PR Diagnose Condition',
            description: 'Medical Informatics Initiative profile for diagnosis conditions',
            url: 'https://www.medizininformatik-initiative.de/fhir/core/modul-diagnose/StructureDefinition/Condition',
            resourceType: 'Condition',
            config: {
              kind: 'resource',
              abstract: false,
              baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Condition'
            }
          }
        ]
      },
      'de.medizininformatikinitiative.kerndatensatz.medikation': {
        name: 'MII Kerndatensatz - Medikation',
        version: '2.0.0',
        profiles: [
          {
            name: 'mii-pr-medikation-medication',
            title: 'MII PR Medikation Medication',
            description: 'Medical Informatics Initiative profile for medication',
            url: 'https://www.medizininformatik-initiative.de/fhir/core/modul-medikation/StructureDefinition/Medication',
            resourceType: 'Medication',
            config: {
              kind: 'resource',
              abstract: false,
              baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Medication'
            }
          },
          {
            name: 'mii-pr-medikation-medicationstatement',
            title: 'MII PR Medikation MedicationStatement',
            description: 'Medical Informatics Initiative profile for medication statements',
            url: 'https://www.medizininformatik-initiative.de/fhir/core/modul-medikation/StructureDefinition/MedicationStatement',
            resourceType: 'MedicationStatement',
            config: {
              kind: 'resource',
              abstract: false,
              baseDefinition: 'http://hl7.org/fhir/StructureDefinition/MedicationStatement'
            }
          }
        ]
      },
      'de.medizininformatikinitiative.kerndatensatz.prozedur': {
        name: 'MII Kerndatensatz - Prozedur',
        version: '1.0.1',
        profiles: [
          {
            name: 'mii-pr-prozedur-procedure',
            title: 'MII PR Prozedur Procedure',
            description: 'Medical Informatics Initiative profile for procedures',
            url: 'https://www.medizininformatik-initiative.de/fhir/core/modul-prozedur/StructureDefinition/Procedure',
            resourceType: 'Procedure',
            config: {
              kind: 'resource',
              abstract: false,
              baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Procedure'
            }
          }
        ]
      },
      'de.medizininformatikinitiative.kerndatensatz.fall': {
        name: 'MII Kerndatensatz - Fall',
        version: '1.0.1',
        profiles: [
          {
            name: 'mii-pr-fall-encounter',
            title: 'MII PR Fall Encounter',
            description: 'Medical Informatics Initiative profile for case/encounter data',
            url: 'https://www.medizininformatik-initiative.de/fhir/core/modul-fall/StructureDefinition/Encounter',
            resourceType: 'Encounter',
            config: {
              kind: 'resource',
              abstract: false,
              baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Encounter'
            }
          }
        ]
      },
      'hl7.fhir.us.core': {
        name: 'US Core Implementation Guide',
        version: '6.1.0',
        profiles: [
          {
            name: 'us-core-patient',
            title: 'US Core Patient Profile',
            description: 'US Core Patient Profile',
            url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',
            resourceType: 'Patient',
            config: {
              kind: 'resource',
              abstract: false,
              baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Patient'
            }
          },
          {
            name: 'us-core-observation-lab',
            title: 'US Core Laboratory Result Observation Profile',
            description: 'US Core Laboratory Result Observation Profile',
            url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab',
            resourceType: 'Observation',
            config: {
              kind: 'resource',
              abstract: false,
              baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Observation'
            }
          }
        ]
      },
      'hl7.fhir.uv.ips': {
        name: 'International Patient Summary',
        version: '1.1.0',
        profiles: [
          {
            name: 'ips-patient',
            title: 'IPS Patient Profile',
            description: 'International Patient Summary Patient Profile',
            url: 'http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips',
            resourceType: 'Patient',
            config: {
              kind: 'resource',
              abstract: false,
              baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Patient'
            }
          }
        ]
      }
    };

    return knownPackages[packageId];
  }
}

export const profileManager = new ProfileManager();