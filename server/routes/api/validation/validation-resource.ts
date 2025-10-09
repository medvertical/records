/**
 * Individual Resource Validation Routes
 * 
 * Handles validation of individual FHIR resources
 */

import type { Express, Request, Response } from "express";
import { ConsolidatedValidationService } from "../../../services/validation";
import { asyncHandler, InputValidator, ApiResponse, ValidationError, ServiceError } from "../../../utils/error-handler";

// ============================================================================
// Individual Resource Validation Routes
// ============================================================================

export function setupResourceValidationRoutes(app: Express, consolidatedValidationService: ConsolidatedValidationService | null) {
  
  app.post("/api/validation/validate-resource", asyncHandler(async (req: Request, res: Response) => {
    try {
      if (!consolidatedValidationService) {
        throw new ServiceError("Validation service not initialized");
      }

      // Validate request body
      InputValidator.validateObject(req.body, 'request body', ['resource']);
      InputValidator.validateObject(req.body.resource, 'resource', ['resourceType', 'id']);

      const { resource } = req.body;
      const { detailedResult } = await consolidatedValidationService!.validateResource(resource, true, true);

      ApiResponse.success(res, detailedResult, 'Resource validated successfully');
    } catch (error: any) {
      if (error instanceof ValidationError) {
        ApiResponse.validationError(res, error.message, error.details);
      } else if (error instanceof ServiceError) {
        ApiResponse.serviceError(res, error.message, error.details);
      } else {
        ApiResponse.serviceError(res, 'Failed to validate resource', error.message);
      }
    }
  }));

  app.post("/api/validation/validate-resource-detailed", asyncHandler(async (req: Request, res: Response) => {
    try {
      if (!consolidatedValidationService) {
        throw new ServiceError("Validation service not initialized");
      }

      // Validate request body
      InputValidator.validateObject(req.body, 'request body', ['resource']);
      InputValidator.validateObject(req.body.resource, 'resource', ['resourceType', 'id']);

      const { resource } = req.body;
      console.log('[ValidationRoute] Validating resource:', resource.resourceType, resource.id);

      const { detailedResult } = await consolidatedValidationService!.validateResource(resource, true, true);
      
      ApiResponse.success(res, detailedResult, 'Resource validated successfully with detailed results');
    } catch (error: any) {
      console.error('[ValidationRoute] Validation error:', error);
      if (error instanceof ValidationError) {
        ApiResponse.validationError(res, error.message, error.details);
      } else if (error instanceof ServiceError) {
        ApiResponse.serviceError(res, error.message, error.details);
      } else {
        ApiResponse.serviceError(res, 'Failed to validate resource', error.message);
      }
    }
  }));
}
