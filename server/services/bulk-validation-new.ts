import { FhirClient } from './fhir-client';
import { ValidationEngine } from './validation-engine';
import { UnifiedValidationService } from './unified-validation';
import { storage } from '../storage';
import { InsertFhirResource, InsertValidationResult } from '../../shared/schema';
import { validationWebSocket } from './websocket-server';
import { createHash } from 'crypto';

export interface BulkValidationProgress {
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  currentResourceType?: string;
  startTime: Date;
  estimatedTimeRemaining?: number;
  isComplete: boolean;
  errors: string[];
}

export interface BulkValidationOptions {
  resourceTypes?: string[];
  batchSize?: number;
  onProgress?: (progress: BulkValidationProgress) => void;
  skipUnchanged?: boolean;
}

type ValidationState = 'idle' | 'running' | 'paused' | 'completed' | 'stopped';

interface ValidationCheckpoint {
  resourceTypes: string[];
  currentTypeIndex: number;
  processedInCurrentType: number;
  progress: BulkValidationProgress;
}

export class BulkValidationService {
  private fhirClient: FhirClient;
  private validationEngine: ValidationEngine;
  private unifiedValidationService: UnifiedValidationService;
  private state: ValidationState = 'idle';
  private checkpoint: ValidationCheckpoint | null = null;
  private shouldStop = false;

  constructor(fhirClient: FhirClient, validationEngine: ValidationEngine) {
    this.fhirClient = fhirClient;
    this.validationEngine = validationEngine;
    this.unifiedValidationService = new UnifiedValidationService(fhirClient, validationEngine);
  }

  async startValidation(options: BulkValidationOptions = {}): Promise<BulkValidationProgress> {
    if (this.state === 'running') {
      throw new Error('Validation is already running');
    }

    console.log('Starting validation process...');
    this.state = 'running';
    this.shouldStop = false;
    
    // Initialize new validation
    console.log('Getting resource types...');
    const resourceTypes = options.resourceTypes || await this.fhirClient.getAllResourceTypes();
    console.log('Resource types to validate:', resourceTypes);
    const progress: BulkValidationProgress = {
      totalResources: 0,
      processedResources: 0,
      validResources: 0,
      errorResources: 0,
      startTime: new Date(),
      isComplete: false,
      errors: []
    };

    // Get total resource counts
    console.log('Calculating total resource counts...');
    for (const resourceType of resourceTypes) {
      try {
        const count = await this.fhirClient.getResourceCount(resourceType);
        console.log(`${resourceType}: ${count} resources`);
        progress.totalResources += count;
      } catch (error) {
        console.error(`Failed to get count for ${resourceType}:`, error);
      }
    }
    console.log(`Total resources to validate: ${progress.totalResources}`);

    this.checkpoint = {
      resourceTypes,
      currentTypeIndex: 0,
      processedInCurrentType: 0,
      progress
    };

    console.log('Starting validation run...');
    return this.runValidation(options);
  }

  async resumeValidation(options: BulkValidationOptions = {}): Promise<BulkValidationProgress> {
    if (this.state !== 'paused' || !this.checkpoint) {
      throw new Error('No paused validation to resume');
    }

    this.state = 'running';
    this.shouldStop = false;
    
    return this.runValidation(options);
  }

  pauseValidation(): void {
    if (this.state === 'running') {
      this.state = 'paused';
      console.log('Validation paused');
    }
  }

  stopValidation(): void {
    this.shouldStop = true;
    this.state = 'stopped';
    this.checkpoint = null;
    console.log('Validation stopped');
  }

  private async runValidation(options: BulkValidationOptions = {}): Promise<BulkValidationProgress> {
    if (!this.checkpoint) {
      throw new Error('No checkpoint data available');
    }

    const { resourceTypes, currentTypeIndex, progress } = this.checkpoint;
    const { batchSize = 50, skipUnchanged = true, onProgress } = options;

    console.log(`runValidation: Starting from type index ${currentTypeIndex}, total types: ${resourceTypes.length}`);
    console.log(`runValidation: Current state: ${this.state}, shouldStop: ${this.shouldStop}`);

    try {
      // Continue from where we left off
      for (let i = currentTypeIndex; i < resourceTypes.length; i++) {
        if (this.shouldStop || this.state === 'paused') {
          console.log(`runValidation: Stopping/pausing at index ${i}, state: ${this.state}, shouldStop: ${this.shouldStop}`);
          this.checkpoint.currentTypeIndex = i;
          return progress;
        }

        const resourceType = resourceTypes[i];
        progress.currentResourceType = resourceType;
        
        console.log(`Processing ${resourceType}... (${i + 1}/${resourceTypes.length})`);
        
        await this.processResourceType(resourceType, batchSize, skipUnchanged, progress, onProgress);
        
        console.log(`Finished processing ${resourceType}. Current progress: ${progress.processedResources} processed`);
        
        if (this.shouldStop || this.state === 'paused') {
          console.log(`runValidation: Stopping/pausing after ${resourceType}, state: ${this.state}, shouldStop: ${this.shouldStop}`);
          this.checkpoint.currentTypeIndex = i + 1;
          return progress;
        }
      }

      // Validation completed
      progress.isComplete = true;
      progress.currentResourceType = undefined;
      this.state = 'completed';
      this.checkpoint = null;

      if (onProgress) {
        onProgress(progress);
      }

      return progress;

    } catch (error) {
      this.state = 'stopped';
      this.checkpoint = null;
      throw error;
    }
  }

  private async processResourceType(
    resourceType: string,
    batchSize: number,
    skipUnchanged: boolean,
    progress: BulkValidationProgress,
    onProgress?: (progress: BulkValidationProgress) => void
  ): Promise<void> {
    let offset = this.checkpoint?.processedInCurrentType || 0;
    let hasMore = true;

    while (hasMore && !this.shouldStop && this.state === 'running') {
      try {
        console.log(`Searching ${resourceType} with offset ${offset}, batchSize ${batchSize}`);
        
        const bundle = await this.fhirClient.searchResources(resourceType, { _offset: offset }, batchSize);
        console.log(`Got bundle for ${resourceType}: ${bundle.entry?.length || 0} entries, total: ${bundle.total || 'unknown'}`);
        
        if (!bundle.entry || bundle.entry.length === 0) {
          console.log(`No more entries for ${resourceType}, stopping`);
          hasMore = false;
          break;
        }

        // Process batch
        for (const entry of bundle.entry) {
          if (this.shouldStop || this.state === 'paused') {
            if (this.checkpoint) {
              this.checkpoint.processedInCurrentType = offset;
            }
            return;
          }

          try {
            await this.validateSingleResource(entry.resource, skipUnchanged);
            progress.processedResources++;
            progress.validResources++;
          } catch (error) {
            progress.processedResources++;
            progress.errorResources++;
            progress.errors.push(`${resourceType}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        offset += bundle.entry.length;
        hasMore = bundle.entry.length >= batchSize;

        // Update progress
        if (progress.processedResources > 0) {
          const elapsed = Date.now() - progress.startTime.getTime();
          const rate = progress.processedResources / (elapsed / 1000);
          const remaining = progress.totalResources - progress.processedResources;
          progress.estimatedTimeRemaining = rate > 0 ? (remaining / rate) * 1000 : undefined;
        }

        if (onProgress) {
          onProgress(progress);
        }

      } catch (error) {
        console.error(`Error processing ${resourceType} batch:`, error);
        hasMore = false;
      }
    }

    // Reset processed count for next resource type
    if (this.checkpoint) {
      this.checkpoint.processedInCurrentType = 0;
    }
  }

  private async validateSingleResource(resource: any, skipUnchanged: boolean): Promise<void> {
    try {
      console.log(`[BulkValidation] Validating ${resource.resourceType}/${resource.id} with unified service`);
      await this.unifiedValidationService.validateResource(resource, skipUnchanged, false);
    } catch (error) {
      console.error(`[BulkValidation] Validation failed for ${resource.resourceType}/${resource.id}:`, error);
      throw new Error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private createResourceHash(resource: any): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(resource));
    return hash.digest('hex');
  }

  getCurrentProgress(): BulkValidationProgress | null {
    return this.checkpoint?.progress || null;
  }

  getState(): ValidationState {
    return this.state;
  }

  isValidationRunning(): boolean {
    return this.state === 'running';
  }

  isValidationPaused(): boolean {
    return this.state === 'paused';
  }

  async getServerValidationSummary(): Promise<{
    totalResources: number;
    totalValidated: number;
    validResources: number;
    errorResources: number;
    lastValidationRun?: Date;
  }> {
    const stats = await storage.getResourceStats();
    return {
      totalResources: stats.totalResources,
      totalValidated: stats.validResources + stats.errorResources,
      validResources: stats.validResources,
      errorResources: stats.errorResources,
      lastValidationRun: this.checkpoint?.progress.startTime
    };
  }
}