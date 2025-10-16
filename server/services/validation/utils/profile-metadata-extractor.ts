/**
 * Profile Metadata Extractor
 * 
 * Extracts and parses metadata from FHIR StructureDefinition resources.
 * Provides structured access to profile constraints, extensions, elements, and bindings.
 * 
 * Features:
 * - Element path and cardinality extraction
 * - Constraint (invariant) parsing
 * - Extension definition extraction
 * - Value set binding detection
 * - Slicing information extraction
 * - Must-support element identification
 * 
 * Responsibilities: Metadata extraction ONLY
 * - Does not validate resources (handled by ValidationEngine)
 * - Does not download profiles (handled by ProfileResolver)
 * 
 * File size: ~350 lines (adhering to global.mdc standards)
 */

// ============================================================================
// Types
// ============================================================================

export interface ProfileMetadata {
  /** Canonical URL */
  url: string;
  
  /** Profile name */
  name: string;
  
  /** Human-readable title */
  title?: string;
  
  /** Version */
  version?: string;
  
  /** Publication status */
  status: 'draft' | 'active' | 'retired' | 'unknown';
  
  /** FHIR version */
  fhirVersion?: string;
  
  /** Resource type this profile constrains */
  type: string;
  
  /** Profile kind */
  kind: 'resource' | 'complex-type' | 'primitive-type' | 'logical';
  
  /** Whether this is an abstract profile */
  abstract: boolean;
  
  /** Base definition this profile extends */
  baseDefinition?: string;
  
  /** Derivation type */
  derivation?: 'specialization' | 'constraint';
  
  /** Profile description */
  description?: string;
  
  /** Publisher */
  publisher?: string;
  
  /** Copyright */
  copyright?: string;
  
  /** Element definitions */
  elements: ElementDefinition[];
  
  /** Constraints (invariants) */
  constraints: ProfileConstraint[];
  
  /** Extensions defined or used */
  extensions: ExtensionInfo[];
  
  /** Value set bindings */
  bindings: ValueSetBinding[];
  
  /** Slicing definitions */
  slicings: SlicingInfo[];
  
  /** Must-support elements */
  mustSupportElements: string[];
  
  /** Modification flags */
  modificationFlags: {
    mustSupport: boolean;
    isModifier: boolean;
    isSummary: boolean;
  };
}

export interface ElementDefinition {
  /** Element path (e.g., "Patient.name") */
  path: string;
  
  /** Element name/id */
  id?: string;
  
  /** Short description */
  short?: string;
  
  /** Definition text */
  definition?: string;
  
  /** Cardinality minimum */
  min: number;
  
  /** Cardinality maximum */
  max: string; // "1", "*", etc.
  
  /** Data types */
  types: string[];
  
  /** Is must-support */
  mustSupport?: boolean;
  
  /** Is modifier element */
  isModifier?: boolean;
  
  /** Is summary element */
  isSummary?: boolean;
  
  /** Fixed value */
  fixed?: any;
  
  /** Pattern value */
  pattern?: any;
  
  /** Binding information */
  binding?: {
    strength: 'required' | 'extensible' | 'preferred' | 'example';
    valueSet?: string;
    description?: string;
  };
}

export interface ProfileConstraint {
  /** Constraint key/id */
  key: string;
  
  /** Severity */
  severity: 'error' | 'warning';
  
  /** Human description */
  human: string;
  
  /** FHIRPath expression */
  expression?: string;
  
  /** XPath expression (legacy) */
  xpath?: string;
  
  /** Element path this applies to */
  source?: string;
}

export interface ExtensionInfo {
  /** Extension URL */
  url: string;
  
  /** Extension name */
  name?: string;
  
  /** Where it's used (element paths) */
  usedIn: string[];
  
  /** Cardinality */
  min?: number;
  max?: string;
  
  /** Value type */
  valueType?: string;
}

export interface ValueSetBinding {
  /** Element path */
  path: string;
  
  /** Binding strength */
  strength: 'required' | 'extensible' | 'preferred' | 'example';
  
  /** ValueSet canonical URL */
  valueSet: string;
  
  /** Description */
  description?: string;
}

export interface SlicingInfo {
  /** Element path being sliced */
  path: string;
  
  /** Slicing discriminator */
  discriminator: Array<{
    type: 'value' | 'exists' | 'pattern' | 'type' | 'profile';
    path: string;
  }>;
  
  /** Slicing rules */
  rules: 'open' | 'closed' | 'openAtEnd';
  
  /** Slice names */
  slices: string[];
  
  /** Is ordered */
  ordered?: boolean;
}

// ============================================================================
// Profile Metadata Extractor
// ============================================================================

export class ProfileMetadataExtractor {
  /**
   * Extract metadata from a StructureDefinition
   * 
   * @param structureDefinition - FHIR StructureDefinition resource
   * @returns Extracted profile metadata
   */
  static extractMetadata(structureDefinition: any): ProfileMetadata {
    if (!structureDefinition || structureDefinition.resourceType !== 'StructureDefinition') {
      throw new Error('Invalid StructureDefinition resource');
    }

    const elements = this.extractElements(structureDefinition);
    const constraints = this.extractConstraints(structureDefinition);
    const extensions = this.extractExtensions(structureDefinition);
    const bindings = this.extractBindings(structureDefinition);
    const slicings = this.extractSlicings(structureDefinition);
    const mustSupportElements = this.extractMustSupportElements(structureDefinition);

    return {
      url: structureDefinition.url,
      name: structureDefinition.name,
      title: structureDefinition.title,
      version: structureDefinition.version,
      status: structureDefinition.status || 'unknown',
      fhirVersion: structureDefinition.fhirVersion,
      type: structureDefinition.type,
      kind: structureDefinition.kind || 'resource',
      abstract: structureDefinition.abstract || false,
      baseDefinition: structureDefinition.baseDefinition,
      derivation: structureDefinition.derivation,
      description: structureDefinition.description,
      publisher: structureDefinition.publisher,
      copyright: structureDefinition.copyright,
      elements,
      constraints,
      extensions,
      bindings,
      slicings,
      mustSupportElements,
      modificationFlags: {
        mustSupport: mustSupportElements.length > 0,
        isModifier: elements.some(e => e.isModifier),
        isSummary: elements.some(e => e.isSummary),
      },
    };
  }

  /**
   * Extract element definitions from snapshot or differential
   */
  private static extractElements(sd: any): ElementDefinition[] {
    const elements: ElementDefinition[] = [];
    
    // Prefer snapshot, fallback to differential
    const elementSource = sd.snapshot?.element || sd.differential?.element || [];

    for (const element of elementSource) {
      const types = (element.type || []).map((t: any) => t.code);
      
      elements.push({
        path: element.path,
        id: element.id,
        short: element.short,
        definition: element.definition,
        min: element.min ?? 0,
        max: element.max || '*',
        types,
        mustSupport: element.mustSupport,
        isModifier: element.isModifier,
        isSummary: element.isSummary,
        fixed: element.fixedString || element.fixedCode || element.fixedInteger || element.fixedBoolean,
        pattern: element.patternString || element.patternCode || element.patternCodeableConcept,
        binding: element.binding ? {
          strength: element.binding.strength,
          valueSet: element.binding.valueSet,
          description: element.binding.description,
        } : undefined,
      });
    }

    return elements;
  }

  /**
   * Extract constraints (invariants) from elements
   */
  private static extractConstraints(sd: any): ProfileConstraint[] {
    const constraints: ProfileConstraint[] = [];
    const elementSource = sd.snapshot?.element || sd.differential?.element || [];

    for (const element of elementSource) {
      if (element.constraint) {
        for (const constraint of element.constraint) {
          constraints.push({
            key: constraint.key,
            severity: constraint.severity,
            human: constraint.human,
            expression: constraint.expression,
            xpath: constraint.xpath,
            source: element.path,
          });
        }
      }
    }

    return constraints;
  }

  /**
   * Extract extension information
   */
  private static extractExtensions(sd: any): ExtensionInfo[] {
    const extensionMap = new Map<string, ExtensionInfo>();
    const elementSource = sd.snapshot?.element || sd.differential?.element || [];

    for (const element of elementSource) {
      // Check if this element is an extension
      if (element.path.endsWith('.extension') || element.type?.some((t: any) => t.code === 'Extension')) {
        const extensionUrl = element.type?.find((t: any) => t.code === 'Extension')?.profile?.[0];
        
        if (extensionUrl) {
          if (!extensionMap.has(extensionUrl)) {
            extensionMap.set(extensionUrl, {
              url: extensionUrl,
              name: element.sliceName,
              usedIn: [],
              min: element.min,
              max: element.max,
            });
          }
          
          extensionMap.get(extensionUrl)!.usedIn.push(element.path);
        }
      }
    }

    return Array.from(extensionMap.values());
  }

  /**
   * Extract value set bindings
   */
  private static extractBindings(sd: any): ValueSetBinding[] {
    const bindings: ValueSetBinding[] = [];
    const elementSource = sd.snapshot?.element || sd.differential?.element || [];

    for (const element of elementSource) {
      if (element.binding?.valueSet) {
        bindings.push({
          path: element.path,
          strength: element.binding.strength,
          valueSet: element.binding.valueSet,
          description: element.binding.description,
        });
      }
    }

    return bindings;
  }

  /**
   * Extract slicing information
   */
  private static extractSlicings(sd: any): SlicingInfo[] {
    const slicings: SlicingInfo[] = [];
    const elementSource = sd.snapshot?.element || sd.differential?.element || [];

    for (const element of elementSource) {
      if (element.slicing) {
        const sliceNames: string[] = [];
        
        // Find all slices for this element
        const basePath = element.path;
        for (const el of elementSource) {
          if (el.path === basePath && el.sliceName) {
            sliceNames.push(el.sliceName);
          }
        }

        slicings.push({
          path: element.path,
          discriminator: element.slicing.discriminator || [],
          rules: element.slicing.rules,
          slices: sliceNames,
          ordered: element.slicing.ordered,
        });
      }
    }

    return slicings;
  }

  /**
   * Extract must-support element paths
   */
  private static extractMustSupportElements(sd: any): string[] {
    const mustSupportPaths: string[] = [];
    const elementSource = sd.snapshot?.element || sd.differential?.element || [];

    for (const element of elementSource) {
      if (element.mustSupport === true) {
        mustSupportPaths.push(element.path);
      }
    }

    return mustSupportPaths;
  }

  /**
   * Get profile complexity score (0-100)
   * Based on number of constraints, must-support elements, extensions, etc.
   */
  static getComplexityScore(metadata: ProfileMetadata): number {
    let score = 0;

    // Base complexity from element count
    score += Math.min(metadata.elements.length / 2, 20);

    // Constraints add complexity
    score += Math.min(metadata.constraints.length * 3, 25);

    // Must-support elements
    score += Math.min(metadata.mustSupportElements.length * 2, 20);

    // Extensions
    score += Math.min(metadata.extensions.length * 4, 15);

    // Slicing adds significant complexity
    score += Math.min(metadata.slicings.length * 5, 15);

    // Bindings
    score += Math.min(metadata.bindings.length, 5);

    return Math.min(Math.round(score), 100);
  }

  /**
   * Check if profile is a base FHIR resource profile
   */
  static isBaseProfile(metadata: ProfileMetadata): boolean {
    return !metadata.baseDefinition || 
           metadata.baseDefinition.startsWith('http://hl7.org/fhir/StructureDefinition/') &&
           metadata.derivation !== 'constraint';
  }

  /**
   * Get required elements (min > 0)
   */
  static getRequiredElements(metadata: ProfileMetadata): ElementDefinition[] {
    return metadata.elements.filter(e => e.min > 0);
  }

  /**
   * Get optional elements (min === 0)
   */
  static getOptionalElements(metadata: ProfileMetadata): ElementDefinition[] {
    return metadata.elements.filter(e => e.min === 0);
  }

  /**
   * Get modifier elements (isModifier === true)
   */
  static getModifierElements(metadata: ProfileMetadata): ElementDefinition[] {
    return metadata.elements.filter(e => e.isModifier === true);
  }

  /**
   * Check if profile has specific constraint
   */
  static hasConstraint(metadata: ProfileMetadata, constraintKey: string): boolean {
    return metadata.constraints.some(c => c.key === constraintKey);
  }

  /**
   * Get all extension URLs used in profile
   */
  static getExtensionUrls(metadata: ProfileMetadata): string[] {
    return metadata.extensions.map(e => e.url);
  }

  /**
   * Get all value set URLs referenced in profile
   */
  static getValueSetUrls(metadata: ProfileMetadata): string[] {
    return metadata.bindings.map(b => b.valueSet);
  }

  /**
   * Generate human-readable summary of profile
   */
  static generateSummary(metadata: ProfileMetadata): string {
    const lines: string[] = [];
    
    lines.push(`Profile: ${metadata.name} (${metadata.url})`);
    lines.push(`Type: ${metadata.type} (${metadata.kind})`);
    if (metadata.version) lines.push(`Version: ${metadata.version}`);
    lines.push(`Status: ${metadata.status}`);
    if (metadata.baseDefinition) lines.push(`Base: ${metadata.baseDefinition}`);
    
    lines.push('');
    lines.push('Statistics:');
    lines.push(`  Elements: ${metadata.elements.length}`);
    lines.push(`  Required Elements: ${this.getRequiredElements(metadata).length}`);
    lines.push(`  Must-Support Elements: ${metadata.mustSupportElements.length}`);
    lines.push(`  Constraints: ${metadata.constraints.length}`);
    lines.push(`  Extensions: ${metadata.extensions.length}`);
    lines.push(`  Value Set Bindings: ${metadata.bindings.length}`);
    lines.push(`  Slicing Definitions: ${metadata.slicings.length}`);
    lines.push(`  Complexity Score: ${this.getComplexityScore(metadata)}/100`);

    if (metadata.mustSupportElements.length > 0) {
      lines.push('');
      lines.push('Must-Support Elements:');
      metadata.mustSupportElements.forEach(path => {
        lines.push(`  - ${path}`);
      });
    }

    if (metadata.constraints.length > 0) {
      lines.push('');
      lines.push('Constraints:');
      metadata.constraints.slice(0, 5).forEach(c => {
        lines.push(`  - ${c.key}: ${c.human}`);
      });
      if (metadata.constraints.length > 5) {
        lines.push(`  ... and ${metadata.constraints.length - 5} more`);
      }
    }

    return lines.join('\n');
  }
}


