/**
 * Business Rules Service
 * Task 9.8: CRUD operations for business rules with versioning
 */

import { db } from '../db';
import { businessRules, ruleVersionHistory, type BusinessRule, type NewBusinessRule } from '../db/schema/business-rules';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Business Rule with versioning interface for API
 */
export interface BusinessRuleDTO {
  id: string;
  name: string;
  description: string;
  fhirPathExpression: string;
  resourceTypes: string[];
  severity: 'error' | 'warning' | 'info';
  enabled: boolean;
  category: string;
  version: string;
  previousVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Version history entry
 */
export interface RuleVersionDTO {
  id: string;
  ruleId: string;
  version: string;
  name: string;
  description: string;
  fhirPathExpression: string;
  resourceTypes: string[];
  severity: string;
  category: string;
  changeDescription?: string | null;
  changedBy?: string | null;
  changedAt: string;
}

export class BusinessRulesService {
  /**
   * Get all active business rules
   */
  async getAllRules(): Promise<BusinessRuleDTO[]> {
    const rules = await db
      .select()
      .from(businessRules)
      .where(isNull(businessRules.deletedAt))
      .orderBy(desc(businessRules.createdAt));

    return rules.map(this.mapToDTO);
  }

  /**
   * Get business rule by ID
   */
  async getRuleById(id: string): Promise<BusinessRuleDTO | null> {
    const rules = await db
      .select()
      .from(businessRules)
      .where(and(eq(businessRules.id, id), isNull(businessRules.deletedAt)))
      .limit(1);

    return rules.length > 0 ? this.mapToDTO(rules[0]) : null;
  }

  /**
   * Get rules by resource type
   */
  async getRulesByResourceType(resourceType: string): Promise<BusinessRuleDTO[]> {
    const rules = await db
      .select()
      .from(businessRules)
      .where(
        and(
          sql`${businessRules.resourceTypes} @> ${JSON.stringify([resourceType])}::jsonb`,
          eq(businessRules.enabled, true),
          isNull(businessRules.deletedAt)
        )
      );

    return rules.map(this.mapToDTO);
  }

  /**
   * Get rules by category
   */
  async getRulesByCategory(category: string): Promise<BusinessRuleDTO[]> {
    const rules = await db
      .select()
      .from(businessRules)
      .where(
        and(
          eq(businessRules.category, category),
          isNull(businessRules.deletedAt)
        )
      )
      .orderBy(desc(businessRules.createdAt));

    return rules.map(this.mapToDTO);
  }

  /**
   * Create a new business rule
   */
  async createRule(
    ruleData: Omit<BusinessRuleDTO, 'id' | 'createdAt' | 'updatedAt' | 'previousVersionId'>,
    userId?: string
  ): Promise<BusinessRuleDTO> {
    const id = nanoid();
    const now = new Date();

    const newRule: NewBusinessRule = {
      id,
      name: ruleData.name,
      description: ruleData.description,
      fhirPathExpression: ruleData.fhirPathExpression,
      resourceTypes: ruleData.resourceTypes,
      severity: ruleData.severity,
      enabled: ruleData.enabled,
      category: ruleData.category,
      version: ruleData.version || '1.0.0',
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
      tags: ruleData.tags,
      metadata: ruleData.metadata,
    };

    const inserted = await db.insert(businessRules).values(newRule).returning();

    return this.mapToDTO(inserted[0]);
  }

  /**
   * Update an existing business rule
   * Creates a version history entry automatically via trigger
   */
  async updateRule(
    id: string,
    updates: Partial<Omit<BusinessRuleDTO, 'id' | 'createdAt' | 'createdBy'>>,
    userId?: string
  ): Promise<BusinessRuleDTO | null> {
    const now = new Date();

    // Increment version if expression changed
    const existingRule = await this.getRuleById(id);
    if (!existingRule) {
      return null;
    }

    let newVersion = existingRule.version;
    if (updates.fhirPathExpression && updates.fhirPathExpression !== existingRule.fhirPathExpression) {
      newVersion = this.incrementVersion(existingRule.version);
    }

    const updated = await db
      .update(businessRules)
      .set({
        ...updates,
        version: newVersion,
        updatedAt: now,
        updatedBy: userId,
      })
      .where(eq(businessRules.id, id))
      .returning();

    return updated.length > 0 ? this.mapToDTO(updated[0]) : null;
  }

  /**
   * Soft delete a business rule
   */
  async deleteRule(id: string): Promise<boolean> {
    const result = await db
      .update(businessRules)
      .set({ deletedAt: new Date() })
      .where(eq(businessRules.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Hard delete a business rule (permanent)
   */
  async permanentlyDeleteRule(id: string): Promise<boolean> {
    const result = await db
      .delete(businessRules)
      .where(eq(businessRules.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Enable or disable a rule
   */
  async toggleRule(id: string, enabled: boolean, userId?: string): Promise<BusinessRuleDTO | null> {
    const updated = await db
      .update(businessRules)
      .set({
        enabled,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(businessRules.id, id))
      .returning();

    return updated.length > 0 ? this.mapToDTO(updated[0]) : null;
  }

  /**
   * Get version history for a rule
   */
  async getRuleVersionHistory(ruleId: string): Promise<RuleVersionDTO[]> {
    const versions = await db
      .select()
      .from(ruleVersionHistory)
      .where(eq(ruleVersionHistory.ruleId, ruleId))
      .orderBy(desc(ruleVersionHistory.changedAt));

    return versions.map((v) => ({
      id: v.id,
      ruleId: v.ruleId,
      version: v.version,
      name: v.name,
      description: v.description,
      fhirPathExpression: v.fhirPathExpression,
      resourceTypes: v.resourceTypes as string[],
      severity: v.severity,
      category: v.category,
      changeDescription: v.changeDescription,
      changedBy: v.changedBy,
      changedAt: v.changedAt.toISOString(),
    }));
  }

  /**
   * Restore a rule to a previous version
   */
  async restoreVersion(ruleId: string, versionHistoryId: string, userId?: string): Promise<BusinessRuleDTO | null> {
    // Get the version history entry
    const versionEntries = await db
      .select()
      .from(ruleVersionHistory)
      .where(eq(ruleVersionHistory.id, versionHistoryId))
      .limit(1);

    if (versionEntries.length === 0) {
      return null;
    }

    const versionEntry = versionEntries[0];

    // Update the rule with the historical data
    return this.updateRule(
      ruleId,
      {
        name: versionEntry.name,
        description: versionEntry.description,
        fhirPathExpression: versionEntry.fhirPathExpression,
        resourceTypes: versionEntry.resourceTypes as string[],
        severity: versionEntry.severity as 'error' | 'warning' | 'info',
        category: versionEntry.category,
        version: this.incrementVersion(versionEntry.version, 'patch'),
      },
      userId
    );
  }

  /**
   * Duplicate a rule
   */
  async duplicateRule(id: string, userId?: string): Promise<BusinessRuleDTO | null> {
    const original = await this.getRuleById(id);
    if (!original) {
      return null;
    }

    return this.createRule(
      {
        name: `${original.name} (Copy)`,
        description: original.description,
        fhirPathExpression: original.fhirPathExpression,
        resourceTypes: original.resourceTypes,
        severity: original.severity,
        enabled: original.enabled,
        category: original.category,
        version: '1.0.0',
        tags: original.tags,
        metadata: original.metadata,
      },
      userId
    );
  }

  /**
   * Get rules by filter criteria
   */
  async searchRules(filters: {
    search?: string;
    category?: string;
    severity?: string;
    enabled?: boolean;
    resourceType?: string;
  }): Promise<BusinessRuleDTO[]> {
    let query = db.select().from(businessRules).where(isNull(businessRules.deletedAt));

    // Apply filters dynamically
    const conditions = [isNull(businessRules.deletedAt)];

    if (filters.category) {
      conditions.push(eq(businessRules.category, filters.category));
    }

    if (filters.severity) {
      conditions.push(eq(businessRules.severity, filters.severity));
    }

    if (filters.enabled !== undefined) {
      conditions.push(eq(businessRules.enabled, filters.enabled));
    }

    if (filters.resourceType) {
      conditions.push(
        sql`${businessRules.resourceTypes} @> ${JSON.stringify([filters.resourceType])}::jsonb`
      );
    }

    const rules = await db
      .select()
      .from(businessRules)
      .where(and(...conditions))
      .orderBy(desc(businessRules.createdAt));

    // Client-side search filter for name/description/expression
    let filtered = rules;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = rules.filter(
        (rule) =>
          rule.name.toLowerCase().includes(searchLower) ||
          rule.description.toLowerCase().includes(searchLower) ||
          rule.fhirPathExpression.toLowerCase().includes(searchLower)
      );
    }

    return filtered.map(this.mapToDTO);
  }

  /**
   * Get rule statistics
   */
  async getRuleStatistics() {
    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(businessRules)
      .where(isNull(businessRules.deletedAt));

    const enabled = await db
      .select({ count: sql<number>`count(*)` })
      .from(businessRules)
      .where(and(eq(businessRules.enabled, true), isNull(businessRules.deletedAt)));

    const byCategory = await db
      .select({
        category: businessRules.category,
        count: sql<number>`count(*)`,
      })
      .from(businessRules)
      .where(isNull(businessRules.deletedAt))
      .groupBy(businessRules.category);

    const bySeverity = await db
      .select({
        severity: businessRules.severity,
        count: sql<number>`count(*)`,
      })
      .from(businessRules)
      .where(isNull(businessRules.deletedAt))
      .groupBy(businessRules.severity);

    return {
      total: total[0]?.count || 0,
      enabled: enabled[0]?.count || 0,
      byCategory,
      bySeverity,
    };
  }

  /**
   * Increment semantic version
   */
  private incrementVersion(currentVersion: string, level: 'major' | 'minor' | 'patch' = 'minor'): string {
    const parts = currentVersion.split('.').map(Number);
    const [major, minor, patch] = parts;

    switch (level) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      default:
        return currentVersion;
    }
  }

  /**
   * Map database record to DTO
   */
  private mapToDTO(rule: BusinessRule): BusinessRuleDTO {
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      fhirPathExpression: rule.fhirPathExpression,
      resourceTypes: rule.resourceTypes as string[],
      severity: rule.severity as 'error' | 'warning' | 'info',
      enabled: rule.enabled,
      category: rule.category,
      version: rule.version,
      previousVersionId: rule.previousVersionId,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
      createdBy: rule.createdBy,
      updatedBy: rule.updatedBy,
      tags: rule.tags as string[] | undefined,
      metadata: rule.metadata as Record<string, any> | undefined,
    };
  }

  /**
   * Task 9.13: Export rules to JSON format
   */
  async exportRules(filters?: {
    category?: string;
    severity?: string;
    enabled?: boolean;
    resourceType?: string;
  }): Promise<{
    exportedAt: string;
    ruleCount: number;
    rules: BusinessRuleDTO[];
    metadata: {
      version: string;
      format: string;
    };
  }> {
    // Get filtered rules
    const rules = filters
      ? await this.searchRules(filters)
      : await this.getAllRules();

    return {
      exportedAt: new Date().toISOString(),
      ruleCount: rules.length,
      rules: rules.map((rule) => ({
        ...rule,
        // Remove system-specific fields for portability
        id: undefined as any,
        previousVersionId: undefined as any,
        createdAt: undefined as any,
        updatedAt: undefined as any,
        createdBy: undefined as any,
        updatedBy: undefined as any,
      })).filter((r) => r !== undefined),
      metadata: {
        version: '1.0.0',
        format: 'fhir-business-rules-export',
      },
    };
  }

  /**
   * Task 9.13: Import rules from JSON format
   */
  async importRules(
    importData: {
      rules: Partial<BusinessRuleDTO>[];
      metadata?: { version?: string; format?: string };
    },
    options: {
      skipDuplicates?: boolean;
      overwriteExisting?: boolean;
      userId?: string;
    } = {}
  ): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
    importedRules: BusinessRuleDTO[];
  }> {
    const { skipDuplicates = true, overwriteExisting = false, userId } = options;
    const errors: string[] = [];
    const importedRules: BusinessRuleDTO[] = [];
    let imported = 0;
    let skipped = 0;

    // Validate import format
    if (!importData.rules || !Array.isArray(importData.rules)) {
      errors.push('Invalid import format: rules array is required');
      return { imported, skipped, errors, importedRules };
    }

    // Process each rule
    for (let i = 0; i < importData.rules.length; i++) {
      const ruleData = importData.rules[i];

      try {
        // Validate required fields
        const requiredFields: (keyof BusinessRuleDTO)[] = [
          'name',
          'description',
          'fhirPathExpression',
          'resourceTypes',
        ];

        const missingFields = requiredFields.filter((field) => !ruleData[field]);

        if (missingFields.length > 0) {
          errors.push(
            `Rule ${i + 1} (${ruleData.name || 'unnamed'}): Missing fields: ${missingFields.join(', ')}`
          );
          skipped++;
          continue;
        }

        // Check for duplicate by name
        const existingRules = await this.searchRules({ search: ruleData.name! });
        const duplicate = existingRules.find((r) => r.name === ruleData.name);

        if (duplicate) {
          if (skipDuplicates && !overwriteExisting) {
            errors.push(`Rule ${i + 1} (${ruleData.name}): Skipped - duplicate name`);
            skipped++;
            continue;
          } else if (overwriteExisting) {
            // Update existing rule
            const updated = await this.updateRule(
              duplicate.id,
              {
                description: ruleData.description!,
                fhirPathExpression: ruleData.fhirPathExpression!,
                resourceTypes: ruleData.resourceTypes!,
                severity: ruleData.severity || duplicate.severity,
                category: ruleData.category || duplicate.category,
                enabled: ruleData.enabled !== undefined ? ruleData.enabled : duplicate.enabled,
                tags: ruleData.tags,
                metadata: ruleData.metadata,
              },
              userId
            );

            if (updated) {
              importedRules.push(updated);
              imported++;
            } else {
              errors.push(`Rule ${i + 1} (${ruleData.name}): Failed to update`);
              skipped++;
            }
            continue;
          }
        }

        // Create new rule
        const newRule = await this.createRule(
          {
            name: ruleData.name!,
            description: ruleData.description!,
            fhirPathExpression: ruleData.fhirPathExpression!,
            resourceTypes: ruleData.resourceTypes!,
            severity: (ruleData.severity as 'error' | 'warning' | 'info') || 'warning',
            enabled: ruleData.enabled !== undefined ? ruleData.enabled : true,
            category: ruleData.category || 'Custom',
            version: ruleData.version || '1.0.0',
            tags: ruleData.tags,
            metadata: ruleData.metadata,
          },
          userId
        );

        importedRules.push(newRule);
        imported++;

      } catch (error: any) {
        errors.push(
          `Rule ${i + 1} (${ruleData.name || 'unnamed'}): ${error.message}`
        );
        skipped++;
      }
    }

    return {
      imported,
      skipped,
      errors,
      importedRules,
    };
  }
}

/**
 * Singleton instance
 */
export const businessRulesService = new BusinessRulesService();

