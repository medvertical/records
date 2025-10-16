/**
 * Test Data Manager
 * Task 11.1: Centralized management of FHIR test fixtures
 * 
 * Provides utilities to load and manage test FHIR resources for integration testing.
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface TestResource {
  /** Resource file name */
  fileName: string;
  
  /** Resource type (Patient, Observation, etc.) */
  resourceType: string;
  
  /** Resource ID */
  resourceId: string;
  
  /** Full file path */
  filePath: string;
  
  /** Resource content */
  content: any;
  
  /** Whether this is a valid or invalid resource */
  validity: 'valid' | 'invalid';
  
  /** Category (e.g., 'simple', 'complex', 'missing-required') */
  category?: string;
}

export interface TestDataCatalog {
  valid: Map<string, TestResource>;
  invalid: Map<string, TestResource>;
  byResourceType: Map<string, TestResource[]>;
  all: TestResource[];
}

// ============================================================================
// Test Data Manager Class
// ============================================================================

export class TestDataManager {
  private catalog: TestDataCatalog;
  private fixturesDir: string;

  constructor() {
    this.fixturesDir = path.join(__dirname, 'fhir-resources');
    this.catalog = {
      valid: new Map(),
      invalid: new Map(),
      byResourceType: new Map(),
      all: [],
    };
    
    this.loadAllResources();
  }

  /**
   * Load all test resources from fixtures directory
   */
  private loadAllResources(): void {
    // Load valid resources
    const validDir = path.join(this.fixturesDir, 'valid');
    if (fs.existsSync(validDir)) {
      this.loadResourcesFromDirectory(validDir, 'valid');
    }

    // Load invalid resources
    const invalidDir = path.join(this.fixturesDir, 'invalid');
    if (fs.existsSync(invalidDir)) {
      this.loadResourcesFromDirectory(invalidDir, 'invalid');
    }

    console.log(`[TestDataManager] Loaded ${this.catalog.all.length} test resources`);
    console.log(`  Valid: ${this.catalog.valid.size}`);
    console.log(`  Invalid: ${this.catalog.invalid.size}`);
    console.log(`  Resource Types: ${this.catalog.byResourceType.size}`);
  }

  /**
   * Load resources from a directory
   */
  private loadResourcesFromDirectory(directory: string, validity: 'valid' | 'invalid'): void {
    if (!fs.existsSync(directory)) {
      return;
    }

    const files = fs.readdirSync(directory).filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const filePath = path.join(directory, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        const resource: TestResource = {
          fileName: file,
          resourceType: content.resourceType,
          resourceId: content.id,
          filePath,
          content,
          validity,
          category: this.extractCategory(file),
        };

        // Add to catalog
        this.catalog.all.push(resource);

        if (validity === 'valid') {
          this.catalog.valid.set(resource.resourceId, resource);
        } else {
          this.catalog.invalid.set(resource.resourceId, resource);
        }

        // Index by resource type
        if (!this.catalog.byResourceType.has(resource.resourceType)) {
          this.catalog.byResourceType.set(resource.resourceType, []);
        }
        this.catalog.byResourceType.get(resource.resourceType)!.push(resource);

      } catch (error) {
        console.error(`[TestDataManager] Failed to load ${file}:`, error);
      }
    }
  }

  /**
   * Extract category from file name
   */
  private extractCategory(fileName: string): string {
    // Remove extension
    const nameWithoutExt = fileName.replace('.json', '');
    
    // Extract category after resource type
    // e.g., "patient-simple.json" → "simple"
    // e.g., "observation-vitals.json" → "vitals"
    const parts = nameWithoutExt.split('-');
    if (parts.length > 1) {
      return parts.slice(1).join('-');
    }
    
    return 'default';
  }

  // ========================================================================
  // Query Methods
  // ========================================================================

  /**
   * Get all valid resources
   */
  getValidResources(): TestResource[] {
    return Array.from(this.catalog.valid.values());
  }

  /**
   * Get all invalid resources
   */
  getInvalidResources(): TestResource[] {
    return Array.from(this.catalog.invalid.values());
  }

  /**
   * Get resource by ID
   */
  getResourceById(id: string): TestResource | undefined {
    return this.catalog.valid.get(id) || this.catalog.invalid.get(id);
  }

  /**
   * Get resources by type
   */
  getResourcesByType(resourceType: string): TestResource[] {
    return this.catalog.byResourceType.get(resourceType) || [];
  }

  /**
   * Get valid resources by type
   */
  getValidResourcesByType(resourceType: string): TestResource[] {
    return this.getResourcesByType(resourceType).filter(r => r.validity === 'valid');
  }

  /**
   * Get invalid resources by type
   */
  getInvalidResourcesByType(resourceType: string): TestResource[] {
    return this.getResourcesByType(resourceType).filter(r => r.validity === 'invalid');
  }

  /**
   * Get resources by category
   */
  getResourcesByCategory(category: string): TestResource[] {
    return this.catalog.all.filter(r => r.category === category);
  }

  /**
   * Get all resource types
   */
  getResourceTypes(): string[] {
    return Array.from(this.catalog.byResourceType.keys());
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      total: this.catalog.all.length,
      valid: this.catalog.valid.size,
      invalid: this.catalog.invalid.size,
      resourceTypes: this.catalog.byResourceType.size,
      byResourceType: Array.from(this.catalog.byResourceType.entries()).map(([type, resources]) => ({
        type,
        count: resources.length,
        valid: resources.filter(r => r.validity === 'valid').length,
        invalid: resources.filter(r => r.validity === 'invalid').length,
      })),
    };
  }

  // ========================================================================
  // Helper Methods for Tests
  // ========================================================================

  /**
   * Get a random valid resource
   */
  getRandomValidResource(): TestResource {
    const valid = this.getValidResources();
    return valid[Math.floor(Math.random() * valid.length)];
  }

  /**
   * Get a random invalid resource
   */
  getRandomInvalidResource(): TestResource {
    const invalid = this.getInvalidResources();
    return invalid[Math.floor(Math.random() * invalid.length)];
  }

  /**
   * Get a sample set of resources for testing
   */
  getSampleSet(count: number, includeInvalid: boolean = false): TestResource[] {
    const valid = this.getValidResources();
    const invalid = includeInvalid ? this.getInvalidResources() : [];
    
    const all = [...valid, ...invalid];
    const shuffled = all.sort(() => Math.random() - 0.5);
    
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /**
   * Create a test bundle from resources
   */
  createTestBundle(resources: TestResource[], bundleType: 'collection' | 'transaction' = 'collection'): any {
    return {
      resourceType: 'Bundle',
      id: `test-bundle-${Date.now()}`,
      type: bundleType,
      timestamp: new Date().toISOString(),
      total: resources.length,
      entry: resources.map(r => ({
        fullUrl: `${r.resourceType}/${r.resourceId}`,
        resource: r.content,
      })),
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let testDataManagerInstance: TestDataManager | null = null;

export function getTestDataManager(): TestDataManager {
  if (!testDataManagerInstance) {
    testDataManagerInstance = new TestDataManager();
  }
  return testDataManagerInstance;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Load a specific test resource by ID
 */
export function loadTestResource(id: string): any {
  const manager = getTestDataManager();
  const resource = manager.getResourceById(id);
  
  if (!resource) {
    throw new Error(`Test resource not found: ${id}`);
  }
  
  return resource.content;
}

/**
 * Load all valid resources
 */
export function loadValidResources(): any[] {
  const manager = getTestDataManager();
  return manager.getValidResources().map(r => r.content);
}

/**
 * Load all invalid resources
 */
export function loadInvalidResources(): any[] {
  const manager = getTestDataManager();
  return manager.getInvalidResources().map(r => r.content);
}

/**
 * Create a test patient
 */
export function createTestPatient(overrides: Partial<any> = {}): any {
  return {
    resourceType: 'Patient',
    id: `test-patient-${Date.now()}`,
    name: [
      {
        use: 'official',
        family: 'TestFamily',
        given: ['TestGiven'],
      },
    ],
    gender: 'unknown',
    ...overrides,
  };
}

/**
 * Create a test observation
 */
export function createTestObservation(subjectRef: string, overrides: Partial<any> = {}): any {
  return {
    resourceType: 'Observation',
    id: `test-observation-${Date.now()}`,
    status: 'final',
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '8867-4',
          display: 'Heart rate',
        },
      ],
    },
    subject: {
      reference: subjectRef,
    },
    effectiveDateTime: new Date().toISOString(),
    valueQuantity: {
      value: 72,
      unit: 'beats/minute',
      system: 'http://unitsofmeasure.org',
      code: '/min',
    },
    ...overrides,
  };
}


