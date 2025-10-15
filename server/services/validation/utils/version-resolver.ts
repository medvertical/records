/**
 * Version Resolver
 * 
 * Handles semantic versioning, version comparison, and version range resolution
 * for FHIR profiles and packages. Supports npm-style version specifications.
 * 
 * Features:
 * - Semantic version parsing (major.minor.patch)
 * - Version comparison and ordering
 * - Version range matching (^, ~, >, >=, <, <=, =)
 * - Latest version selection from candidates
 * - Pre-release and build metadata handling
 * 
 * Responsibilities: Version management ONLY
 * - Does not download packages (handled by PackageDependencyResolver)
 * - Does not cache profiles (handled by ProfileResolver)
 * 
 * File size: ~200 lines (adhering to global.mdc standards)
 */

// ============================================================================
// Types
// ============================================================================

export interface SemanticVersion {
  /** Major version number */
  major: number;
  
  /** Minor version number */
  minor: number;
  
  /** Patch version number */
  patch: number;
  
  /** Pre-release identifier (e.g., "alpha.1", "beta.2") */
  prerelease?: string;
  
  /** Build metadata (e.g., "20130313144700") */
  build?: string;
  
  /** Original version string */
  raw: string;
}

export type VersionComparison = -1 | 0 | 1;

export interface VersionResolutionResult {
  /** Selected version */
  version: string;
  
  /** All matching versions */
  matches: string[];
  
  /** Resolution strategy used */
  strategy: 'exact' | 'latest' | 'range' | 'fallback';
  
  /** Whether an exact match was found */
  exactMatch: boolean;
}

// ============================================================================
// Version Resolver
// ============================================================================

export class VersionResolver {
  /**
   * Parse a semantic version string
   * 
   * @param versionString - Version string (e.g., "1.2.3", "2.0.0-beta.1")
   * @returns Parsed semantic version
   */
  static parseVersion(versionString: string): SemanticVersion | null {
    // Remove leading 'v' if present
    const cleaned = versionString.trim().replace(/^v/, '');

    // Regex for semantic versioning: major.minor.patch[-prerelease][+build]
    const regex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    const match = cleaned.match(regex);

    if (!match) {
      return null;
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      prerelease: match[4],
      build: match[5],
      raw: versionString,
    };
  }

  /**
   * Compare two semantic versions
   * 
   * @param v1 - First version
   * @param v2 - Second version
   * @returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
   */
  static compareVersions(v1: SemanticVersion, v2: SemanticVersion): VersionComparison {
    // Compare major version
    if (v1.major !== v2.major) {
      return v1.major > v2.major ? 1 : -1;
    }

    // Compare minor version
    if (v1.minor !== v2.minor) {
      return v1.minor > v2.minor ? 1 : -1;
    }

    // Compare patch version
    if (v1.patch !== v2.patch) {
      return v1.patch > v2.patch ? 1 : -1;
    }

    // Compare pre-release versions
    // Per semver spec: 1.0.0 > 1.0.0-alpha
    if (v1.prerelease && !v2.prerelease) return -1;
    if (!v1.prerelease && v2.prerelease) return 1;
    if (v1.prerelease && v2.prerelease) {
      if (v1.prerelease !== v2.prerelease) {
        return v1.prerelease > v2.prerelease ? 1 : -1;
      }
    }

    // Versions are equal (build metadata is ignored per semver spec)
    return 0;
  }

  /**
   * Sort versions in descending order (newest first)
   * 
   * @param versions - Array of version strings
   * @returns Sorted array of version strings
   */
  static sortVersionsDescending(versions: string[]): string[] {
    const parsed = versions
      .map(v => this.parseVersion(v))
      .filter((v): v is SemanticVersion => v !== null);

    parsed.sort((a, b) => {
      const comparison = this.compareVersions(a, b);
      return -comparison; // Negate for descending order
    });

    return parsed.map(v => v.raw);
  }

  /**
   * Get the latest version from an array of versions
   * 
   * @param versions - Array of version strings
   * @param includePrerelease - Whether to include pre-release versions
   * @returns Latest version string
   */
  static getLatestVersion(versions: string[], includePrerelease: boolean = false): string | null {
    if (versions.length === 0) return null;

    let candidates = versions;

    // Filter out pre-release versions if requested
    if (!includePrerelease) {
      const parsedVersions = versions
        .map(v => this.parseVersion(v))
        .filter((v): v is SemanticVersion => v !== null && !v.prerelease);
      
      if (parsedVersions.length > 0) {
        candidates = parsedVersions.map(v => v.raw);
      }
    }

    const sorted = this.sortVersionsDescending(candidates);
    return sorted[0] || null;
  }

  /**
   * Check if a version satisfies a version range
   * 
   * Supports:
   * - Exact: "1.2.3"
   * - Caret: "^1.2.3" (compatible with 1.x.x)
   * - Tilde: "~1.2.3" (compatible with 1.2.x)
   * - Greater than: ">1.2.3", ">=1.2.3"
   * - Less than: "<1.2.3", "<=1.2.3"
   * - Wildcard: "1.2.*", "1.*"
   * - Latest: "latest", "*"
   * 
   * @param version - Version to check
   * @param range - Version range specification
   * @returns true if version satisfies range
   */
  static satisfiesRange(version: string, range: string): boolean {
    const parsedVersion = this.parseVersion(version);
    if (!parsedVersion) return false;

    // Handle "latest" or "*"
    if (range === 'latest' || range === '*') {
      return true;
    }

    // Handle exact match
    if (!range.match(/[\^~><=*]/)) {
      const parsedRange = this.parseVersion(range);
      return parsedRange ? this.compareVersions(parsedVersion, parsedRange) === 0 : false;
    }

    // Handle caret range: ^1.2.3 means >=1.2.3 <2.0.0
    if (range.startsWith('^')) {
      const baseVersion = this.parseVersion(range.substring(1));
      if (!baseVersion) return false;
      
      return (
        parsedVersion.major === baseVersion.major &&
        this.compareVersions(parsedVersion, baseVersion) >= 0
      );
    }

    // Handle tilde range: ~1.2.3 means >=1.2.3 <1.3.0
    if (range.startsWith('~')) {
      const baseVersion = this.parseVersion(range.substring(1));
      if (!baseVersion) return false;
      
      return (
        parsedVersion.major === baseVersion.major &&
        parsedVersion.minor === baseVersion.minor &&
        this.compareVersions(parsedVersion, baseVersion) >= 0
      );
    }

    // Handle comparison operators
    const operators = ['>=', '<=', '>', '<', '='];
    for (const op of operators) {
      if (range.startsWith(op)) {
        const baseVersion = this.parseVersion(range.substring(op.length).trim());
        if (!baseVersion) return false;
        
        const comparison = this.compareVersions(parsedVersion, baseVersion);
        
        switch (op) {
          case '>=': return comparison >= 0;
          case '<=': return comparison <= 0;
          case '>': return comparison > 0;
          case '<': return comparison < 0;
          case '=': return comparison === 0;
        }
      }
    }

    // Handle wildcard: 1.2.* or 1.*
    if (range.includes('*')) {
      const parts = range.split('.');
      const versionParts = [parsedVersion.major, parsedVersion.minor, parsedVersion.patch];
      
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === '*') {
          return true; // Rest doesn't matter
        }
        if (parseInt(parts[i], 10) !== versionParts[i]) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Resolve the best version from available versions
   * 
   * @param requestedVersion - Version specification (can be exact, range, or undefined)
   * @param availableVersions - Array of available version strings
   * @param preferStable - Prefer stable versions over pre-release
   * @returns Version resolution result
   */
  static resolveVersion(
    requestedVersion: string | undefined,
    availableVersions: string[],
    preferStable: boolean = true
  ): VersionResolutionResult {
    if (availableVersions.length === 0) {
      return {
        version: requestedVersion || 'latest',
        matches: [],
        strategy: 'fallback',
        exactMatch: false,
      };
    }

    // No version specified - return latest
    if (!requestedVersion || requestedVersion === 'latest' || requestedVersion === '*') {
      const latest = this.getLatestVersion(availableVersions, !preferStable);
      return {
        version: latest || availableVersions[0],
        matches: availableVersions,
        strategy: 'latest',
        exactMatch: false,
      };
    }

    // Check for exact match first
    if (availableVersions.includes(requestedVersion)) {
      return {
        version: requestedVersion,
        matches: [requestedVersion],
        strategy: 'exact',
        exactMatch: true,
      };
    }

    // Find all versions that satisfy the range
    const matches = availableVersions.filter(v => this.satisfiesRange(v, requestedVersion));

    if (matches.length === 0) {
      // No matches - fallback to latest
      const latest = this.getLatestVersion(availableVersions, !preferStable);
      return {
        version: latest || availableVersions[0],
        matches: [],
        strategy: 'fallback',
        exactMatch: false,
      };
    }

    // Return the latest matching version
    const bestMatch = this.getLatestVersion(matches, !preferStable);
    return {
      version: bestMatch || matches[0],
      matches,
      strategy: 'range',
      exactMatch: false,
    };
  }

  /**
   * Check if a version string is valid semantic version
   * 
   * @param versionString - Version string to validate
   * @returns true if valid
   */
  static isValidVersion(versionString: string): boolean {
    return this.parseVersion(versionString) !== null;
  }

  /**
   * Normalize a version string (remove leading 'v', standardize format)
   * 
   * @param versionString - Version string to normalize
   * @returns Normalized version string
   */
  static normalizeVersion(versionString: string): string {
    const parsed = this.parseVersion(versionString);
    if (!parsed) return versionString;
    
    let normalized = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
    if (parsed.prerelease) normalized += `-${parsed.prerelease}`;
    if (parsed.build) normalized += `+${parsed.build}`;
    
    return normalized;
  }
}

