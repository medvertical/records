/**
 * Provenance Validator
 * Task 8.6: Validate Provenance resource linkage (verify target references)
 * 
 * Validates Provenance resources including:
 * - Target reference validation
 * - Agent validation
 * - Entity validation
 * - Timestamp consistency
 * - Signature integrity (if present)
 */

import type { ValidationIssue } from '../types/validation-types';
import { ReferenceValidator } from '../engine/reference-validator';

export interface ProvenanceValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  targetCount: number;
  agentCount: number;
  entityCount: number;
  hasSignature: boolean;
  chainDepth?: number;
  chainLength?: number;
}

/**
 * Task 8.7: Provenance chain traversal result
 */
export interface ProvenanceChainNode {
  provenanceId: string;
  provenanceReference: string;
  depth: number;
  targets: string[];
  agents: Array<{
    who?: string;
    onBehalfOf?: string;
  }>;
  entities: Array<{
    role: string;
    what: string;
  }>;
  recorded?: string;
}

export interface ProvenanceChainResult {
  chain: ProvenanceChainNode[];
  totalDepth: number;
  hasCircular: boolean;
  circularReferences: string[];
  errors: string[];
}

export class ProvenanceValidator {
  private referenceValidator: ReferenceValidator;

  constructor() {
    this.referenceValidator = new ReferenceValidator();
  }

  /**
   * Task 8.6: Validate Provenance resource
   */
  async validate(
    resource: any,
    fhirClient?: any,
    fhirVersion?: 'R4' | 'R5' | 'R6'
  ): Promise<ProvenanceValidationResult> {
    const issues: ValidationIssue[] = [];

    // Validate resource type
    if (resource.resourceType !== 'Provenance') {
      issues.push(this.createIssue(
        'error',
        'invalid-resource-type',
        `Expected Provenance resource, got ${resource.resourceType}`,
        '',
        { expectedType: 'Provenance', actualType: resource.resourceType }
      ));
      return {
        isValid: false,
        issues,
        targetCount: 0,
        agentCount: 0,
        entityCount: 0,
        hasSignature: false,
      };
    }

    // Task 8.6: Validate target references (required field)
    const targetIssues = await this.validateTargets(resource, fhirClient, fhirVersion);
    issues.push(...targetIssues);

    // Validate agents (required field)
    const agentIssues = this.validateAgents(resource);
    issues.push(...agentIssues);

    // Validate entities (optional)
    const entityIssues = this.validateEntities(resource);
    issues.push(...entityIssues);

    // Validate recorded timestamp
    const recordedIssues = this.validateRecorded(resource);
    issues.push(...recordedIssues);

    // Task 8.8: Validate timestamp consistency
    const timestampIssues = this.validateTimestampConsistency(resource);
    issues.push(...timestampIssues);

    // Task 8.9: Validate signature if present
    const signatureIssues = this.validateSignature(resource);
    issues.push(...signatureIssues);

    // Check for signature
    const hasSignature = !!(resource.signature && Array.isArray(resource.signature) && resource.signature.length > 0);

    const result: ProvenanceValidationResult = {
      isValid: !issues.some(i => i.severity === 'error'),
      issues,
      targetCount: Array.isArray(resource.target) ? resource.target.length : 0,
      agentCount: Array.isArray(resource.agent) ? resource.agent.length : 0,
      entityCount: Array.isArray(resource.entity) ? resource.entity.length : 0,
      hasSignature,
    };

    return result;
  }

  /**
   * Task 8.6: Validate target references in Provenance resource
   * Target is required and must reference the resource(s) this provenance is about
   */
  private async validateTargets(
    resource: any,
    fhirClient?: any,
    fhirVersion?: 'R4' | 'R5' | 'R6'
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Target is required
    if (!resource.target) {
      issues.push(this.createIssue(
        'error',
        'provenance-missing-target',
        'Provenance resource must have at least one target',
        'target',
        { required: true }
      ));
      return issues;
    }

    // Target must be an array
    if (!Array.isArray(resource.target)) {
      issues.push(this.createIssue(
        'error',
        'provenance-target-not-array',
        'Provenance.target must be an array',
        'target',
        { expectedType: 'array', actualType: typeof resource.target }
      ));
      return issues;
    }

    // Target array must not be empty
    if (resource.target.length === 0) {
      issues.push(this.createIssue(
        'error',
        'provenance-empty-target',
        'Provenance.target must have at least one reference',
        'target',
        { minLength: 1, actualLength: 0 }
      ));
      return issues;
    }

    // Validate each target reference
    for (let i = 0; i < resource.target.length; i++) {
      const target = resource.target[i];

      // Each target must be a Reference object
      if (!target || typeof target !== 'object') {
        issues.push(this.createIssue(
          'error',
          'provenance-invalid-target',
          `Target at index ${i} must be a Reference object`,
          `target[${i}]`,
          { index: i, actualValue: target }
        ));
        continue;
      }

      // Reference must have a reference field
      if (!target.reference) {
        issues.push(this.createIssue(
          'error',
          'provenance-target-missing-reference',
          `Target at index ${i} must have a reference field`,
          `target[${i}].reference`,
          { index: i }
        ));
        continue;
      }

      // Validate reference format using ReferenceValidator
      try {
        const refValidation = await this.referenceValidator.validate(
          { target: [target] },
          'Provenance',
          fhirClient,
          fhirVersion
        );
        
        // Add reference validation issues with path prefix
        refValidation.forEach(issue => {
          issues.push({
            ...issue,
            path: `target[${i}].${issue.path || 'reference'}`,
          });
        });
      } catch (error) {
        issues.push(this.createIssue(
          'warning',
          'provenance-target-validation-error',
          `Failed to validate target at index ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          `target[${i}]`,
          { index: i, error: error instanceof Error ? error.message : 'Unknown error' }
        ));
      }
    }

    return issues;
  }

  /**
   * Validate agents (required field)
   */
  private validateAgents(resource: any): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Agent is required
    if (!resource.agent) {
      issues.push(this.createIssue(
        'error',
        'provenance-missing-agent',
        'Provenance resource must have at least one agent',
        'agent',
        { required: true }
      ));
      return issues;
    }

    // Agent must be an array
    if (!Array.isArray(resource.agent)) {
      issues.push(this.createIssue(
        'error',
        'provenance-agent-not-array',
        'Provenance.agent must be an array',
        'agent',
        { expectedType: 'array', actualType: typeof resource.agent }
      ));
      return issues;
    }

    // Agent array must not be empty
    if (resource.agent.length === 0) {
      issues.push(this.createIssue(
        'error',
        'provenance-empty-agent',
        'Provenance.agent must have at least one agent',
        'agent',
        { minLength: 1, actualLength: 0 }
      ));
      return issues;
    }

    // Validate each agent
    resource.agent.forEach((agent: any, index: number) => {
      if (!agent || typeof agent !== 'object') {
        issues.push(this.createIssue(
          'error',
          'provenance-invalid-agent',
          `Agent at index ${index} must be an object`,
          `agent[${index}]`,
          { index, actualValue: agent }
        ));
        return;
      }

      // Agent must have who or onBehalfOf
      if (!agent.who && !agent.onBehalfOf) {
        issues.push(this.createIssue(
          'error',
          'provenance-agent-missing-who',
          `Agent at index ${index} must have who and/or onBehalfOf`,
          `agent[${index}]`,
          { index, missing: ['who', 'onBehalfOf'] }
        ));
      }
    });

    return issues;
  }

  /**
   * Validate entities (optional field)
   */
  private validateEntities(resource: any): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!resource.entity) {
      return issues; // Optional field
    }

    // Entity must be an array if present
    if (!Array.isArray(resource.entity)) {
      issues.push(this.createIssue(
        'error',
        'provenance-entity-not-array',
        'Provenance.entity must be an array',
        'entity',
        { expectedType: 'array', actualType: typeof resource.entity }
      ));
      return issues;
    }

    // Validate each entity
    resource.entity.forEach((entity: any, index: number) => {
      if (!entity || typeof entity !== 'object') {
        issues.push(this.createIssue(
          'error',
          'provenance-invalid-entity',
          `Entity at index ${index} must be an object`,
          `entity[${index}]`,
          { index, actualValue: entity }
        ));
        return;
      }

      // Entity must have role
      if (!entity.role) {
        issues.push(this.createIssue(
          'error',
          'provenance-entity-missing-role',
          `Entity at index ${index} must have a role`,
          `entity[${index}].role`,
          { index, required: true }
        ));
      }

      // Entity must have what (reference)
      if (!entity.what) {
        issues.push(this.createIssue(
          'error',
          'provenance-entity-missing-what',
          `Entity at index ${index} must have a what reference`,
          `entity[${index}].what`,
          { index, required: true }
        ));
      }
    });

    return issues;
  }

  /**
   * Validate recorded timestamp
   */
  private validateRecorded(resource: any): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Recorded is required
    if (!resource.recorded) {
      issues.push(this.createIssue(
        'error',
        'provenance-missing-recorded',
        'Provenance resource must have a recorded timestamp',
        'recorded',
        { required: true }
      ));
      return issues;
    }

    // Recorded must be a string (instant)
    if (typeof resource.recorded !== 'string') {
      issues.push(this.createIssue(
        'error',
        'provenance-invalid-recorded-type',
        'Provenance.recorded must be a string (instant)',
        'recorded',
        { expectedType: 'string', actualType: typeof resource.recorded }
      ));
    }

    return issues;
  }

  /**
   * Task 8.8: Validate timestamp consistency within Provenance resource
   */
  private validateTimestampConsistency(resource: any): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!resource.recorded || typeof resource.recorded !== 'string') {
      return issues; // Already handled by validateRecorded
    }

    try {
      const recordedDate = new Date(resource.recorded);

      // Validate recorded is not in the future
      const now = new Date();
      if (recordedDate > now) {
        const futureByMs = recordedDate.getTime() - now.getTime();
        const futureBySeconds = Math.floor(futureByMs / 1000);

        issues.push(this.createIssue(
          'warning',
          'provenance-recorded-future',
          `Provenance.recorded is in the future: ${resource.recorded}`,
          'recorded',
          {
            recorded: resource.recorded,
            futureBySeconds,
            isFuture: true,
          }
        ));
      }

      // Task 8.8: Check consistency between recorded and occurredDateTime if present
      if (resource.occurredDateTime && typeof resource.occurredDateTime === 'string') {
        const occurredDate = new Date(resource.occurredDateTime);

        // Recorded should typically be after or equal to occurred
        if (recordedDate < occurredDate) {
          const diffMs = occurredDate.getTime() - recordedDate.getTime();
          const diffSeconds = Math.floor(diffMs / 1000);

          issues.push(this.createIssue(
            'warning',
            'provenance-recorded-before-occurred',
            'Provenance.recorded is before occurredDateTime',
            'recorded',
            {
              recorded: resource.recorded,
              occurredDateTime: resource.occurredDateTime,
              differenceSeconds: diffSeconds,
              message: 'The recorded timestamp should typically be after or equal to when the activity occurred',
            }
          ));
        }

        // Warn if recorded is significantly after occurred (> 1 day)
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (recordedDate.getTime() - occurredDate.getTime() > oneDayMs) {
          const diffDays = Math.floor((recordedDate.getTime() - occurredDate.getTime()) / oneDayMs);

          issues.push(this.createIssue(
            'info',
            'provenance-recorded-delayed',
            `Provenance.recorded is ${diffDays} days after occurredDateTime`,
            'recorded',
            {
              recorded: resource.recorded,
              occurredDateTime: resource.occurredDateTime,
              differenceDays: diffDays,
              message: 'Significant delay between activity occurrence and recording',
            }
          ));
        }
      }

      // Task 8.8: Check signature timestamps if present
      if (resource.signature && Array.isArray(resource.signature)) {
        resource.signature.forEach((sig: any, index: number) => {
          if (sig.when && typeof sig.when === 'string') {
            const signatureDate = new Date(sig.when);

            // Signature should be at or after recorded
            if (signatureDate < recordedDate) {
              const diffMs = recordedDate.getTime() - signatureDate.getTime();
              const diffSeconds = Math.floor(diffMs / 1000);

              issues.push(this.createIssue(
                'warning',
                'provenance-signature-before-recorded',
                `Signature timestamp at index ${index} is before recorded timestamp`,
                `signature[${index}].when`,
                {
                  signatureWhen: sig.when,
                  recorded: resource.recorded,
                  differenceSeconds: diffSeconds,
                  index,
                }
              ));
            }
          }
        });
      }

    } catch (error) {
      // Ignore timestamp parsing errors (already validated in format validation)
      console.error('[ProvenanceValidator] Timestamp consistency check failed:', error);
    }

    return issues;
  }

  /**
   * Task 8.9: Validate signature if present
   */
  private validateSignature(resource: any): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!resource.signature) {
      return issues; // Signature is optional
    }

    // Signature must be an array if present
    if (!Array.isArray(resource.signature)) {
      issues.push(this.createIssue(
        'error',
        'provenance-signature-not-array',
        'Provenance.signature must be an array',
        'signature',
        { expectedType: 'array', actualType: typeof resource.signature }
      ));
      return issues;
    }

    // Validate each signature
    resource.signature.forEach((sig: any, index: number) => {
      if (!sig || typeof sig !== 'object') {
        issues.push(this.createIssue(
          'error',
          'provenance-invalid-signature',
          `Signature at index ${index} must be an object`,
          `signature[${index}]`,
          { index, actualValue: sig }
        ));
        return;
      }

      // Task 8.9: Validate required signature fields

      // type is required (array of Coding)
      if (!sig.type) {
        issues.push(this.createIssue(
          'error',
          'provenance-signature-missing-type',
          `Signature at index ${index} must have a type`,
          `signature[${index}].type`,
          { index, required: true }
        ));
      } else if (!Array.isArray(sig.type)) {
        issues.push(this.createIssue(
          'error',
          'provenance-signature-type-not-array',
          `Signature type at index ${index} must be an array`,
          `signature[${index}].type`,
          { index, expectedType: 'array', actualType: typeof sig.type }
        ));
      } else if (sig.type.length === 0) {
        issues.push(this.createIssue(
          'error',
          'provenance-signature-type-empty',
          `Signature type at index ${index} must not be empty`,
          `signature[${index}].type`,
          { index, minLength: 1, actualLength: 0 }
        ));
      }

      // when is required (instant)
      if (!sig.when) {
        issues.push(this.createIssue(
          'error',
          'provenance-signature-missing-when',
          `Signature at index ${index} must have a when timestamp`,
          `signature[${index}].when`,
          { index, required: true }
        ));
      } else if (typeof sig.when !== 'string') {
        issues.push(this.createIssue(
          'error',
          'provenance-signature-invalid-when-type',
          `Signature when at index ${index} must be a string (instant)`,
          `signature[${index}].when`,
          { index, expectedType: 'string', actualType: typeof sig.when }
        ));
      }

      // who is required (Reference)
      if (!sig.who) {
        issues.push(this.createIssue(
          'error',
          'provenance-signature-missing-who',
          `Signature at index ${index} must have a who reference`,
          `signature[${index}].who`,
          { index, required: true }
        ));
      } else if (typeof sig.who !== 'object' || !sig.who.reference) {
        issues.push(this.createIssue(
          'error',
          'provenance-signature-invalid-who',
          `Signature who at index ${index} must be a Reference with reference field`,
          `signature[${index}].who`,
          { index, actualValue: sig.who }
        ));
      }

      // Task 8.9: Validate signature data format (should be base64 if present)
      if (sig.data) {
        if (typeof sig.data !== 'string') {
          issues.push(this.createIssue(
            'error',
            'provenance-signature-invalid-data-type',
            `Signature data at index ${index} must be a string (base64)`,
            `signature[${index}].data`,
            { index, expectedType: 'string (base64)', actualType: typeof sig.data }
          ));
        } else {
          // Basic base64 format check (should only contain valid base64 characters)
          const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
          if (!base64Pattern.test(sig.data)) {
            issues.push(this.createIssue(
              'warning',
              'provenance-signature-invalid-base64',
              `Signature data at index ${index} does not appear to be valid base64`,
              `signature[${index}].data`,
              {
                index,
                expectedFormat: 'base64',
                actualLength: sig.data.length,
              }
            ));
          }

          // Warn if data is very short (likely incomplete)
          if (sig.data.length < 10) {
            issues.push(this.createIssue(
              'warning',
              'provenance-signature-short-data',
              `Signature data at index ${index} is very short (${sig.data.length} characters)`,
              `signature[${index}].data`,
              {
                index,
                actualLength: sig.data.length,
                message: 'Signature data seems too short; verify it is complete',
              }
            ));
          }
        }
      }

      // Task 8.9: Validate targetFormat if present
      if (sig.targetFormat && typeof sig.targetFormat !== 'string') {
        issues.push(this.createIssue(
          'error',
          'provenance-signature-invalid-targetFormat-type',
          `Signature targetFormat at index ${index} must be a string (MIME type)`,
          `signature[${index}].targetFormat`,
          { index, expectedType: 'string (MIME type)', actualType: typeof sig.targetFormat }
        ));
      }

      // Task 8.9: Validate sigFormat if present (MIME type)
      if (sig.sigFormat && typeof sig.sigFormat !== 'string') {
        issues.push(this.createIssue(
          'error',
          'provenance-signature-invalid-sigFormat-type',
          `Signature sigFormat at index ${index} must be a string (MIME type)`,
          `signature[${index}].sigFormat`,
          { index, expectedType: 'string (MIME type)', actualType: typeof sig.sigFormat }
        ));
      }

      // Task 8.9: Check MIME type format if present
      if (sig.sigFormat && typeof sig.sigFormat === 'string') {
        const mimePattern = /^[a-z]+\/[a-z0-9\-\+\.]+$/i;
        if (!mimePattern.test(sig.sigFormat)) {
          issues.push(this.createIssue(
            'warning',
            'provenance-signature-invalid-mime-type',
            `Signature sigFormat at index ${index} does not appear to be a valid MIME type: ${sig.sigFormat}`,
            `signature[${index}].sigFormat`,
            {
              index,
              actualValue: sig.sigFormat,
              expectedFormat: 'type/subtype (e.g., application/jose)',
            }
          ));
        }
      }
    });

    return issues;
  }

  /**
   * Task 8.8: Validate timestamp consistency across provenance chain
   */
  async validateChainTimestampConsistency(
    chainResult: ProvenanceChainResult
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    if (chainResult.chain.length <= 1) {
      return issues; // No chain to validate
    }

    try {
      // Check chronological order in chain
      for (let i = 0; i < chainResult.chain.length - 1; i++) {
        const current = chainResult.chain[i];
        const next = chainResult.chain[i + 1];

        if (!current.recorded || !next.recorded) {
          continue; // Skip if timestamps missing
        }

        const currentDate = new Date(current.recorded);
        const nextDate = new Date(next.recorded);

        // In a typical chain, later nodes (deeper) should have earlier timestamps
        // (the source Provenance was created before the derived Provenance)
        if (nextDate > currentDate) {
          const diffMs = nextDate.getTime() - currentDate.getTime();
          const diffSeconds = Math.floor(diffMs / 1000);

          issues.push(this.createIssue(
            'info',
            'provenance-chain-reverse-chronology',
            `Provenance chain has reverse chronology: ${next.provenanceReference} recorded after ${current.provenanceReference}`,
            'chain',
            {
              earlierNode: current.provenanceReference,
              laterNode: next.provenanceReference,
              earlierRecorded: current.recorded,
              laterRecorded: next.recorded,
              differenceSeconds: diffSeconds,
              message: 'In typical provenance chains, source Provenances are recorded before derived ones',
            }
          ));
        }
      }

    } catch (error) {
      console.error('[ProvenanceValidator] Chain timestamp consistency check failed:', error);
    }

    return issues;
  }

  /**
   * Task 8.7: Traverse provenance chain following entity references
   * 
   * @param resource - The starting Provenance resource
   * @param resourceFetcher - Function to fetch referenced resources by reference string
   * @param maxDepth - Maximum chain depth to traverse (default: 5)
   * @returns ProvenanceChainResult with complete chain information
   */
  async traverseChain(
    resource: any,
    resourceFetcher?: (reference: string) => Promise<any>,
    maxDepth: number = 5
  ): Promise<ProvenanceChainResult> {
    const result: ProvenanceChainResult = {
      chain: [],
      totalDepth: 0,
      hasCircular: false,
      circularReferences: [],
      errors: [],
    };

    if (!resource || resource.resourceType !== 'Provenance') {
      result.errors.push('Starting resource is not a Provenance resource');
      return result;
    }

    const visited = new Set<string>();
    const queue: Array<{ resource: any; depth: number; reference: string }> = [
      { resource, depth: 0, reference: this.getResourceReference(resource) },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentRef = current.reference;

      // Check for circular references
      if (visited.has(currentRef)) {
        result.hasCircular = true;
        result.circularReferences.push(currentRef);
        continue;
      }

      visited.add(currentRef);

      // Check depth limit
      if (current.depth > maxDepth) {
        result.errors.push(`Max depth ${maxDepth} exceeded at ${currentRef}`);
        continue;
      }

      // Add to chain
      const node = this.createChainNode(current.resource, current.depth, currentRef);
      result.chain.push(node);
      result.totalDepth = Math.max(result.totalDepth, current.depth);

      // Task 8.7: Follow entity chains
      if (current.resource.entity && Array.isArray(current.resource.entity) && resourceFetcher) {
        for (const entity of current.resource.entity) {
          if (!entity.what || !entity.what.reference) {
            continue;
          }

          const entityRef = entity.what.reference;

          // Check if entity references another Provenance resource
          if (entityRef.startsWith('Provenance/') || entityRef.includes('/Provenance/')) {
            try {
              // Fetch the referenced Provenance resource
              const referencedResource = await resourceFetcher(entityRef);
              
              if (referencedResource && referencedResource.resourceType === 'Provenance') {
                queue.push({
                  resource: referencedResource,
                  depth: current.depth + 1,
                  reference: entityRef,
                });
              }
            } catch (error) {
              result.errors.push(
                `Failed to fetch entity reference ${entityRef}: ${error instanceof Error ? error.message : 'Unknown error'}`
              );
            }
          }
        }
      }

      // Task 8.7: Also check agents for references to other Provenance resources
      if (current.resource.agent && Array.isArray(current.resource.agent) && resourceFetcher) {
        for (const agent of current.resource.agent) {
          const agentRefs = [agent.who?.reference, agent.onBehalfOf?.reference].filter(Boolean);

          for (const agentRef of agentRefs) {
            if (agentRef && (agentRef.startsWith('Provenance/') || agentRef.includes('/Provenance/'))) {
              try {
                const referencedResource = await resourceFetcher(agentRef);
                
                if (referencedResource && referencedResource.resourceType === 'Provenance') {
                  queue.push({
                    resource: referencedResource,
                    depth: current.depth + 1,
                    reference: agentRef,
                  });
                }
              } catch (error) {
                result.errors.push(
                  `Failed to fetch agent reference ${agentRef}: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
              }
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Task 8.7: Create a chain node from a Provenance resource
   */
  private createChainNode(resource: any, depth: number, reference: string): ProvenanceChainNode {
    const node: ProvenanceChainNode = {
      provenanceId: resource.id || 'unknown',
      provenanceReference: reference,
      depth,
      targets: [],
      agents: [],
      entities: [],
      recorded: resource.recorded,
    };

    // Extract targets
    if (resource.target && Array.isArray(resource.target)) {
      node.targets = resource.target
        .filter((t: any) => t && t.reference)
        .map((t: any) => t.reference);
    }

    // Extract agents
    if (resource.agent && Array.isArray(resource.agent)) {
      node.agents = resource.agent.map((a: any) => ({
        who: a.who?.reference,
        onBehalfOf: a.onBehalfOf?.reference,
      }));
    }

    // Extract entities
    if (resource.entity && Array.isArray(resource.entity)) {
      node.entities = resource.entity
        .filter((e: any) => e && e.role && e.what && e.what.reference)
        .map((e: any) => ({
          role: e.role,
          what: e.what.reference,
        }));
    }

    return node;
  }

  /**
   * Task 8.7: Get reference string for a resource
   */
  private getResourceReference(resource: any): string {
    if (resource.id) {
      return `Provenance/${resource.id}`;
    }
    // Fallback to generating a reference
    return `Provenance/unknown-${Date.now()}`;
  }

  /**
   * Helper to create validation issues
   */
  private createIssue(
    severity: 'error' | 'warning' | 'info',
    code: string,
    message: string,
    path: string,
    details: any
  ): ValidationIssue {
    return {
      id: `provenance-${code}-${Date.now()}`,
      aspect: 'metadata',
      severity,
      code,
      message,
      path,
      humanReadable: message,
      details,
      validationMethod: 'provenance-validation',
      timestamp: new Date().toISOString(),
      resourceType: 'Provenance',
      schemaVersion: 'R4',
    };
  }
}

/**
 * Singleton instance
 */
let instance: ProvenanceValidator | null = null;

export function getProvenanceValidator(): ProvenanceValidator {
  if (!instance) {
    instance = new ProvenanceValidator();
  }
  return instance;
}

export function resetProvenanceValidator(): void {
  instance = null;
}

