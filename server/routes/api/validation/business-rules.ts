/**
 * Business Rules CRUD API
 * 
 * Task 6.6: REST API for managing custom business rules
 * 
 * Endpoints:
 * - POST   /api/validation/business-rules      - Create rule
 * - GET    /api/validation/business-rules      - List all rules
 * - GET    /api/validation/business-rules/:id  - Get rule by ID
 * - PUT    /api/validation/business-rules/:id  - Update rule
 * - DELETE /api/validation/business-rules/:id  - Delete rule
 * - POST   /api/validation/business-rules/:id/test - Test rule
 */

import { Router, Request, Response } from 'express';
import { db } from '../../../db';
import { businessRules, InsertBusinessRule } from '@shared/schema-business-rules';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { getFHIRPathEvaluator } from '../../../services/validation/engine/fhirpath-evaluator';

const router = Router();
const fhirpathEvaluator = getFHIRPathEvaluator();

// ============================================================================
// Helper Functions
// ============================================================================

function validateBusinessRule(rule: any): { valid: boolean; error?: string } {
  if (!rule.name || rule.name.trim().length === 0) {
    return { valid: false, error: 'Rule name is required' };
  }

  if (!rule.ruleId || rule.ruleId.trim().length === 0) {
    return { valid: false, error: 'Rule ID is required' };
  }

  if (!rule.expression || rule.expression.trim().length === 0) {
    return { valid: false, error: 'FHIRPath expression is required' };
  }

  if (!rule.resourceTypes || !Array.isArray(rule.resourceTypes) || rule.resourceTypes.length === 0) {
    return { valid: false, error: 'At least one resource type is required' };
  }

  // Validate FHIRPath expression syntax
  const expressionValidation = fhirpathEvaluator.validateExpression(rule.expression);
  if (!expressionValidation.valid) {
    return { 
      valid: false, 
      error: `Invalid FHIRPath expression: ${expressionValidation.error}` 
    };
  }

  return { valid: true };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/validation/business-rules
 * Create a new business rule
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const ruleData = req.body;

    // Validate input
    const validation = validateBusinessRule(ruleData);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    // Check for duplicate rule ID
    const existing = await db
      .select()
      .from(businessRules)
      .where(eq(businessRules.ruleId, ruleData.ruleId))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Rule with ID ${ruleData.ruleId} already exists`
      });
    }

    // Insert new rule
    const newRule: InsertBusinessRule = {
      name: ruleData.name,
      description: ruleData.description,
      ruleId: ruleData.ruleId,
      expression: ruleData.expression,
      severity: ruleData.severity || 'error',
      enabled: ruleData.enabled !== undefined ? ruleData.enabled : true,
      resourceTypes: ruleData.resourceTypes,
      fhirVersions: ruleData.fhirVersions || ['R4'],
      validationMessage: ruleData.validationMessage,
      suggestions: ruleData.suggestions,
      category: ruleData.category,
      tags: ruleData.tags || [],
      createdBy: ruleData.createdBy || 'system'
    };

    const [created] = await db
      .insert(businessRules)
      .values(newRule)
      .returning();

    res.status(201).json({
      success: true,
      message: 'Business rule created successfully',
      data: created
    });

  } catch (error: any) {
    console.error('[BusinessRulesAPI] Create failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create business rule',
      error: error.message
    });
  }
});

/**
 * GET /api/validation/business-rules
 * Get all business rules (with optional filtering)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      enabled, 
      resourceType, 
      category,
      fhirVersion 
    } = req.query;

    let query = db.select().from(businessRules);

    // Apply filters
    const conditions = [];

    if (enabled !== undefined) {
      conditions.push(eq(businessRules.enabled, enabled === 'true'));
    }

    if (resourceType) {
      conditions.push(sql`${resourceType} = ANY(${businessRules.resourceTypes})`);
    }

    if (category) {
      conditions.push(eq(businessRules.category, category as string));
    }

    if (fhirVersion) {
      conditions.push(sql`${fhirVersion} = ANY(${businessRules.fhirVersions})`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const rules = await query;

    res.json({
      success: true,
      data: {
        total: rules.length,
        rules
      }
    });

  } catch (error: any) {
    console.error('[BusinessRulesAPI] List failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list business rules',
      error: error.message
    });
  }
});

/**
 * GET /api/validation/business-rules/:id
 * Get a specific business rule by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rule ID'
      });
    }

    const [rule] = await db
      .select()
      .from(businessRules)
      .where(eq(businessRules.id, id))
      .limit(1);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Business rule not found'
      });
    }

    res.json({
      success: true,
      data: rule
    });

  } catch (error: any) {
    console.error('[BusinessRulesAPI] Get failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get business rule',
      error: error.message
    });
  }
});

/**
 * PUT /api/validation/business-rules/:id
 * Update a business rule
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rule ID'
      });
    }

    // Validate if expression is being updated
    if (updates.expression) {
      const validation = fhirpathEvaluator.validateExpression(updates.expression);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: `Invalid FHIRPath expression: ${validation.error}`
        });
      }
    }

    // Update rule
    const [updated] = await db
      .update(businessRules)
      .set({
        ...updates,
        updatedAt: new Date(),
        updatedBy: updates.updatedBy || 'system'
      })
      .where(eq(businessRules.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Business rule not found'
      });
    }

    res.json({
      success: true,
      message: 'Business rule updated successfully',
      data: updated
    });

  } catch (error: any) {
    console.error('[BusinessRulesAPI] Update failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update business rule',
      error: error.message
    });
  }
});

/**
 * DELETE /api/validation/business-rules/:id
 * Delete a business rule
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rule ID'
      });
    }

    const [deleted] = await db
      .delete(businessRules)
      .where(eq(businessRules.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Business rule not found'
      });
    }

    res.json({
      success: true,
      message: 'Business rule deleted successfully',
      data: deleted
    });

  } catch (error: any) {
    console.error('[BusinessRulesAPI] Delete failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete business rule',
      error: error.message
    });
  }
});

/**
 * POST /api/validation/business-rules/:id/test
 * Test a business rule against a sample resource
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { resource } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rule ID'
      });
    }

    if (!resource) {
      return res.status(400).json({
        success: false,
        message: 'Sample resource is required for testing'
      });
    }

    // Get rule
    const [rule] = await db
      .select()
      .from(businessRules)
      .where(eq(businessRules.id, id))
      .limit(1);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Business rule not found'
      });
    }

    // Execute rule
    const result = await fhirpathEvaluator.evaluateBoolean(
      resource,
      rule.expression,
      { timeout: 2000 }
    );

    res.json({
      success: true,
      data: {
        ruleId: rule.ruleId,
        ruleName: rule.name,
        expression: rule.expression,
        passed: result.result,
        executionTimeMs: result.executionTime,
        error: result.error,
        message: result.result 
          ? 'Rule passed ✅' 
          : rule.validationMessage || 'Rule failed ❌',
        suggestions: result.result ? [] : (rule.suggestions || [])
      }
    });

  } catch (error: any) {
    console.error('[BusinessRulesAPI] Test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test business rule',
      error: error.message
    });
  }
});

export default router;

