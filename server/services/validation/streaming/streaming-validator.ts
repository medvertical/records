/**
 * Streaming Validation Service
 * Task 10.11: Add validation result streaming for large batches
 * 
 * Enables progressive result delivery for large batch validations.
 * Results are emitted as they complete instead of waiting for entire batch.
 */

import { EventEmitter } from 'events';
import { getValidationEngine } from '../core/validation-engine';
import type { ValidationRequest, ValidationResult } from '../types/validation-types';
import type { ValidationSettings } from '@shared/validation-settings';

// ============================================================================
// Types
// ============================================================================

export interface StreamingValidationRequest {
  /** Resources to validate */
  resources: ValidationRequest[];
  
  /** Validation settings */
  settings?: ValidationSettings;
  
  /** Maximum concurrent validations */
  maxConcurrent?: number;
  
  /** Request ID for tracking */
  requestId?: string;
}

export interface StreamingProgress {
  requestId: string;
  totalResources: number;
  processedResources: number;
  validResources: number;
  invalidResources: number;
  errorResources: number;
  percentage: number;
  estimatedTimeRemaining?: number;
  startTime: Date;
  lastUpdate: Date;
}

export interface StreamingResult {
  requestId: string;
  resource: ValidationRequest;
  result: ValidationResult;
  index: number;
  timestamp: Date;
}

export interface StreamingComplete {
  requestId: string;
  totalResources: number;
  validResources: number;
  invalidResources: number;
  errorResources: number;
  totalTime: number;
  averageTime: number;
  startTime: Date;
  endTime: Date;
}

// ============================================================================
// Streaming Validator Class
// ============================================================================

export class StreamingValidator extends EventEmitter {
  private engine = getValidationEngine();
  private activeStreams = new Map<string, StreamingProgress>();
  private defaultMaxConcurrent = 10;

  /**
   * Validate batch with streaming results
   * 
   * Emits events:
   * - 'result': Individual validation result
   * - 'progress': Progress update
   * - 'complete': All validations complete
   * - 'error': Error during validation
   */
  async validateBatchStreaming(
    request: StreamingValidationRequest
  ): Promise<void> {
    const requestId = request.requestId || `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();
    const maxConcurrent = request.maxConcurrent || this.defaultMaxConcurrent;

    console.log(`[StreamingValidator] Starting streaming validation: ${request.resources.length} resources (requestId: ${requestId})`);

    // Initialize progress tracking
    const progress: StreamingProgress = {
      requestId,
      totalResources: request.resources.length,
      processedResources: 0,
      validResources: 0,
      invalidResources: 0,
      errorResources: 0,
      percentage: 0,
      startTime,
      lastUpdate: startTime,
    };

    this.activeStreams.set(requestId, progress);

    // Emit initial progress
    this.emit('started', {
      requestId,
      totalResources: request.resources.length,
      startTime,
    });

    try {
      // Process in chunks with controlled concurrency
      const chunks: ValidationRequest[][] = [];
      for (let i = 0; i < request.resources.length; i += maxConcurrent) {
        chunks.push(request.resources.slice(i, i + maxConcurrent));
      }

      let index = 0;

      for (const chunk of chunks) {
        // Process chunk in parallel
        const chunkPromises = chunk.map(async (resource, chunkIndex) => {
          const resourceIndex = index + chunkIndex;

          try {
            const validationStart = Date.now();
            const result = await this.engine.validateResource({
              ...resource,
              settings: request.settings,
            });

            // Update progress
            progress.processedResources++;
            if (result.isValid) {
              progress.validResources++;
            } else {
              progress.invalidResources++;
            }
            progress.percentage = (progress.processedResources / progress.totalResources) * 100;
            progress.lastUpdate = new Date();

            // Calculate estimated time remaining
            const elapsedMs = progress.lastUpdate.getTime() - startTime.getTime();
            const avgTimePerResource = elapsedMs / progress.processedResources;
            const remainingResources = progress.totalResources - progress.processedResources;
            progress.estimatedTimeRemaining = avgTimePerResource * remainingResources;

            // Emit result immediately
            const streamingResult: StreamingResult = {
              requestId,
              resource,
              result,
              index: resourceIndex,
              timestamp: new Date(),
            };

            this.emit('result', streamingResult);

            // Emit progress update
            this.emit('progress', { ...progress });

            console.log(
              `[StreamingValidator] Result ${progress.processedResources}/${progress.totalResources} ` +
              `(${progress.percentage.toFixed(1)}%, ${Date.now() - validationStart}ms)`
            );

            return result;

          } catch (error) {
            // Handle error
            progress.processedResources++;
            progress.errorResources++;
            progress.percentage = (progress.processedResources / progress.totalResources) * 100;
            progress.lastUpdate = new Date();

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Emit error
            this.emit('error', {
              requestId,
              resource,
              error: errorMessage,
              index: resourceIndex,
              timestamp: new Date(),
            });

            // Emit progress update
            this.emit('progress', { ...progress });

            console.error(
              `[StreamingValidator] Error ${progress.processedResources}/${progress.totalResources}: ${errorMessage}`
            );

            return null;
          }
        });

        // Wait for chunk to complete before next chunk
        await Promise.all(chunkPromises);

        index += chunk.length;
      }

      // Emit completion
      const endTime = new Date();
      const totalTime = endTime.getTime() - startTime.getTime();

      const complete: StreamingComplete = {
        requestId,
        totalResources: progress.totalResources,
        validResources: progress.validResources,
        invalidResources: progress.invalidResources,
        errorResources: progress.errorResources,
        totalTime,
        averageTime: totalTime / progress.totalResources,
        startTime,
        endTime,
      };

      this.emit('complete', complete);

      console.log(
        `[StreamingValidator] Streaming validation complete: ${progress.validResources} valid, ` +
        `${progress.invalidResources} invalid, ${progress.errorResources} errors (${totalTime}ms)`
      );

    } catch (error) {
      console.error('[StreamingValidator] Streaming validation failed:', error);
      this.emit('failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
      throw error;

    } finally {
      // Cleanup
      this.activeStreams.delete(requestId);
    }
  }

  /**
   * Get progress for active stream
   */
  getProgress(requestId: string): StreamingProgress | null {
    return this.activeStreams.get(requestId) || null;
  }

  /**
   * Get all active streams
   */
  getActiveStreams(): Map<string, StreamingProgress> {
    return new Map(this.activeStreams);
  }

  /**
   * Cancel streaming validation
   */
  cancelStream(requestId: string): boolean {
    const progress = this.activeStreams.get(requestId);
    if (!progress) {
      return false;
    }

    // Mark as cancelled
    this.activeStreams.delete(requestId);

    this.emit('cancelled', {
      requestId,
      processedResources: progress.processedResources,
      timestamp: new Date(),
    });

    console.log(`[StreamingValidator] Cancelled stream: ${requestId}`);
    return true;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let streamingValidatorInstance: StreamingValidator | null = null;

export function getStreamingValidator(): StreamingValidator {
  if (!streamingValidatorInstance) {
    streamingValidatorInstance = new StreamingValidator();
  }
  return streamingValidatorInstance;
}


