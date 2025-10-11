/**
 * Validation Result Repository
 * 
 * @deprecated This repository uses the LEGACY validation_results table.
 * Use ValidationGroupsRepository for per-aspect validation instead.
 * 
 * Handles database operations for validation results
 */

import { db } from '../db';
import { validationResults } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface ValidationResult {
  id?: number;
  resourceType: string;
  fhirResourceId: string;
  serverId?: number;
  profileId?: number;
  isValid: boolean;
  errors?: any[];
  warnings?: any[];
  issues?: any[];
  profileUrl?: string;
  errorCount?: number;
  warningCount?: number;
  validationScore?: number;
  validatedAt?: Date;
  settingsHash?: string;
  settingsVersion?: number;
  resourceHash?: string;
  validationEngineVersion?: string;
  performanceMetrics?: any;
  aspectBreakdown?: any;
  validationDurationMs?: number;
  validationStatus?: string;
  validationStartedAt?: Date;
  validationCompletedAt?: Date;
  validationErrorMessage?: string;
  validationErrorDetails?: any;
}

export class ValidationResultRepository {
  constructor(private database: typeof db) {}

  /**
   * Store a validation result in the database
   */
  async storeValidationResult(result: ValidationResult): Promise<ValidationResult> {
    try {
      const [storedResult] = await this.database
        .insert(validationResults)
        .values({
          resourceType: result.resourceType,
          fhirResourceId: result.fhirResourceId,
          serverId: result.serverId,
          profileId: result.profileId,
          isValid: result.isValid,
          errors: result.errors || [],
          warnings: result.warnings || [],
          issues: result.issues || [],
          profileUrl: result.profileUrl,
          errorCount: result.errorCount || 0,
          warningCount: result.warningCount || 0,
          validationScore: result.validationScore || 0,
          validatedAt: result.validatedAt || new Date(),
          settingsHash: result.settingsHash,
          settingsVersion: result.settingsVersion || 1,
          resourceHash: result.resourceHash,
          validationEngineVersion: result.validationEngineVersion || '1.0.0',
          performanceMetrics: result.performanceMetrics || {},
          aspectBreakdown: result.aspectBreakdown || {},
          validationDurationMs: result.validationDurationMs || 0,
          validationStatus: result.validationStatus || 'completed',
          validationStartedAt: result.validationStartedAt,
          validationCompletedAt: result.validationCompletedAt || new Date(),
          validationErrorMessage: result.validationErrorMessage,
          validationErrorDetails: result.validationErrorDetails || {}
        })
        .returning();

      return storedResult;
    } catch (error) {
      console.error('Error storing validation result:', error);
      throw error;
    }
  }

  /**
   * Get validation results by resource type and FHIR resource ID
   */
  async getValidationResultsByResource(
    resourceType: string,
    fhirResourceId: string,
    serverId?: number
  ): Promise<ValidationResult[]> {
    try {
      const whereConditions = [
        eq(validationResults.resourceType, resourceType),
        eq(validationResults.fhirResourceId, fhirResourceId)
      ];

      if (serverId) {
        whereConditions.push(eq(validationResults.serverId, serverId));
      }

      const results = await this.database
        .select()
        .from(validationResults)
        .where(and(...whereConditions))
        .orderBy(validationResults.validatedAt);

      return results;
    } catch (error) {
      console.error('Error retrieving validation results:', error);
      throw error;
    }
  }

  /**
   * Get validation results by server ID
   */
  async getValidationResultsByServer(serverId: number): Promise<ValidationResult[]> {
    try {
      const results = await this.database
        .select()
        .from(validationResults)
        .where(eq(validationResults.serverId, serverId))
        .orderBy(validationResults.validatedAt);

      return results;
    } catch (error) {
      console.error('Error retrieving validation results by server:', error);
      throw error;
    }
  }

  /**
   * Get validation results by validation status
   */
  async getValidationResultsByStatus(status: string): Promise<ValidationResult[]> {
    try {
      const results = await this.database
        .select()
        .from(validationResults)
        .where(eq(validationResults.validationStatus, status))
        .orderBy(validationResults.validatedAt);

      return results;
    } catch (error) {
      console.error('Error retrieving validation results by status:', error);
      throw error;
    }
  }

  /**
   * Delete validation results by resource
   */
  async deleteValidationResultsByResource(
    resourceType: string,
    fhirResourceId: string,
    serverId?: number
  ): Promise<number> {
    try {
      const whereConditions = [
        eq(validationResults.resourceType, resourceType),
        eq(validationResults.fhirResourceId, fhirResourceId)
      ];

      if (serverId) {
        whereConditions.push(eq(validationResults.serverId, serverId));
      }

      const result = await this.database
        .delete(validationResults)
        .where(and(...whereConditions));

      return result.rowCount || 0;
    } catch (error) {
      console.error('Error deleting validation results:', error);
      throw error;
    }
  }

  /**
   * Get validation result statistics
   */
  async getValidationStatistics(): Promise<{
    totalResults: number;
    validResults: number;
    invalidResults: number;
    averageScore: number;
    averageValidationTime: number;
  }> {
    try {
      const results = await this.database
        .select()
        .from(validationResults);

      const totalResults = results.length;
      const validResults = results.filter(r => r.isValid).length;
      const invalidResults = totalResults - validResults;
      const averageScore = totalResults > 0 ? 
        results.reduce((sum, r) => sum + (r.validationScore || 0), 0) / totalResults : 0;
      const averageValidationTime = totalResults > 0 ?
        results.reduce((sum, r) => sum + (r.validationDurationMs || 0), 0) / totalResults : 0;

      return {
        totalResults,
        validResults,
        invalidResults,
        averageScore,
        averageValidationTime
      };
    } catch (error) {
      console.error('Error getting validation statistics:', error);
      throw error;
    }
  }
}
