/**
 * Validation Metrics Routes
 * 
 * Task 3.12: API endpoints for fallback metrics and terminology validation statistics
 */

import type { Express } from "express";
import { getTerminologyAdapter } from "../../../services/validation/terminology/terminology-adapter.js";
import { getReferenceValidatorEnhanced } from "../../../services/validation/engine/reference-validator-enhanced.js";
import { getFhirValidateOperation } from "../../../services/fhir/fhir-validate-operation.js";
import { asyncHandler, ApiResponse } from "../../../utils/error-handler.js";
import logger from "../../../utils/logger.js";

export function setupValidationMetricsRoutes(app: Express) {
  /**
   * Task 3.12: Get fallback metrics for terminology validation
   * 
   * Returns success rates and usage counts for:
   * - Ontoserver (offline)
   * - Cache (fallback)
   * - tx.fhir.org (online/fallback)
   */
  app.get("/api/validation/metrics/fallback", asyncHandler(async (req, res) => {
    try {
      const terminologyAdapter = getTerminologyAdapter();
      const metrics = terminologyAdapter.getFallbackMetrics();
      
      logger.info('[ValidationMetrics] Fallback metrics requested');
      
      ApiResponse.success(res, metrics, 'Fallback metrics retrieved successfully');
    } catch (error: any) {
      logger.error('[ValidationMetrics] Failed to retrieve fallback metrics:', error);
      ApiResponse.serviceError(res, 'Failed to retrieve fallback metrics', error.message);
    }
  }));

  /**
   * Task 3.12: Reset fallback metrics
   */
  app.post("/api/validation/metrics/fallback/reset", asyncHandler(async (req, res) => {
    try {
      const terminologyAdapter = getTerminologyAdapter();
      terminologyAdapter.resetMetrics();
      
      logger.info('[ValidationMetrics] Fallback metrics reset');
      
      ApiResponse.success(res, null, 'Fallback metrics reset successfully');
    } catch (error: any) {
      logger.error('[ValidationMetrics] Failed to reset fallback metrics:', error);
      ApiResponse.serviceError(res, 'Failed to reset fallback metrics', error.message);
    }
  }));

  /**
   * Task 3.12: Get cache statistics
   */
  app.get("/api/validation/metrics/cache", asyncHandler(async (req, res) => {
    try {
      const terminologyAdapter = getTerminologyAdapter();
      const cacheStats = terminologyAdapter.getCacheStats();
      
      logger.info('[ValidationMetrics] Cache statistics requested');
      
      ApiResponse.success(res, cacheStats, 'Cache statistics retrieved successfully');
    } catch (error: any) {
      logger.error('[ValidationMetrics] Failed to retrieve cache statistics:', error);
      ApiResponse.serviceError(res, 'Failed to retrieve cache statistics', error.message);
    }
  }));

  /**
   * Task 7.13: Get reference validation statistics
   */
  app.get("/api/validation/metrics/references", asyncHandler(async (req, res) => {
    try {
      const referenceValidator = getReferenceValidatorEnhanced();
      const statistics = referenceValidator.getStatistics();
      
      logger.info('[ValidationMetrics] Reference validation statistics requested');
      
      ApiResponse.success(res, statistics, 'Reference validation statistics retrieved successfully');
    } catch (error: any) {
      logger.error('[ValidationMetrics] Failed to retrieve reference statistics:', error);
      ApiResponse.serviceError(res, 'Failed to retrieve reference statistics', error.message);
    }
  }));

  /**
   * Task 7.13: Reset reference validation statistics
   */
  app.post("/api/validation/metrics/references/reset", asyncHandler(async (req, res) => {
    try {
      const referenceValidator = getReferenceValidatorEnhanced();
      referenceValidator.resetStatistics();
      
      logger.info('[ValidationMetrics] Reference validation statistics reset');
      
      ApiResponse.success(res, null, 'Reference validation statistics reset successfully');
    } catch (error: any) {
      logger.error('[ValidationMetrics] Failed to reset reference statistics:', error);
      ApiResponse.serviceError(res, 'Failed to reset reference statistics', error.message);
    }
  }));

  /**
   * Task 8.11: Get $validate operation metrics
   */
  app.get("/api/validation/metrics/validate-operation", asyncHandler(async (req, res) => {
    try {
      const validateOperation = getFhirValidateOperation();
      const metrics = validateOperation.getMetrics();
      
      logger.info('[ValidationMetrics] $validate operation metrics requested');
      
      ApiResponse.success(res, metrics, '$validate operation metrics retrieved successfully');
    } catch (error: any) {
      logger.error('[ValidationMetrics] Failed to retrieve $validate metrics:', error);
      ApiResponse.serviceError(res, 'Failed to retrieve $validate metrics', error.message);
    }
  }));

  /**
   * Task 8.11: Reset $validate operation metrics
   */
  app.post("/api/validation/metrics/validate-operation/reset", asyncHandler(async (req, res) => {
    try {
      const validateOperation = getFhirValidateOperation();
      validateOperation.resetMetrics();
      
      logger.info('[ValidationMetrics] $validate operation metrics reset');
      
      ApiResponse.success(res, null, '$validate operation metrics reset successfully');
    } catch (error: any) {
      logger.error('[ValidationMetrics] Failed to reset $validate metrics:', error);
      ApiResponse.serviceError(res, 'Failed to reset $validate metrics', error.message);
    }
  }));
}

