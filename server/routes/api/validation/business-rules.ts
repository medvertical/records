import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../../../db.js';
import { businessRules } from '@shared/schema-business-rules';
import { eq, desc } from 'drizzle-orm';
import logger from '../../../utils/logger';

const router = Router();

/**
 * GET /api/validation/business-rules
 * Get all business rules
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const rules = await db
      .select()
      .from(businessRules)
      .orderBy(desc(businessRules.createdAt));

    logger.info('[API] Fetched business rules', { count: rules.length });
    res.json(rules);
  } catch (error) {
    logger.error('[API] Error fetching business rules:', error);
    // Return empty array instead of error to prevent UI crashes
    res.json([]);
  }
});

/**
 * GET /api/validation/business-rules/:id
 * Get a single business rule by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [rule] = await db
      .select()
      .from(businessRules)
      .where(eq(businessRules.id, parseInt(id)));

    if (!rule) {
      return res.status(404).json({ error: 'Business rule not found' });
    }

    logger.info('[API] Fetched business rule', { ruleId: id });
    res.json(rule);
  } catch (error) {
    logger.error('[API] Error fetching business rule:', error);
    res.status(500).json({ error: 'Failed to fetch business rule' });
  }
});

/**
 * POST /api/validation/business-rules
 * Create a new business rule
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, resourceTypes, expression, severity, validationMessage, description, ruleId } = req.body;

    if (!name || !resourceTypes || !expression || !ruleId) {
      return res.status(400).json({ error: 'Missing required fields: name, ruleId, resourceTypes, expression' });
    }

    const [newRule] = await db
      .insert(businessRules)
      .values({
        name,
        ruleId,
        resourceTypes: Array.isArray(resourceTypes) ? resourceTypes : [resourceTypes],
        expression,
        severity: severity || 'error',
        validationMessage: validationMessage || `Business rule ${name} failed`,
        description,
        enabled: true,
      })
      .returning();

    logger.info('[API] Created business rule', { ruleId: newRule.id, name });
    res.status(201).json(newRule);
  } catch (error) {
    logger.error('[API] Error creating business rule:', error);
    res.status(500).json({ error: 'Failed to create business rule' });
  }
});

/**
 * PATCH /api/validation/business-rules/:id
 * Update an existing business rule
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const [updatedRule] = await db
      .update(businessRules)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(businessRules.id, parseInt(id)))
      .returning();

    if (!updatedRule) {
      return res.status(404).json({ error: 'Business rule not found' });
    }

    logger.info('[API] Updated business rule', { ruleId: id });
    res.json(updatedRule);
  } catch (error) {
    logger.error('[API] Error updating business rule:', error);
    res.status(500).json({ error: 'Failed to update business rule' });
  }
});

/**
 * DELETE /api/validation/business-rules/:id
 * Delete a business rule
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [deletedRule] = await db
      .delete(businessRules)
      .where(eq(businessRules.id, parseInt(id)))
      .returning();

    if (!deletedRule) {
      return res.status(404).json({ error: 'Business rule not found' });
    }

    logger.info('[API] Deleted business rule', { ruleId: id });
    res.json({ success: true, id: parseInt(id) });
  } catch (error) {
    logger.error('[API] Error deleting business rule:', error);
    res.status(500).json({ error: 'Failed to delete business rule' });
  }
});

/**
 * POST /api/validation/business-rules/:id/test
 * Test a business rule against sample data
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resource } = req.body;

    const [rule] = await db
      .select()
      .from(businessRules)
      .where(eq(businessRules.id, parseInt(id)));

    if (!rule) {
      return res.status(404).json({ error: 'Business rule not found' });
    }

    // For now, return a placeholder response until FHIRPath evaluator is implemented
    logger.info('[API] Business rule test requested', { ruleId: id });
    res.json({
      ruleId: parseInt(id),
      ruleName: rule.name,
      expression: rule.expression,
      result: null,
      passed: null,
      message: 'Business rule testing not yet implemented',
    });
  } catch (error) {
    logger.error('[API] Error testing business rule:', error);
    res.status(500).json({ error: 'Failed to test business rule' });
  }
});

export default router;
