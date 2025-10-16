/**
 * Business Rules API Routes
 * Task 9.10: Create API endpoints for business rules CRUD operations
 */

import express from 'express';
import { businessRulesService } from '../../../services/business-rules-service';
import { fhirpathValidator } from '../../../services/fhirpath-validator';

const router = express.Router();

// Lazy load BusinessRuleValidator to avoid circular dependencies
let validatorInstance: any = null;
async function getBusinessRuleValidator() {
  if (!validatorInstance) {
    const { BusinessRuleValidator } = await import('../../../services/validation/engine/business-rule-validator');
    validatorInstance = new BusinessRuleValidator();
  }
  return validatorInstance;
}

/**
 * GET /api/validation/rules
 * Get all business rules with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const { search, category, severity, enabled, resourceType } = req.query;

    // If no filters, get all rules
    if (!search && !category && !severity && enabled === undefined && !resourceType) {
      const rules = await businessRulesService.getAllRules();
      return res.json(rules);
    }

    // Search with filters
    const rules = await businessRulesService.searchRules({
      search: search as string,
      category: category as string,
      severity: severity as string,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      resourceType: resourceType as string,
    });

    res.json(rules);
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error fetching rules:', error);
    res.status(500).json({
      error: 'Failed to fetch business rules',
      message: error.message,
    });
  }
});

/**
 * GET /api/validation/rules/stats
 * Get rule statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await businessRulesService.getRuleStatistics();
    res.json(stats);
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error fetching rule stats:', error);
    res.status(500).json({
      error: 'Failed to fetch rule statistics',
      message: error.message,
    });
  }
});

/**
 * GET /api/validation/rules/:id
 * Get a specific business rule by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await businessRulesService.getRuleById(id);

    if (!rule) {
      return res.status(404).json({
        error: 'Rule not found',
        message: `No business rule found with ID: ${id}`,
      });
    }

    res.json(rule);
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error fetching rule:', error);
    res.status(500).json({
      error: 'Failed to fetch business rule',
      message: error.message,
    });
  }
});

/**
 * GET /api/validation/rules/:id/versions
 * Get version history for a rule
 */
router.get('/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;
    const versions = await businessRulesService.getRuleVersionHistory(id);

    res.json(versions);
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error fetching rule versions:', error);
    res.status(500).json({
      error: 'Failed to fetch rule versions',
      message: error.message,
    });
  }
});

/**
 * POST /api/validation/rules/validate-expression
 * Validate a FHIRPath expression for syntax errors
 * Task 9.9: FHIRPath expression validation endpoint
 */
router.post('/validate-expression', async (req, res) => {
  try {
    const { expression } = req.body;

    if (!expression) {
      return res.status(400).json({
        error: 'Missing expression',
        message: 'expression field is required',
      });
    }

    const validationResult = fhirpathValidator.validate(expression);

    res.json(validationResult);
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error validating expression:', error);
    res.status(500).json({
      error: 'Failed to validate expression',
      message: error.message,
    });
  }
});

/**
 * POST /api/validation/rules/test-expression
 * Test a FHIRPath expression against a sample resource
 * Task 9.4: Expression testing endpoint
 */
router.post('/test-expression', async (req, res) => {
  try {
    const { expression, resource } = req.body;

    if (!expression || !resource) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'expression and resource fields are required',
      });
    }

    // First validate the expression syntax
    const validationResult = fhirpathValidator.validate(expression);
    if (!validationResult.isValid) {
      return res.status(400).json({
        error: 'Invalid expression',
        validationErrors: validationResult.errors,
        suggestions: validationResult.warnings,
      });
    }

    // Execute the expression
    const testResult = await fhirpathValidator.testExpression(expression, resource);

    res.json({
      validation: validationResult,
      execution: testResult,
    });
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error testing expression:', error);
    res.status(500).json({
      error: 'Failed to test expression',
      message: error.message,
    });
  }
});

/**
 * POST /api/validation/rules
 * Create a new business rule
 */
router.post('/', async (req, res) => {
  try {
    const ruleData = req.body;

    // Validate required fields
    const requiredFields = ['name', 'description', 'fhirPathExpression', 'resourceTypes'];
    const missingFields = requiredFields.filter((field) => !ruleData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        missingFields,
      });
    }

    // Task 9.9: Validate FHIRPath expression before saving
    const validationResult = fhirpathValidator.validate(ruleData.fhirPathExpression);
    if (!validationResult.isValid) {
      return res.status(400).json({
        error: 'Invalid FHIRPath expression',
        validationErrors: validationResult.errors,
        suggestions: validationResult.warnings,
      });
    }

    // Get user ID from session if available
    const userId = (req as any).user?.id;

    const newRule = await businessRulesService.createRule(ruleData, userId);

    // Task 9.11: Clear custom rules cache after creating rule
    try {
      const validator = await getBusinessRuleValidator();
      validator.clearCustomRulesCache();
    } catch (error) {
      console.error('[BusinessRulesAPI] Failed to clear cache:', error);
    }

    res.status(201).json(newRule);
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error creating rule:', error);
    res.status(500).json({
      error: 'Failed to create business rule',
      message: error.message,
    });
  }
});

/**
 * PUT /api/validation/rules/:id
 * Update an existing business rule
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Task 9.9: Validate FHIRPath expression if it's being updated
    if (updates.fhirPathExpression) {
      const validationResult = fhirpathValidator.validate(updates.fhirPathExpression);
      if (!validationResult.isValid) {
        return res.status(400).json({
          error: 'Invalid FHIRPath expression',
          validationErrors: validationResult.errors,
          suggestions: validationResult.warnings,
        });
      }
    }

    // Get user ID from session if available
    const userId = (req as any).user?.id;

    const updatedRule = await businessRulesService.updateRule(id, updates, userId);

    if (!updatedRule) {
      return res.status(404).json({
        error: 'Rule not found',
        message: `No business rule found with ID: ${id}`,
      });
    }

    // Task 9.11: Clear custom rules cache after updating rule
    try {
      const validator = await getBusinessRuleValidator();
      validator.clearCustomRulesCache();
    } catch (error) {
      console.error('[BusinessRulesAPI] Failed to clear cache:', error);
    }

    res.json(updatedRule);
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error updating rule:', error);
    res.status(500).json({
      error: 'Failed to update business rule',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/validation/rules/:id/toggle
 * Enable or disable a rule
 */
router.patch('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'enabled field must be a boolean',
      });
    }

    const userId = (req as any).user?.id;
    const updatedRule = await businessRulesService.toggleRule(id, enabled, userId);

    if (!updatedRule) {
      return res.status(404).json({
        error: 'Rule not found',
        message: `No business rule found with ID: ${id}`,
      });
    }

    // Task 9.11: Clear custom rules cache after toggling rule
    try {
      const validator = await getBusinessRuleValidator();
      validator.clearCustomRulesCache();
  } catch (error) {
      console.error('[BusinessRulesAPI] Failed to clear cache:', error);
    }

    res.json(updatedRule);
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error toggling rule:', error);
    res.status(500).json({
      error: 'Failed to toggle business rule',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/validation/rules/:id
 * Soft delete a business rule
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;

    let success: boolean;

    if (permanent === 'true') {
      success = await businessRulesService.permanentlyDeleteRule(id);
    } else {
      success = await businessRulesService.deleteRule(id);
    }

    if (!success) {
      return res.status(404).json({
        error: 'Rule not found',
        message: `No business rule found with ID: ${id}`,
      });
    }

    // Task 9.11: Clear custom rules cache after deleting rule
    try {
      const validator = await getBusinessRuleValidator();
      validator.clearCustomRulesCache();
  } catch (error) {
      console.error('[BusinessRulesAPI] Failed to clear cache:', error);
    }

    res.json({
      success: true,
      message: permanent === 'true' ? 'Rule permanently deleted' : 'Rule deleted',
    });
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error deleting rule:', error);
    res.status(500).json({
      error: 'Failed to delete business rule',
      message: error.message,
    });
  }
});

/**
 * POST /api/validation/rules/:id/duplicate
 * Duplicate an existing rule
 */
router.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const duplicatedRule = await businessRulesService.duplicateRule(id, userId);

    if (!duplicatedRule) {
      return res.status(404).json({
        error: 'Rule not found',
        message: `No business rule found with ID: ${id}`,
      });
    }

    res.status(201).json(duplicatedRule);
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error duplicating rule:', error);
    res.status(500).json({
      error: 'Failed to duplicate business rule',
      message: error.message,
    });
  }
});

/**
 * POST /api/validation/rules/:id/restore/:versionId
 * Restore a rule to a previous version
 */
router.post('/:id/restore/:versionId', async (req, res) => {
  try {
    const { id, versionId } = req.params;
    const userId = (req as any).user?.id;

    const restoredRule = await businessRulesService.restoreVersion(id, versionId, userId);

    if (!restoredRule) {
      return res.status(404).json({
        error: 'Version not found',
        message: `No version history found with ID: ${versionId}`,
      });
    }

    res.json(restoredRule);
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error restoring rule version:', error);
    res.status(500).json({
      error: 'Failed to restore rule version',
      message: error.message,
    });
  }
});

/**
 * GET /api/validation/rules/resource-type/:resourceType
 * Get all enabled rules for a specific resource type
 */
router.get('/resource-type/:resourceType', async (req, res) => {
  try {
    const { resourceType } = req.params;
    const rules = await businessRulesService.getRulesByResourceType(resourceType);

    res.json(rules);
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error fetching rules by resource type:', error);
    res.status(500).json({
      error: 'Failed to fetch rules by resource type',
      message: error.message,
    });
  }
});

/**
 * GET /api/validation/rules/category/:category
 * Get all rules in a specific category
 */
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const rules = await businessRulesService.getRulesByCategory(category);

    res.json(rules);
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error fetching rules by category:', error);
    res.status(500).json({
      error: 'Failed to fetch rules by category',
      message: error.message,
    });
  }
});

/**
 * POST /api/validation/rules/cache/clear
 * Clear custom rules cache
 * Task 9.11: Explicit cache clearing endpoint
 */
router.post('/cache/clear', async (req, res) => {
  try {
    const validator = await getBusinessRuleValidator();
    validator.clearCustomRulesCache();

    res.json({
      success: true,
      message: 'Custom rules cache cleared successfully',
    });
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error clearing cache:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message,
    });
  }
});

/**
 * GET /api/validation/rules/performance/metrics
 * Get performance metrics for all rules
 * Task 9.12: Performance monitoring endpoint
 */
router.get('/performance/metrics', async (req, res) => {
  try {
    const validator = await getBusinessRuleValidator();
    const metrics = validator.getPerformanceMetrics();

    res.json(metrics);
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error fetching performance metrics:', error);
    res.status(500).json({
      error: 'Failed to fetch performance metrics',
      message: error.message,
    });
  }
});

/**
 * GET /api/validation/rules/performance/summary
 * Get performance summary statistics
 * Task 9.12: Performance summary endpoint
 */
router.get('/performance/summary', async (req, res) => {
  try {
    const validator = await getBusinessRuleValidator();
    const summary = validator.getPerformanceSummary();

    res.json(summary);
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error fetching performance summary:', error);
    res.status(500).json({
      error: 'Failed to fetch performance summary',
      message: error.message,
    });
  }
});

/**
 * GET /api/validation/rules/performance/:id
 * Get performance metrics for a specific rule
 * Task 9.12: Individual rule performance endpoint
 */
router.get('/performance/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validator = await getBusinessRuleValidator();
    const metrics = validator.getRulePerformanceMetrics(id);

    if (!metrics) {
      return res.status(404).json({
        error: 'Metrics not found',
        message: `No performance metrics found for rule ID: ${id}`,
      });
    }

    res.json(metrics);
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error fetching rule performance:', error);
    res.status(500).json({
      error: 'Failed to fetch rule performance',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/validation/rules/performance/metrics
 * Clear performance metrics
 * Task 9.12: Clear performance metrics endpoint
 */
router.delete('/performance/metrics', async (req, res) => {
  try {
    const validator = await getBusinessRuleValidator();
    validator.clearPerformanceMetrics();

    res.json({
      success: true,
      message: 'Performance metrics cleared successfully',
    });
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error clearing performance metrics:', error);
    res.status(500).json({
      error: 'Failed to clear performance metrics',
      message: error.message,
    });
  }
});

/**
 * GET /api/validation/rules/export
 * Export rules as JSON
 * Task 9.13: Export rules endpoint
 */
router.get('/export', async (req, res) => {
  try {
    const { category, severity, enabled, resourceType } = req.query;

    const exportData = await businessRulesService.exportRules({
      category: category as string,
      severity: severity as string,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      resourceType: resourceType as string,
    });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="business-rules-export-${new Date().toISOString().split('T')[0]}.json"`
    );

    res.json(exportData);
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error exporting rules:', error);
    res.status(500).json({
      error: 'Failed to export rules',
      message: error.message,
    });
  }
});

/**
 * POST /api/validation/rules/import
 * Import rules from JSON
 * Task 9.13: Import rules endpoint
 */
router.post('/import', async (req, res) => {
  try {
    const importData = req.body;
    const { skipDuplicates, overwriteExisting } = req.query;
    const userId = (req as any).user?.id;

    const result = await businessRulesService.importRules(importData, {
      skipDuplicates: skipDuplicates !== 'false',
      overwriteExisting: overwriteExisting === 'true',
      userId,
    });

    // Clear cache after import
    try {
      const validator = await getBusinessRuleValidator();
      validator.clearCustomRulesCache();
  } catch (error) {
      console.error('[BusinessRulesAPI] Failed to clear cache after import:', error);
    }

    res.json(result);
  } catch (error: any) {
    console.error('[BusinessRulesAPI] Error importing rules:', error);
    res.status(500).json({
      error: 'Failed to import rules',
      message: error.message,
    });
  }
});

export default router;
