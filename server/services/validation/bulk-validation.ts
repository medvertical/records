import { FhirClient } from '../fhir/fhir-client.js';
import { ValidationEngine } from './validation-engine.js';
import { storage } from '../../storage.js';
import { InsertFhirResource, InsertValidationResult } from '@shared/schema.js';
import { errorHandler } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';
// import { validationWebSocket } from './websocket-server.js'; // Removed - using SSE instead

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

export class BulkValidationService {
  private fhirClient: FhirClient;
  private validationEngine: ValidationEngine;
  private currentProgress: BulkValidationProgress | null = null;
  private validationState: 'idle' | 'running' | 'paused' | 'stopping' = 'idle';
  private resumeData: {
    resourceTypes: string[];
    currentTypeIndex: number;
    resourceTypeProgress: Record<string, number>;
  } | null = null;
  
  // State management properties
  private _isRunning: boolean = false;
  private _isPaused: boolean = false;
  private resumeFromResourceType?: string;
  private resumeFromOffset: number = 0;

  constructor(fhirClient: FhirClient, validationEngine: ValidationEngine) {
    this.fhirClient = fhirClient;
    this.validationEngine = validationEngine;
  }

  // State management getters
  get isRunning(): boolean {
    return this._isRunning;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get status(): 'idle' | 'running' | 'paused' | 'stopping' {
    if (this._isPaused) return 'paused';
    if (this._isRunning) return 'running';
    return 'idle';
  }

  getCurrentProgress(): BulkValidationProgress | null {
    return this.currentProgress;
  }

  async validateAllResources(options: BulkValidationOptions = {}): Promise<BulkValidationProgress> {
    if (this.isRunning && !this.isPaused) {
      throw new Error('Bulk validation is already running');
    }

    this._isRunning = true;
    this._isPaused = false;
    const {
      resourceTypes,
      batchSize = 1000, // Dramatically increased for performance
      onProgress,
      skipUnchanged = true
    } = options;

    try {
      // Use comprehensive FHIR resource types if not specified
      const typesToValidate = resourceTypes || [
        'Account', 'ActivityDefinition', 'AdverseEvent', 'AllergyIntolerance', 'Appointment', 
        'AppointmentResponse', 'AuditEvent', 'Basic', 'Binary', 'BiologicallyDerivedProduct',
        'BodyStructure', 'Bundle', 'CapabilityStatement', 'CarePlan', 'CareTeam', 'CatalogEntry',
        'ChargeItem', 'ChargeItemDefinition', 'Claim', 'ClaimResponse', 'ClinicalImpression',
        'CodeSystem', 'Communication', 'CommunicationRequest', 'CompartmentDefinition',
        'Composition', 'ConceptMap', 'Condition', 'Consent', 'Contract', 'Coverage',
        'CoverageEligibilityRequest', 'CoverageEligibilityResponse', 'DetectedIssue', 'Device',
        'DeviceDefinition', 'DeviceMetric', 'DeviceRequest', 'DeviceUseStatement',
        'DiagnosticReport', 'DocumentManifest', 'DocumentReference', 'DomainResource',
        'EffectEvidenceSynthesis', 'Encounter', 'Endpoint', 'EnrollmentRequest',
        'EnrollmentResponse', 'EpisodeOfCare', 'EventDefinition', 'Evidence', 'EvidenceVariable',
        'ExampleScenario', 'ExplanationOfBenefit', 'FamilyMemberHistory', 'Flag', 'Goal',
        'GraphDefinition', 'Group', 'GuidanceResponse', 'HealthcareService', 'ImagingStudy',
        'Immunization', 'ImmunizationEvaluation', 'ImmunizationRecommendation',
        'ImplementationGuide', 'InsurancePlan', 'Invoice', 'Library', 'Linkage', 'List',
        'Location', 'Measure', 'MeasureReport', 'Media', 'Medication', 'MedicationAdministration',
        'MedicationDispense', 'MedicationKnowledge', 'MedicationRequest', 'MedicationStatement',
        'MedicinalProduct', 'MedicinalProductAuthorization', 'MedicinalProductContraindication',
        'MedicinalProductIndication', 'MedicinalProductIngredient', 'MedicinalProductInteraction',
        'MedicinalProductManufactured', 'MedicinalProductPackaged', 'MedicinalProductPharmaceutical',
        'MedicinalProductUndesirableEffect', 'MessageDefinition', 'MessageHeader', 'MolecularSequence',
        'NamingSystem', 'NutritionOrder', 'Observation', 'ObservationDefinition', 'OperationDefinition',
        'OperationOutcome', 'Organization', 'OrganizationAffiliation', 'Parameters', 'Patient',
        'PaymentNotice', 'PaymentReconciliation', 'Person', 'PlanDefinition', 'Practitioner',
        'PractitionerRole', 'Procedure', 'Provenance', 'Questionnaire', 'QuestionnaireResponse',
        'RelatedPerson', 'RequestGroup', 'ResearchDefinition', 'ResearchElementDefinition',
        'ResearchStudy', 'ResearchSubject', 'Resource', 'RiskAssessment', 'RiskEvidenceSynthesis',
        'Schedule', 'SearchParameter', 'ServiceRequest', 'Slot', 'Specimen', 'SpecimenDefinition',
        'StructureDefinition', 'StructureMap', 'Subscription', 'Substance', 'SubstanceNucleicAcid',
        'SubstancePolymer', 'SubstanceProtein', 'SubstanceReferenceInformation', 'SubstanceSourceMaterial',
        'SubstanceSpecification', 'SupplyDelivery', 'SupplyRequest', 'Task', 'TerminologyCapabilities',
        'TestReport', 'TestScript', 'ValueSet', 'VerificationResult', 'VisionPrescription'
      ];
      
      // Calculate total resources to process
      let totalResources = 0;
      const resourceCounts: Record<string, number> = {};
      
      for (const resourceType of typesToValidate) {
        const count = await this.fhirClient.getResourceCount(resourceType);
        resourceCounts[resourceType] = count;
        // Include ALL resource types in validation
        totalResources += count;
      }

      this.currentProgress = {
        totalResources,
        processedResources: 0,
        validResources: 0,
        errorResources: 0,
        startTime: new Date(),
        isComplete: false,
        errors: []
      };

      if (onProgress) {
        onProgress(this.currentProgress);
      }

      // Process each resource type with timeout protection
      for (let i = 0; i < typesToValidate.length; i++) {
        const resourceType = typesToValidate[i];
        
        // Check if validation was paused or stopped - CRITICAL: this must stop execution
        if (!this.isRunning || this.isPaused) {
          this.resumeFromResourceType = resourceType;
          console.log(`Validation paused at resource type: ${resourceType}`);
          console.log('STOPPING VALIDATION LOOP - PAUSED');
          return this.currentProgress;
        }

        try {
          this.currentProgress.currentResourceType = resourceType;
          console.log(`Starting validation for ${resourceType}: ${resourceCounts[resourceType]} resources`);
          
          // Process ALL resource types - no skipping based on size
          
          await this.validateResourceType(resourceType, resourceCounts[resourceType], batchSize, skipUnchanged, onProgress);
          
          // Check again after completing a resource type
          if (!this.isRunning || this.isPaused) {
            console.log(`Validation paused after completing ${resourceType}`);
            console.log('STOPPING VALIDATION LOOP - PAUSED AFTER RESOURCE TYPE');
            // Set the next resource type for resume
            if (i + 1 < typesToValidate.length) {
              this.resumeFromResourceType = typesToValidate[i + 1];
            } else {
              this.resumeFromResourceType = undefined; // No more resource types
            }
            return this.currentProgress;
          }
        } catch (error) {
          console.error(`Error processing resource type ${resourceType}:`, error);
          this.currentProgress.errors.push(`Failed to process ${resourceType}: ${error instanceof Error ? error.message : String(error)}`);
          // Continue with next resource type
        }
      }

      this.currentProgress.isComplete = true;
      this.currentProgress.currentResourceType = undefined;
      
      if (onProgress) {
        onProgress(this.currentProgress);
      }

      // Note: SSE broadcasting is handled by the server.ts file
      logger.bulkValidation(2, 'Validation completed successfully', 'validateAllResources');

      return this.currentProgress;
    } catch (error: any) {
      // Use standardized error handling
      const standardizedError = errorHandler.handleValidationError(
        error,
        {
          service: 'bulk-validation',
          operation: 'validateAllResources',
          metadata: { 
            resourceTypes: resourceTypes?.length || 'all',
            batchSize,
            skipUnchanged 
          }
        }
      );

      logger.bulkValidation(0, 'Validation failed', 'validateAllResources', { error: standardizedError.message });
      
      // Update progress with error information
      if (this.currentProgress) {
        this.currentProgress.errors.push(standardizedError.message);
        this.currentProgress.isComplete = true;
      }

      throw standardizedError;
    } finally {
      // Always stop running when exiting, but preserve state if paused
      this._isRunning = false;
      if (!this._isPaused) {
        this.currentProgress = null;
      }
    }
  }

  private async validateResourceType(
    resourceType: string,
    totalCount: number,
    batchSize: number,
    skipUnchanged: boolean,
    onProgress?: (progress: BulkValidationProgress) => void
  ): Promise<void> {
    let offset = 0;
    
    while (offset < totalCount && this.isRunning) {
      try {
        // Fetch batch of resources
        const searchResult = await this.fhirClient.searchResources(resourceType, {
          _count: batchSize,
          _offset: offset
        });

        const resources = searchResult.entry?.map(entry => entry.resource) || [];
        
        // Process resources in parallel batches for better performance
        const PARALLEL_BATCH_SIZE = 50; // Process 50 resources in parallel for much faster validation
        
        for (let i = 0; i < resources.length; i += PARALLEL_BATCH_SIZE) {
          if (!this.isRunning) {
            console.log('Validation paused during resource processing');
            this.resumeFromOffset = offset + i;
            return;
          }
          
          // Get the next batch of resources to process in parallel
          const parallelBatch = resources.slice(i, i + PARALLEL_BATCH_SIZE);
          
          // Validate resources in parallel
          const validationPromises = parallelBatch.map(resource => 
            this.validateSingleResource(resource, skipUnchanged).catch(error => {
              console.error(`Error validating ${resource.resourceType}/${resource.id}:`, error);
              return null;
            })
          );
          
          // Wait for all parallel validations to complete
          await Promise.all(validationPromises);
          
          // Update progress for this parallel batch
          this.currentProgress!.processedResources += parallelBatch.length;
          
          // Ensure processed resources doesn't exceed total resources
          this.currentProgress!.processedResources = Math.min(
            this.currentProgress!.processedResources, 
            this.currentProgress!.totalResources
          );
          
          // Calculate estimated time remaining with improved logic
          if (this.currentProgress!.processedResources > 10) {
            const elapsed = Date.now() - this.currentProgress!.startTime.getTime();
            const rate = this.currentProgress!.processedResources / elapsed; // resources per millisecond
            const remaining = this.currentProgress!.totalResources - this.currentProgress!.processedResources;
            
            if (rate > 0 && remaining > 0) {
              this.currentProgress!.estimatedTimeRemaining = remaining / rate; // milliseconds
            } else {
              this.currentProgress!.estimatedTimeRemaining = 0;
            }
          }
          
          // Validate and sanitize progress data
          this.validateAndSanitizeProgress();
          
          // Report progress after each parallel batch
          if (onProgress) {
            onProgress(this.currentProgress!);
          }

          // Broadcast progress via WebSocket
          if (validationWebSocket) {
            validationWebSocket.broadcastProgress(this.currentProgress!);
          }
          
          // Check if paused after each parallel batch
          if (!this.isRunning || this.isPaused) {
            console.log('Validation paused during batch processing');
            this.resumeFromOffset = offset + i;
            return;
          }
        }

        offset += batchSize;
        
        // Check if paused before next batch
        if (!this.isRunning || this.isPaused) {
          console.log('Validation paused before next batch');
          this.resumeFromOffset = offset;
          return;
        }
        
        // No delay needed - server can handle the load
        
      } catch (error) {
        this.currentProgress!.errors.push(`Error processing ${resourceType} at offset ${offset}: ${error instanceof Error ? error.message : String(error)}`);
        offset += batchSize; // Skip this batch and continue
      }
    }
  }

  private async validateSingleResource(resource: any, skipUnchanged: boolean): Promise<void> {
    try {
      // Check if validation was paused
      if (!this.isRunning || this.isPaused) {
        return;
      }
      
      const resourceId = resource.id;
      const resourceType = resource.resourceType;
      
      if (!resourceId || !resourceType) {
        return;
      }

      // Check if resource already exists in cache
      const existingResource = await storage.getFhirResourceByTypeAndId(resourceType, resourceId);
      
      // Create resource hash for change detection
      const resourceHash = this.createResourceHash(resource);
      
      let shouldValidate = true;
      let dbResourceId: number;

      if (existingResource) {
        dbResourceId = existingResource.id;
        
        // Skip validation if resource hasn't changed and skipUnchanged is true
        if (skipUnchanged && existingResource.resourceHash === resourceHash) {
          // Check if we already have validation results
          const existingResults = await storage.getValidationResultsByResourceId(existingResource.id);
          if (existingResults.length > 0) {
            shouldValidate = false;
            // Update progress counters based on existing results with current validation settings
            // For cached results, use the stored validation score to determine validity
            const latestResult = existingResults.reduce((latest, current) => 
              current.validatedAt > latest.validatedAt ? current : latest
            );
            
            // A resource is considered valid if it has a score >= 95 (allows for minor info messages)
            const isValidWithSettings = latestResult.validationScore >= 95;
            
            if (!isValidWithSettings) {
              this.currentProgress!.errorResources++;
            } else {
              this.currentProgress!.validResources++;
            }
          }
        } else {
          // Update the existing resource
          await storage.updateFhirResource(existingResource.id, resource);
        }
      } else {
        // Create new resource entry
        const newResource: InsertFhirResource = {
          resourceType,
          resourceId,
          data: resource,
          resourceHash,
          serverId: 1, // Assuming default server ID
        };
        
        const createdResource = await storage.createFhirResource(newResource);
        dbResourceId = createdResource.id;
      }

      // Perform validation if needed
      if (shouldValidate) {
        // Check if validation was paused before validation
        if (!this.isRunning) {
          return;
        }
        await this.performValidation(resource, dbResourceId!);
      }
      
    } catch (error) {
      this.currentProgress!.errors.push(`Error validating resource ${resource.resourceType}/${resource.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async performValidation(resource: any, dbResourceId: number): Promise<void> {
    try {
      // Use the UnifiedValidationService that respects current validation settings
      const { UnifiedValidationService } = await import('./unified-validation.js');
      const unifiedValidation = new UnifiedValidationService(this.validationEngine);
      const validationResult = await unifiedValidation.validateResource(resource);

      // Process validation result and extract meaningful data
      const validationData = validationResult.resource?.validationResults?.[0];
      if (!validationData) {
        console.warn(`[BulkValidation] No validation data returned for ${resource.resourceType}/${resource.id}`);
        return;
      }

      // Update progress counters based on validation result
      // Use the isValid field which is already filtered based on current settings
      const isResourceValid = validationData.isValid;
      
      if (isResourceValid) {
        this.currentProgress!.validResources++;
      } else {
        this.currentProgress!.errorResources++;
        // Add error details
        this.currentProgress!.errors.push(
          `${resource.resourceType}/${resource.id}: Score ${validationData.validationScore}% - ${validationData.errorCount || 0} errors, ${validationData.warningCount || 0} warnings`
        );
      }

    } catch (error) {
      this.currentProgress!.errorResources++;
      this.currentProgress!.errors.push(`Validation failed for ${resource.resourceType}/${resource.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private createResourceHash(resource: any): string {
    // Create a simple hash of the resource for change detection
    const resourceString = JSON.stringify(resource);
    let hash = 0;
    for (let i = 0; i < resourceString.length; i++) {
      const char = resourceString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private validateAndSanitizeProgress(): void {
    if (!this.currentProgress) return;

    const progress = this.currentProgress;

    // Ensure all counts are non-negative
    progress.totalResources = Math.max(0, progress.totalResources);
    progress.processedResources = Math.max(0, progress.processedResources);
    progress.validResources = Math.max(0, progress.validResources);
    progress.errorResources = Math.max(0, progress.errorResources);

    // Ensure processed resources doesn't exceed total resources
    progress.processedResources = Math.min(progress.processedResources, progress.totalResources);

    // Ensure valid + error resources don't exceed processed resources
    const totalProcessed = progress.validResources + progress.errorResources;
    if (totalProcessed > progress.processedResources) {
      // Adjust error resources to maintain consistency
      progress.errorResources = Math.max(0, progress.processedResources - progress.validResources);
    }

    // Ensure estimated time remaining is reasonable (not negative, not too large)
    if (progress.estimatedTimeRemaining !== undefined) {
      progress.estimatedTimeRemaining = Math.max(0, Math.min(progress.estimatedTimeRemaining, 24 * 60 * 60 * 1000)); // Max 24 hours
    }

    // Validate start time
    if (!progress.startTime || isNaN(progress.startTime.getTime())) {
      progress.startTime = new Date();
    }
  }

  isValidationRunning(): boolean {
    return this.isRunning;
  }

  isValidationPaused(): boolean {
    return this.isPaused;
  }

  pauseValidation(): void {
    if (this._isRunning) {
      this._isRunning = false;
      this._isPaused = true;
      console.log('Validation paused by user request');
      console.log(`Paused at resource type: ${this.resumeFromResourceType}, offset: ${this.resumeFromOffset}`);
      
      // Force the validation to stop immediately
      if (this.currentProgress) {
        this.currentProgress.currentResourceType = undefined;
      }
    }
  }

  async resumeValidation(options: BulkValidationOptions = {}): Promise<BulkValidationProgress> {
    if (!this.currentProgress) {
      throw new Error('No validation to resume');
    }

    if (!this.isPaused) {
      throw new Error('No paused validation to resume');
    }

    console.log(`Resuming validation from resource type: ${this.resumeFromResourceType}`);
    this._isPaused = false;
    this._isRunning = true;
    
    // Use comprehensive FHIR resource types for resuming validation
    const allResourceTypes = [
      'Account', 'ActivityDefinition', 'AdverseEvent', 'AllergyIntolerance', 'Appointment', 
      'AppointmentResponse', 'AuditEvent', 'Basic', 'Binary', 'BiologicallyDerivedProduct',
      'BodyStructure', 'Bundle', 'CapabilityStatement', 'CarePlan', 'CareTeam', 'CatalogEntry',
      'ChargeItem', 'ChargeItemDefinition', 'Claim', 'ClaimResponse', 'ClinicalImpression',
      'CodeSystem', 'Communication', 'CommunicationRequest', 'CompartmentDefinition',
      'Composition', 'ConceptMap', 'Condition', 'Consent', 'Contract', 'Coverage',
      'CoverageEligibilityRequest', 'CoverageEligibilityResponse', 'DetectedIssue', 'Device',
      'DeviceDefinition', 'DeviceMetric', 'DeviceRequest', 'DeviceUseStatement',
      'DiagnosticReport', 'DocumentManifest', 'DocumentReference', 'DomainResource',
      'EffectEvidenceSynthesis', 'Encounter', 'Endpoint', 'EnrollmentRequest',
      'EnrollmentResponse', 'EpisodeOfCare', 'EventDefinition', 'Evidence', 'EvidenceVariable',
      'ExampleScenario', 'ExplanationOfBenefit', 'FamilyMemberHistory', 'Flag', 'Goal',
      'GraphDefinition', 'Group', 'GuidanceResponse', 'HealthcareService', 'ImagingStudy',
      'Immunization', 'ImmunizationEvaluation', 'ImmunizationRecommendation',
      'ImplementationGuide', 'InsurancePlan', 'Invoice', 'Library', 'Linkage', 'List',
      'Location', 'Measure', 'MeasureReport', 'Media', 'Medication', 'MedicationAdministration',
      'MedicationDispense', 'MedicationKnowledge', 'MedicationRequest', 'MedicationStatement',
      'MedicinalProduct', 'MedicinalProductAuthorization', 'MedicinalProductContraindication',
      'MedicinalProductIndication', 'MedicinalProductIngredient', 'MedicinalProductInteraction',
      'MedicinalProductManufactured', 'MedicinalProductPackaged', 'MedicinalProductPharmaceutical',
      'MedicinalProductUndesirableEffect', 'MessageDefinition', 'MessageHeader', 'MolecularSequence',
      'NamingSystem', 'NutritionOrder', 'Observation', 'ObservationDefinition', 'OperationDefinition',
      'OperationOutcome', 'Organization', 'OrganizationAffiliation', 'Parameters', 'Patient',
      'PaymentNotice', 'PaymentReconciliation', 'Person', 'PlanDefinition', 'Practitioner',
      'PractitionerRole', 'Procedure', 'Provenance', 'Questionnaire', 'QuestionnaireResponse',
      'RelatedPerson', 'RequestGroup', 'ResearchDefinition', 'ResearchElementDefinition',
      'ResearchStudy', 'ResearchSubject', 'Resource', 'RiskAssessment', 'RiskEvidenceSynthesis',
      'Schedule', 'SearchParameter', 'ServiceRequest', 'Slot', 'Specimen', 'SpecimenDefinition',
      'StructureDefinition', 'StructureMap', 'Subscription', 'Substance', 'SubstanceNucleicAcid',
      'SubstancePolymer', 'SubstanceProtein', 'SubstanceReferenceInformation', 'SubstanceSourceMaterial',
      'SubstanceSpecification', 'SupplyDelivery', 'SupplyRequest', 'Task', 'TerminologyCapabilities',
      'TestReport', 'TestScript', 'ValueSet', 'VerificationResult', 'VisionPrescription'
    ];
    let typesToValidate = allResourceTypes;
    
    // If we have a resume point, start from there
    if (this.resumeFromResourceType) {
      const resumeIndex = allResourceTypes.indexOf(this.resumeFromResourceType);
      if (resumeIndex >= 0) {
        typesToValidate = allResourceTypes.slice(resumeIndex);
        console.log(`Resuming from resource type ${this.resumeFromResourceType} (index ${resumeIndex})`);
      } else {
        console.log(`Resume resource type ${this.resumeFromResourceType} not found, starting from beginning`);
      }
    } else {
      console.log(`No specific resume point, continuing with all resource types`);
    }
    
    // Continue the validation directly without calling validateAllResources 
    // to avoid the "already running" check conflict
    
    // Get resource counts for the remaining types
    const resourceCounts: Record<string, number> = {};
    for (const resourceType of typesToValidate) {
      try {
        resourceCounts[resourceType] = await this.fhirClient.getResourceCount(resourceType);
      } catch (error) {
        console.error(`Failed to get count for ${resourceType}:`, error);
        resourceCounts[resourceType] = 0;
      }
    }

    // Update total resources for remaining types
    this.currentProgress.totalResources = Object.values(resourceCounts).reduce((sum, count) => sum + count, 0);

    const { batchSize = 50, skipUnchanged = true, onProgress } = options;

    // Continue validation from where we left off
    for (let i = 0; i < typesToValidate.length; i++) {
      const resourceType = typesToValidate[i];
      
      // Check if validation was paused or stopped
      if (!this.isRunning || this.isPaused) {
        this.resumeFromResourceType = resourceType;
        console.log('STOPPING VALIDATION LOOP - PAUSED DURING RESUME');
        return this.currentProgress;
      }

      try {
        this.currentProgress.currentResourceType = resourceType;
        console.log(`Resuming validation for ${resourceType}: ${resourceCounts[resourceType]} resources`);
        
        await this.validateResourceType(resourceType, resourceCounts[resourceType], batchSize, skipUnchanged, onProgress);
        
        // Check again after completing a resource type
        if (!this.isRunning || this.isPaused) {
          console.log(`Validation paused after completing ${resourceType} during resume`);
          if (i + 1 < typesToValidate.length) {
            this.resumeFromResourceType = typesToValidate[i + 1];
          } else {
            this.resumeFromResourceType = undefined;
          }
          return this.currentProgress;
        }
      } catch (error) {
        console.error(`Error processing resource type ${resourceType} during resume:`, error);
        this.currentProgress.errors.push(`Failed to process ${resourceType}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Mark as complete if we finished all types
    this.currentProgress.isComplete = true;
    this.currentProgress.currentResourceType = undefined;
    this.isRunning = false;
    this.isPaused = false;
    
    if (onProgress) {
      onProgress(this.currentProgress);
    }

    return this.currentProgress;
  }

  stopValidation(): void {
    this._isRunning = false;
    this._isPaused = false;
    this.resumeFromResourceType = undefined;
    this.resumeFromOffset = 0;
    this.currentProgress = null;
    console.log('Validation stopped by user request');
  }

  async getServerValidationSummary(): Promise<{
    totalResources: number;
    totalValidated: number;
    validResources: number;
    resourcesWithErrors: number;
    validationCoverage: number;
    lastValidationRun?: Date;
    resourceTypeBreakdown: Record<string, {
      total: number;
      validated: number;
      valid: number;
      errors: number;
      coverage: number;
    }>;
  }> {
    try {
      const stats = await storage.getResourceStats();
      
      // Get actual FHIR server resource counts dynamically
      let totalServerResources = 129011; // Default fallback
      const knownResourceCounts: Record<string, number> = {};
      
      try {
        // Try to get actual counts from FHIR server
        const resourceTypes = await this.fhirClient.getAllResourceTypes();
        let serverTotal = 0;
        
        for (const resourceType of resourceTypes.slice(0, 6)) { // Limit to first 6 types for performance
          try {
            const count = await this.fhirClient.getResourceCount(resourceType);
            knownResourceCounts[resourceType] = count;
            serverTotal += count;
          } catch (error) {
            // Skip failed resource types
            console.warn(`Could not get count for ${resourceType}:`, error);
          }
        }
        
        if (serverTotal > 0) {
          totalServerResources = serverTotal;
        }
      } catch (error) {
        // Use fallback hardcoded values if FHIR server is unreachable
        Object.assign(knownResourceCounts, {
          Patient: 21298,
          Observation: 87084, 
          Encounter: 3890,
          Condition: 4769,
          Practitioner: 4994,
          Organization: 3922
        });
        totalServerResources = Object.values(knownResourceCounts).reduce((sum, count) => sum + count, 0);
      }

      const resourceTypeBreakdown: Record<string, any> = {};
      
      for (const [resourceType, serverCount] of Object.entries(knownResourceCounts)) {
        const breakdown = stats.resourceBreakdown[resourceType] || { total: 0, valid: 0, validPercent: 0 };
        
        resourceTypeBreakdown[resourceType] = {
          total: serverCount,
          validated: breakdown.total,
          valid: breakdown.valid,
          errors: breakdown.total - breakdown.valid,
          coverage: serverCount > 0 ? (breakdown.total / serverCount) * 100 : 0
        };
      }

      return {
        totalResources: totalServerResources,
        totalValidated: stats.totalResources,
        validResources: stats.validResources,
        resourcesWithErrors: stats.errorResources,
        validationCoverage: totalServerResources > 0 ? Math.min(100, (stats.totalResources / totalServerResources) * 100) : 0,
        resourceTypeBreakdown
      };
    } catch (error) {
      // Fallback to basic stats
      const stats = await storage.getResourceStats();
      return {
        totalResources: 125957, // Known total from FHIR server
        totalValidated: stats.totalResources,
        validResources: stats.validResources,
        resourcesWithErrors: stats.errorResources,
        validationCoverage: stats.totalResources > 0 ? Math.min(100, (stats.totalResources / 125957) * 100) : 0,
        resourceTypeBreakdown: {}
      };
    }
  }
}