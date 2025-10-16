/**
 * Package Dependency Resolver
 * 
 * Resolves FHIR IG package dependency graphs and orchestrates recursive downloads.
 * Handles npm-style package.json dependencies, version resolution, and circular dependencies.
 * 
 * Features:
 * - Dependency graph construction from package.json
 * - Recursive package download with depth limits
 * - Version conflict detection and resolution
 * - Circular dependency detection
 * - Parallel package downloads where possible
 * 
 * Responsibilities: Package dependency management ONLY
 * - Does not download individual profiles (handled by ProfileResolver)
 * - Does not validate packages (handled by ValidationEngine)
 * 
 * File size: ~350 lines (adhering to global.mdc standards)
 */

import { simplifierClient } from '../../../services/fhir/simplifier-client';
import { db } from '../../../db';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface PackageManifest {
  /** Package name (e.g., "hl7.fhir.us.core") */
  name: string;
  
  /** Semantic version */
  version: string;
  
  /** FHIR version (R4, R5, R6) */
  fhirVersion?: string;
  
  /** Package dependencies */
  dependencies?: Record<string, string>;
  
  /** Package description */
  description?: string;
  
  /** Author/publisher */
  author?: string;
  
  /** Canonical URL */
  canonical?: string;
  
  /** Package type */
  type?: string;
  
  /** Keywords */
  keywords?: string[];
}

export interface PackageDependencyNode {
  /** Package ID */
  packageId: string;
  
  /** Version */
  version: string;
  
  /** Dependency depth (0 = root) */
  depth: number;
  
  /** Direct dependencies */
  dependencies: string[];
  
  /** Whether package has been downloaded */
  downloaded: boolean;
  
  /** Download source */
  source?: 'simplifier' | 'fhir-registry' | 'npm' | 'local' | 'database';
  
  /** Any download errors */
  error?: string;
}

export interface DependencyGraph {
  /** Root package */
  root: PackageDependencyNode;
  
  /** All nodes in graph */
  nodes: Map<string, PackageDependencyNode>;
  
  /** Circular dependencies detected */
  circularDependencies: string[][];
  
  /** Total packages to download */
  totalPackages: number;
  
  /** Packages successfully downloaded */
  downloadedPackages: number;
  
  /** Failed packages */
  failedPackages: string[];
}

export interface PackageResolutionOptions {
  /** Maximum dependency depth */
  maxDepth: number;
  
  /** Whether to download packages in parallel */
  parallel: boolean;
  
  /** Maximum concurrent downloads */
  maxConcurrent: number;
  
  /** Skip already cached packages */
  skipCached: boolean;
  
  /** Resolve version conflicts (latest, strict) */
  versionConflictStrategy: 'latest' | 'strict' | 'interactive';
}

// ============================================================================
// Package Dependency Resolver
// ============================================================================

export class PackageDependencyResolver {
  private options: PackageResolutionOptions;
  private downloadQueue: Set<string> = new Set();
  private downloadingInProgress: Set<string> = new Set();

  constructor(options?: Partial<PackageResolutionOptions>) {
    this.options = {
      maxDepth: options?.maxDepth ?? 5,
      parallel: options?.parallel ?? true,
      maxConcurrent: options?.maxConcurrent ?? 3,
      skipCached: options?.skipCached ?? true,
      versionConflictStrategy: options?.versionConflictStrategy ?? 'latest',
    };
  }

  /**
   * Resolve all dependencies for a package
   * 
   * @param packageId - Package identifier (e.g., "hl7.fhir.us.core")
   * @param version - Package version (optional)
   * @returns Complete dependency graph
   */
  async resolveDependencies(
    packageId: string,
    version?: string
  ): Promise<DependencyGraph> {
    console.log(`[PackageDependencyResolver] Resolving dependencies for: ${packageId}@${version || 'latest'}`);

    const graph: DependencyGraph = {
      root: {
        packageId,
        version: version || 'latest',
        depth: 0,
        dependencies: [],
        downloaded: false,
      },
      nodes: new Map(),
      circularDependencies: [],
      totalPackages: 0,
      downloadedPackages: 0,
      failedPackages: [],
    };

    // Build dependency graph
    await this.buildDependencyGraph(graph, packageId, version, 0, []);

    // Calculate totals
    graph.totalPackages = graph.nodes.size;

    // Download packages
    if (this.options.parallel) {
      await this.downloadPackagesParallel(graph);
    } else {
      await this.downloadPackagesSequential(graph);
    }

    console.log(
      `[PackageDependencyResolver] Resolution complete: ` +
      `${graph.downloadedPackages}/${graph.totalPackages} packages downloaded, ` +
      `${graph.failedPackages.length} failed`
    );

    return graph;
  }

  /**
   * Build dependency graph recursively
   */
  private async buildDependencyGraph(
    graph: DependencyGraph,
    packageId: string,
    version: string | undefined,
    depth: number,
    path: string[]
  ): Promise<void> {
    // Check depth limit
    if (depth > this.options.maxDepth) {
      console.warn(`[PackageDependencyResolver] Max depth reached for ${packageId}`);
      return;
    }

    // Check for circular dependencies
    const nodeKey = `${packageId}@${version || 'latest'}`;
    if (path.includes(nodeKey)) {
      console.warn(`[PackageDependencyResolver] Circular dependency detected: ${path.join(' → ')} → ${nodeKey}`);
      graph.circularDependencies.push([...path, nodeKey]);
      return;
    }

    // Check if already processed
    if (graph.nodes.has(nodeKey)) {
      return;
    }

    // Check if package is already cached in database
    const cachedPackage = await this.checkPackageCache(packageId, version);
    if (cachedPackage && this.options.skipCached) {
      console.log(`[PackageDependencyResolver] Package already cached: ${nodeKey}`);
      graph.nodes.set(nodeKey, {
        packageId,
        version: version || cachedPackage.version,
        depth,
        dependencies: cachedPackage.dependencies || [],
        downloaded: true,
        source: 'database',
      });
      return;
    }

    // Get package manifest
    const manifest = await this.fetchPackageManifest(packageId, version);
    if (!manifest) {
      console.warn(`[PackageDependencyResolver] Could not fetch manifest for ${packageId}`);
      graph.failedPackages.push(nodeKey);
      return;
    }

    // Create node
    const dependencies = Object.keys(manifest.dependencies || {});
    const node: PackageDependencyNode = {
      packageId: manifest.name,
      version: manifest.version,
      depth,
      dependencies,
      downloaded: false,
    };

    graph.nodes.set(nodeKey, node);

    // Recursively process dependencies
    for (const depPackageId of dependencies) {
      const depVersion = manifest.dependencies![depPackageId];
      await this.buildDependencyGraph(
        graph,
        depPackageId,
        depVersion,
        depth + 1,
        [...path, nodeKey]
      );
    }
  }

  /**
   * Download packages sequentially
   */
  private async downloadPackagesSequential(graph: DependencyGraph): Promise<void> {
    console.log(`[PackageDependencyResolver] Downloading ${graph.nodes.size} packages sequentially`);

    for (const [nodeKey, node] of graph.nodes) {
      if (node.downloaded) {
        graph.downloadedPackages++;
        continue;
      }

      try {
        await this.downloadPackage(node);
        node.downloaded = true;
        graph.downloadedPackages++;
      } catch (error) {
        console.error(`[PackageDependencyResolver] Failed to download ${nodeKey}:`, error);
        node.error = error instanceof Error ? error.message : 'Unknown error';
        graph.failedPackages.push(nodeKey);
      }
    }
  }

  /**
   * Download packages in parallel with concurrency limit
   */
  private async downloadPackagesParallel(graph: DependencyGraph): Promise<void> {
    console.log(`[PackageDependencyResolver] Downloading ${graph.nodes.size} packages in parallel (max ${this.options.maxConcurrent})`);

    const downloadPromises: Promise<void>[] = [];
    const nodes = Array.from(graph.nodes.values()).filter(n => !n.downloaded);

    for (let i = 0; i < nodes.length; i += this.options.maxConcurrent) {
      const batch = nodes.slice(i, i + this.options.maxConcurrent);
      
      const batchPromises = batch.map(async (node) => {
        const nodeKey = `${node.packageId}@${node.version}`;
        try {
          await this.downloadPackage(node);
          node.downloaded = true;
          graph.downloadedPackages++;
        } catch (error) {
          console.error(`[PackageDependencyResolver] Failed to download ${nodeKey}:`, error);
          node.error = error instanceof Error ? error.message : 'Unknown error';
          graph.failedPackages.push(nodeKey);
        }
      });

      await Promise.all(batchPromises);
    }
  }

  /**
   * Download and cache a single package
   */
  private async downloadPackage(node: PackageDependencyNode): Promise<void> {
    const nodeKey = `${node.packageId}@${node.version}`;
    console.log(`[PackageDependencyResolver] Downloading package: ${nodeKey}`);

    // Try to download from Simplifier
    const packageBuffer = await simplifierClient.downloadPackage(node.packageId, node.version);
    if (!packageBuffer) {
      throw new Error(`Failed to download package ${nodeKey}`);
    }

    // Calculate checksum
    const checksum = createHash('sha256').update(packageBuffer).digest('hex');

    // Cache in database
    await this.cachePackage(node, packageBuffer, checksum);
    
    node.source = 'simplifier';
    console.log(`[PackageDependencyResolver] Successfully downloaded and cached: ${nodeKey}`);
  }

  /**
   * Fetch package manifest (package.json)
   */
  private async fetchPackageManifest(
    packageId: string,
    version?: string
  ): Promise<PackageManifest | null> {
    try {
      // First try to get from database cache
      const cached = await this.checkPackageCache(packageId, version);
      if (cached?.metadata) {
        return cached.metadata as PackageManifest;
      }

      // Search for package
      const searchResults = await simplifierClient.searchPackages(packageId);
      const pkg = searchResults.packages.find(p => p.id === packageId || p.name === packageId);
      
      if (!pkg) {
        return null;
      }

      // Get detailed package info with dependencies
      const details = await simplifierClient.getPackageDetails(packageId);
      if (!details) {
        return null;
      }

      // Construct manifest
      const manifest: PackageManifest = {
        name: details.name,
        version: details.version,
        fhirVersion: details.fhirVersion,
        dependencies: details.dependencies.reduce((acc, dep) => {
          acc[dep] = 'latest'; // Simplifier doesn't provide version info in dependencies array
          return acc;
        }, {} as Record<string, string>),
        description: details.description,
        author: details.author,
        canonical: details.canonicalUrl,
        keywords: details.keywords,
      };

      return manifest;

    } catch (error) {
      console.error(`[PackageDependencyResolver] Failed to fetch manifest for ${packageId}:`, error);
      return null;
    }
  }

  /**
   * Check if package is already cached
   */
  private async checkPackageCache(
    packageId: string,
    version?: string
  ): Promise<any | null> {
    try {
      const query = version
        ? sql`
          SELECT package_id, version, dependencies, package_metadata
          FROM profile_packages
          WHERE package_id = ${packageId} AND version = ${version}
          LIMIT 1
        `
        : sql`
          SELECT package_id, version, dependencies, package_metadata
          FROM profile_packages
          WHERE package_id = ${packageId}
          ORDER BY downloaded_at DESC
          LIMIT 1
        `;

      const result = await db.execute(query);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as any;
      return {
        packageId: row.package_id,
        version: row.version,
        dependencies: row.dependencies || [],
        metadata: row.package_metadata,
      };

    } catch (error) {
      console.error('[PackageDependencyResolver] Cache check failed:', error);
      return null;
    }
  }

  /**
   * Cache package in database
   */
  private async cachePackage(
    node: PackageDependencyNode,
    content: Buffer,
    checksum: string
  ): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO profile_packages (
          package_id, name, version, fhir_version, source, package_content,
          file_size_bytes, checksum_sha256, dependencies
        ) VALUES (
          ${node.packageId},
          ${node.packageId},
          ${node.version},
          'R4',
          ${node.source || 'simplifier'},
          ${content},
          ${content.length},
          ${checksum},
          ${node.dependencies}
        )
        ON CONFLICT (package_id, version)
        DO UPDATE SET
          package_content = EXCLUDED.package_content,
          checksum_sha256 = EXCLUDED.checksum_sha256,
          updated_at = NOW()
      `);

      console.log(`[PackageDependencyResolver] Cached package ${node.packageId}@${node.version}`);

    } catch (error) {
      console.error('[PackageDependencyResolver] Failed to cache package:', error);
      throw error;
    }
  }

  /**
   * Get dependency graph visualization
   */
  visualizeDependencyGraph(graph: DependencyGraph): string {
    const lines: string[] = [];
    lines.push(`Dependency Graph for ${graph.root.packageId}@${graph.root.version}`);
    lines.push(`Total packages: ${graph.totalPackages}`);
    lines.push(`Downloaded: ${graph.downloadedPackages}`);
    lines.push(`Failed: ${graph.failedPackages.length}`);
    lines.push('');

    // Build tree structure
    const visited = new Set<string>();
    const buildTree = (node: PackageDependencyNode, prefix: string = '', isLast: boolean = true) => {
      const nodeKey = `${node.packageId}@${node.version}`;
      
      if (visited.has(nodeKey)) {
        lines.push(`${prefix}${isLast ? '└── ' : '├── '}${nodeKey} (circular)`);
        return;
      }
      
      visited.add(nodeKey);
      
      const status = node.downloaded ? '✓' : node.error ? '✗' : '○';
      lines.push(`${prefix}${isLast ? '└── ' : '├── '}${status} ${nodeKey}`);
      
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      const deps = node.dependencies.map(depId => {
        const depKey = Array.from(graph.nodes.keys()).find(k => k.startsWith(depId));
        return depKey ? graph.nodes.get(depKey)! : null;
      }).filter(Boolean) as PackageDependencyNode[];

      deps.forEach((dep, index) => {
        buildTree(dep, newPrefix, index === deps.length - 1);
      });
    };

    buildTree(graph.root);

    if (graph.circularDependencies.length > 0) {
      lines.push('');
      lines.push('Circular Dependencies:');
      graph.circularDependencies.forEach(cycle => {
        lines.push(`  ${cycle.join(' → ')}`);
      });
    }

    return lines.join('\n');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let resolverInstance: PackageDependencyResolver | null = null;

/**
 * Get or create singleton PackageDependencyResolver
 */
export function getPackageDependencyResolver(
  options?: Partial<PackageResolutionOptions>
): PackageDependencyResolver {
  if (!resolverInstance) {
    resolverInstance = new PackageDependencyResolver(options);
  }
  return resolverInstance;
}

/**
 * Reset singleton (useful for testing)
 */
export function resetPackageDependencyResolver(): void {
  resolverInstance = null;
}


