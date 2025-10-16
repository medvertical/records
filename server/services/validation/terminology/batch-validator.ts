/**
 * Terminology Batch Validator
 * 
 * Orchestrates batch validation of multiple codes with intelligent optimizations:
 * - Deduplication of identical codes
 * - Cache checking before validation
 * - Grouping by system for efficient processing
 * - Batch size limits to prevent overload
 * - Progress tracking for large batches
 * 
 * Responsibilities: Batch orchestration ONLY
 * - Does not perform HTTP calls (handled by DirectTerminologyClient)
 * - Does not extract codes (handled by CodeExtractor)
 * - Does not manage cache (handled by TerminologyCache)
 * 
 * File size: ~300 lines (adhering to global.mdc standards)
 */

import type { ValidateCodeParams, ValidationResult } from './direct-terminology-client';
import type { CacheKey } from './terminology-cache';
import type { ExtractedCode } from './code-extractor';

// ============================================================================
// Types
// ============================================================================

export interface BatchValidationRequest {
  /** Codes to validate */
  codes: ExtractedCode[];
  
  /** FHIR version */
  fhirVersion: 'R4' | 'R5' | 'R6';
  
  /** Whether in offline mode */
  isOfflineMode?: boolean;
  
  /** Maximum batch size */
  maxBatchSize?: number;
}

export interface BatchValidationResult {
  /** Validation results mapped by code path */
  results: Map<string, CodeValidationResult>;
  
  /** Total codes validated */
  totalCodes: number;
  
  /** Codes validated (excluding cache hits) */
  validated: number;
  
  /** Cache hits */
  cacheHits: number;
  
  /** Failed validations */
  failures: number;
  
  /** Total time in milliseconds */
  totalTime: number;
  
  /** Statistics per system */
  bySystem: Map<string, SystemStats>;
}

export interface CodeValidationResult {
  /** Original extracted code */
  extractedCode: ExtractedCode;
  
  /** Validation result */
  result: ValidationResult;
  
  /** Whether result came from cache */
  fromCache: boolean;
}

export interface SystemStats {
  /** Code system URL */
  system: string;
  
  /** Total codes for this system */
  totalCodes: number;
  
  /** Valid codes */
  validCodes: number;
  
  /** Invalid codes */
  invalidCodes: number;
  
  /** Average validation time (ms) */
  avgTime: number;
}

export interface BatchProgress {
  /** Total codes in batch */
  total: number;
  
  /** Codes completed */
  completed: number;
  
  /** Codes pending */
  pending: number;
  
  /** Current progress percentage */
  percentage: number;
  
  /** Estimated time remaining (ms) */
  estimatedTimeRemaining: number | null;
}

// ============================================================================
// Batch Validator
// ============================================================================

export class TerminologyBatchValidator {
  private readonly defaultMaxBatchSize: number = 100;
  private readonly defaultMaxConcurrentBatches: number = 4; // Task 10.7: Parallel batch processing
  private pendingValidations: Map<string, Promise<ValidationResult>> = new Map(); // Task 10.7: Request deduplication

  /**
   * Validate multiple codes in an optimized batch
   * 
   * @param request - Batch validation request
   * @param validateFn - Function to validate a single code
   * @param cacheFn - Function to check cache
   * @param saveCacheFn - Function to save to cache
   * @returns Batch validation result
   */
  async validateBatch(
    request: BatchValidationRequest,
    validateFn: (params: ValidateCodeParams, serverUrl: string) => Promise<ValidationResult>,
    cacheFn: (key: CacheKey) => any | null,
    saveCacheFn: (key: CacheKey, result: any, isOfflineMode: boolean) => void,
    serverUrl: string
  ): Promise<BatchValidationResult> {
    const startTime = Date.now();
    const maxBatchSize = request.maxBatchSize || this.defaultMaxBatchSize;
    
    console.log(
      `[BatchValidator] Starting batch validation: ${request.codes.length} codes, ` +
      `max batch size: ${maxBatchSize}`
    );

    // Step 1: Deduplicate codes
    const uniqueCodes = this.deduplicateCodes(request.codes);
    console.log(
      `[BatchValidator] Deduplicated: ${request.codes.length} → ${uniqueCodes.length} unique codes`
    );

    // Step 2: Check cache
    const { cached, toValidate } = this.checkCache(
      uniqueCodes,
      request.fhirVersion,
      cacheFn
    );
    console.log(
      `[BatchValidator] Cache check: ${cached.size} hits, ${toValidate.length} to validate`
    );

    // Step 3: Group codes by system for efficient processing
    const groupedCodes = this.groupBySystem(toValidate);
    console.log(
      `[BatchValidator] Grouped into ${groupedCodes.size} systems`
    );

    // Step 4: Validate in batches
    const validated = await this.validateInBatches(
      toValidate,
      request.fhirVersion,
      maxBatchSize,
      validateFn,
      serverUrl
    );

    // Step 5: Cache new results
    this.cacheResults(validated, request.fhirVersion, request.isOfflineMode || false, saveCacheFn);

    // Step 6: Combine cached and validated results
    const allResults = this.combineResults(cached, validated);

    // Step 7: Build final result
    return this.buildBatchResult(
      allResults,
      request.codes.length,
      cached.size,
      Date.now() - startTime
    );
  }

  /**
   * Get current batch progress (for long-running batches)
   */
  calculateProgress(total: number, completed: number, startTime: number): BatchProgress {
    const pending = total - completed;
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    
    // Estimate time remaining based on current rate
    let estimatedTimeRemaining: number | null = null;
    if (completed > 0) {
      const elapsed = Date.now() - startTime;
      const rate = completed / elapsed; // codes per ms
      estimatedTimeRemaining = pending / rate;
    }

    return {
      total,
      completed,
      pending,
      percentage: Math.round(percentage * 100) / 100,
      estimatedTimeRemaining,
    };
  }

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Deduplicate codes by system+code+valueSet
   */
  private deduplicateCodes(codes: ExtractedCode[]): ExtractedCode[] {
    const seen = new Set<string>();
    const unique: ExtractedCode[] = [];

    for (const code of codes) {
      const key = `${code.system}|${code.code}|${code.valueSet || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(code);
      }
    }

    return unique;
  }

  /**
   * Check cache for codes
   */
  private checkCache(
    codes: ExtractedCode[],
    fhirVersion: 'R4' | 'R5' | 'R6',
    cacheFn: (key: CacheKey) => any | null
  ): { cached: Map<string, CodeValidationResult>; toValidate: ExtractedCode[] } {
    const cached = new Map<string, CodeValidationResult>();
    const toValidate: ExtractedCode[] = [];

    for (const code of codes) {
      const cacheKey: CacheKey = {
        system: code.system,
        code: code.code,
        valueSet: code.valueSet,
        fhirVersion,
      };

      const cachedResult = cacheFn(cacheKey);
      
      if (cachedResult) {
        cached.set(code.path, {
          extractedCode: code,
          result: cachedResult,
          fromCache: true,
        });
      } else {
        toValidate.push(code);
      }
    }

    return { cached, toValidate };
  }

  /**
   * Group codes by system
   */
  private groupBySystem(codes: ExtractedCode[]): Map<string, ExtractedCode[]> {
    const grouped = new Map<string, ExtractedCode[]>();

    for (const code of codes) {
      if (!grouped.has(code.system)) {
        grouped.set(code.system, []);
      }
      grouped.get(code.system)!.push(code);
    }

    return grouped;
  }

  /**
   * Validate codes in batches
   */
  private async validateInBatches(
    codes: ExtractedCode[],
    fhirVersion: 'R4' | 'R5' | 'R6',
    maxBatchSize: number,
    validateFn: (params: ValidateCodeParams, serverUrl: string) => Promise<ValidationResult>,
    serverUrl: string
  ): Promise<Map<string, CodeValidationResult>> {
    const results = new Map<string, CodeValidationResult>();
    
    // Task 10.7: Process multiple batches in parallel for better throughput
    const batches: ExtractedCode[][] = [];
    for (let i = 0; i < codes.length; i += maxBatchSize) {
      batches.push(codes.slice(i, i + maxBatchSize));
    }

    console.log(
      `[BatchValidator] Task 10.7: Processing ${batches.length} batches in parallel ` +
      `(max concurrent: ${this.defaultMaxConcurrentBatches})`
    );

    // Process batches with controlled concurrency
    for (let i = 0; i < batches.length; i += this.defaultMaxConcurrentBatches) {
      const batchSlice = batches.slice(i, i + this.defaultMaxConcurrentBatches);
      
      const batchPromises = batchSlice.map(async (batch, batchIndex) => {
        const actualBatchNum = i + batchIndex + 1;
        console.log(
          `[BatchValidator] Processing batch ${actualBatchNum}/${batches.length}: ` +
          `${batch.length} codes`
        );

        // Validate batch codes in parallel with request deduplication
        const batchResults = await Promise.all(
          batch.map(async (code) => {
          try {
            const params: ValidateCodeParams = {
              system: code.system,
              code: code.code,
              valueSet: code.valueSet,
              display: code.display,
              fhirVersion,
            };

            // Task 10.7: Request deduplication - reuse pending validations
            const dedupKey = `${params.system}|${params.code}|${params.valueSet || ''}|${params.fhirVersion}`;
            
            let resultPromise = this.pendingValidations.get(dedupKey);
            if (!resultPromise) {
              resultPromise = validateFn(params, serverUrl).catch(err => {
                // Ensure promise is removed even on error
                this.pendingValidations.delete(dedupKey);
                throw err; // Re-throw for caller to handle
              });
              this.pendingValidations.set(dedupKey, resultPromise);
              
              // Clean up after successful completion
              resultPromise.then(() => {
                this.pendingValidations.delete(dedupKey);
              }).catch(() => {
                // Already handled above
              });
            }

            const result = await resultPromise;
            
            return {
              path: code.path,
              validationResult: {
                extractedCode: code,
                result,
                fromCache: false,
              },
            };
          } catch (error) {
            // Return error result
            return {
              path: code.path,
              validationResult: {
                extractedCode: code,
                result: {
                  valid: false,
                  message: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
                  code: 'VALIDATION_ERROR',
                  responseTime: 0,
                  serverUrl,
                },
                fromCache: false,
              },
            };
          }
        })
      );

        // Add batch results to map
        for (const { path, validationResult } of batchResults) {
          results.set(path, validationResult);
        }

        return batchResults;
      });

      // Task 10.7: Wait for all parallel batches to complete
      const allBatchResults = await Promise.all(batchPromises);
      
      // Results are already added to the map in each batch promise
      console.log(
        `[BatchValidator] Completed ${batchSlice.length} parallel batches ` +
        `(${allBatchResults.reduce((sum, br) => sum + br.length, 0)} codes validated)`
      );
    }

    return results;
  }

  /**
   * Cache newly validated results
   */
  private cacheResults(
    results: Map<string, CodeValidationResult>,
    fhirVersion: 'R4' | 'R5' | 'R6',
    isOfflineMode: boolean,
    saveCacheFn: (key: CacheKey, result: any, isOfflineMode: boolean) => void
  ): void {
    for (const [, validationResult] of results) {
      const { extractedCode, result } = validationResult;
      
      const cacheKey: CacheKey = {
        system: extractedCode.system,
        code: extractedCode.code,
        valueSet: extractedCode.valueSet,
        fhirVersion,
      };

      saveCacheFn(cacheKey, result, isOfflineMode);
    }
  }

  /**
   * Combine cached and validated results
   */
  private combineResults(
    cached: Map<string, CodeValidationResult>,
    validated: Map<string, CodeValidationResult>
  ): Map<string, CodeValidationResult> {
    const combined = new Map<string, CodeValidationResult>(cached);
    
    for (const [path, result] of validated) {
      combined.set(path, result);
    }

    return combined;
  }

  /**
   * Build final batch validation result
   */
  private buildBatchResult(
    allResults: Map<string, CodeValidationResult>,
    totalCodes: number,
    cacheHits: number,
    totalTime: number
  ): BatchValidationResult {
    const validated = allResults.size - cacheHits;
    let failures = 0;
    const systemStats = new Map<string, SystemStats>();

    // Calculate statistics
    for (const [, validationResult] of allResults) {
      const { extractedCode, result } = validationResult;
      
      if (!result.valid) {
        failures++;
      }

      // Update system stats
      const system = extractedCode.system;
      if (!systemStats.has(system)) {
        systemStats.set(system, {
          system,
          totalCodes: 0,
          validCodes: 0,
          invalidCodes: 0,
          avgTime: 0,
        });
      }

      const stats = systemStats.get(system)!;
      stats.totalCodes++;
      if (result.valid) {
        stats.validCodes++;
      } else {
        stats.invalidCodes++;
      }
      stats.avgTime = (stats.avgTime * (stats.totalCodes - 1) + result.responseTime) / stats.totalCodes;
    }

    return {
      results: allResults,
      totalCodes,
      validated,
      cacheHits,
      failures,
      totalTime,
      bySystem: systemStats,
    };
  }

  // ========================================================================
  // Task 10.7: Performance Monitoring Methods
  // ========================================================================

  /**
   * Get request deduplication statistics
   */
  getDeduplicationStats(): {
    pendingValidations: number;
    estimatedSavedRequests: number;
  } {
    return {
      pendingValidations: this.pendingValidations.size,
      estimatedSavedRequests: this.pendingValidations.size, // Each pending validation may be shared by multiple requests
    };
  }

  /**
   * Clear pending validations (for testing)
   */
  clearPendingValidations(): void {
    this.pendingValidations.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let batchValidatorInstance: TerminologyBatchValidator | null = null;

/**
 * Get or create singleton TerminologyBatchValidator instance
 */
export function getBatchValidator(): TerminologyBatchValidator {
  if (!batchValidatorInstance) {
    batchValidatorInstance = new TerminologyBatchValidator();
  }
  return batchValidatorInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetBatchValidator(): void {
  batchValidatorInstance = null;
}

