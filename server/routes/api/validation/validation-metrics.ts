/**
 * Validation Metrics Routes
 * 
 * Task 3.12: API endpoints for fallback metrics and terminology validation statistics
 */

import type { Express } from "express";
import { getTerminologyAdapter } from "../../../services/validation/terminology/terminology-adapter.js";
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
}

