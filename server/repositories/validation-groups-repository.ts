import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { 
  validationMessageGroups, 
  validationMessages,
  validationResultsPerAspect 
} from '../../shared/schema-validation-per-aspect';
import { eq, and, sql, desc, asc, inArray, SQL } from 'drizzle-orm';
import type { ValidationMessageGroupDTO } from '../../shared/validation-types';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

export interface GroupsQueryFilters {
  serverId: number;
  aspect?: string;
  severity?: string;
  code?: string;
  path?: string;
  resourceType?: string;
}

export interface GroupsQueryOptions {
  page?: number;
  size?: number;
  sort?: 'count:desc' | 'count:asc' | 'severity:desc' | 'severity:asc';
}

/**
 * Get validation message groups with filtering and pagination
 */
export async function getValidationGroups(
  filters: GroupsQueryFilters,
  options: GroupsQueryOptions = {}
): Promise<{ groups: ValidationMessageGroupDTO[]; total: number }> {
  const { page = 1, size = 25, sort = 'count:desc' } = options;
  const offset = (page - 1) * size;
  
  // Build WHERE clause
  const conditions: SQL[] = [eq(validationMessageGroups.serverId, filters.serverId)];
  
  if (filters.aspect) {
    conditions.push(eq(validationMessageGroups.aspect, filters.aspect));
  }
  
  if (filters.severity) {
    conditions.push(eq(validationMessageGroups.severity, filters.severity));
  }
  
  if (filters.code) {
    conditions.push(eq(validationMessageGroups.code, filters.code));
  }
  
  if (filters.path) {
    conditions.push(sql`${validationMessageGroups.canonicalPath} LIKE ${`%${filters.path}%`}`);
  }
  
  // Build ORDER BY clause
  let orderBy;
  switch (sort) {
    case 'count:asc':
      orderBy = asc(validationMessageGroups.totalResources);
      break;
    case 'severity:desc':
      orderBy = desc(validationMessageGroups.severity);
      break;
    case 'severity:asc':
      orderBy = asc(validationMessageGroups.severity);
      break;
    case 'count:desc':
    default:
      orderBy = desc(validationMessageGroups.totalResources);
      break;
  }
  
  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(validationMessageGroups)
    .where(and(...conditions));
  
  const total = Number(countResult?.count || 0);
  
  // Get groups
  const groups = await db
    .select()
    .from(validationMessageGroups)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(size)
    .offset(offset);
  
  // Map to DTOs
  const groupDTOs: ValidationMessageGroupDTO[] = groups.map(group => ({
    signature: group.signature,
    aspect: group.aspect as any,
    severity: group.severity as any,
    code: group.code || undefined,
    canonicalPath: group.canonicalPath,
    sampleMessage: group.sampleText,
    totalResources: group.totalResources,
    firstSeenAt: group.firstSeenAt,
    lastSeenAt: group.lastSeenAt,
  }));
  
  return { groups: groupDTOs, total };
}

/**
 * Get resources for a specific message group (by signature)
 */
export async function getGroupMembers(
  serverId: number,
  signature: string,
  options: {
    resourceType?: string;
    page?: number;
    size?: number;
    sort?: 'validatedAt:desc' | 'validatedAt:asc';
  } = {}
): Promise<{ members: any[]; total: number }> {
  const { page = 1, size = 25, sort = 'validatedAt:desc', resourceType } = options;
  const offset = (page - 1) * size;
  
  // Build query conditions
  const conditions: SQL[] = [
    eq(validationMessages.serverId, serverId),
    eq(validationMessages.signature, signature),
  ];
  
  if (resourceType) {
    conditions.push(eq(validationMessages.resourceType, resourceType));
  }
  
  // Get distinct resources (a resource may have multiple messages with same signature)
  const query = db
    .selectDistinct({
      resourceType: validationMessages.resourceType,
      fhirId: validationMessages.fhirId,
      validatedAt: validationMessages.createdAt,
    })
    .from(validationMessages)
    .where(and(...conditions));
  
  // Get total count
  const countQuery = db
    .select({ count: sql<number>`count(DISTINCT ${validationMessages.resourceType}, ${validationMessages.fhirId})` })
    .from(validationMessages)
    .where(and(...conditions));
  
  const [countResult] = await countQuery;
  const total = Number(countResult?.count || 0);
  
  // Apply sorting
  const orderBy = sort === 'validatedAt:asc' 
    ? asc(validationMessages.createdAt)
    : desc(validationMessages.createdAt);
  
  // Get members with pagination
  const members = await query
    .orderBy(orderBy)
    .limit(size)
    .offset(offset);
  
  // For each member, get their per-aspect validation summary
  const membersWithAspects = await Promise.all(
    members.map(async (member) => {
      const aspects = await db
        .select({
          aspect: validationResultsPerAspect.aspect,
          isValid: validationResultsPerAspect.isValid,
          errorCount: validationResultsPerAspect.errorCount,
          warningCount: validationResultsPerAspect.warningCount,
          informationCount: validationResultsPerAspect.informationCount,
        })
        .from(validationResultsPerAspect)
        .where(
          and(
            eq(validationResultsPerAspect.serverId, serverId),
            eq(validationResultsPerAspect.resourceType, member.resourceType),
            eq(validationResultsPerAspect.fhirId, member.fhirId)
          )
        );
      
      return {
        resourceType: member.resourceType,
        fhirId: member.fhirId,
        validatedAt: member.validatedAt,
        perAspect: aspects.map(a => ({
          aspect: a.aspect,
          isValid: a.isValid,
          errorCount: a.errorCount,
          warningCount: a.warningCount,
          informationCount: a.informationCount,
        })),
      };
    })
  );
  
  return { members: membersWithAspects, total };
}

/**
 * Get all messages for a specific resource
 */
export async function getResourceMessages(
  serverId: number,
  resourceType: string,
  fhirId: string
): Promise<any> {
  console.log(`[getResourceMessages] Querying for serverId=${serverId}, resourceType=${resourceType}, fhirId=${fhirId}`);
  
  // Get all validation results for this resource
  const allResults = await db
    .select({
      id: validationResultsPerAspect.id,
      aspect: validationResultsPerAspect.aspect,
      isValid: validationResultsPerAspect.isValid,
      errorCount: validationResultsPerAspect.errorCount,
      warningCount: validationResultsPerAspect.warningCount,
      informationCount: validationResultsPerAspect.informationCount,
      score: validationResultsPerAspect.score,
      validatedAt: validationResultsPerAspect.validatedAt,
    })
    .from(validationResultsPerAspect)
    .where(
      and(
        eq(validationResultsPerAspect.serverId, serverId),
        eq(validationResultsPerAspect.resourceType, resourceType),
        eq(validationResultsPerAspect.fhirId, fhirId)
      )
    );
  
  console.log(`[getResourceMessages] Found ${allResults.length} validation result records for ${resourceType}/${fhirId}`);
  
  // Normalize aspect names (handle businessRule vs businessRules inconsistency)
  const normalizeAspect = (aspect: string): string => {
    return aspect === 'businessRules' ? 'businessRule' : aspect;
  };
  
  // Keep only the latest result for each aspect (by validatedAt timestamp)
  const latestByAspect = new Map<string, typeof allResults[0]>();
  for (const result of allResults) {
    const normalizedAspect = normalizeAspect(result.aspect);
    const existing = latestByAspect.get(normalizedAspect);
    if (!existing || new Date(result.validatedAt) > new Date(existing.validatedAt)) {
      latestByAspect.set(normalizedAspect, result);
    }
  }
  
  const results = Array.from(latestByAspect.values());
  console.log(`[getResourceMessages] Filtered to ${results.length} latest validation results (one per aspect)`);
  
  // For each result, get its messages
  const aspects = await Promise.all(
    results.map(async (result) => {
      const messages = await db
        .select({
          id: validationMessages.id,
          severity: validationMessages.severity,
          code: validationMessages.code,
          canonicalPath: validationMessages.canonicalPath,
          text: validationMessages.text,
          signature: validationMessages.signature,
          createdAt: validationMessages.createdAt,
        })
        .from(validationMessages)
        .where(eq(validationMessages.validationResultId, result.id));
      
      return {
        aspect: result.aspect,
        isValid: result.isValid,
        errorCount: result.errorCount,
        warningCount: result.warningCount,
        informationCount: result.informationCount,
        score: result.score,
        validatedAt: result.validatedAt,
        messages: messages.map(msg => ({
          id: msg.id,
          severity: msg.severity,
          code: msg.code || undefined,
          canonicalPath: msg.canonicalPath,
          text: msg.text,
          signature: msg.signature,
          createdAt: msg.createdAt,
        })),
      };
    })
  );
  
  return {
    serverId,
    resourceType,
    fhirId,
    aspects,
  };
}

/**
 * Get aggregated validation summary for a resource from per-aspect tables
 * This is used for resource list enhancement to show validation status
 */
export async function getResourceValidationSummary(
  serverId: number,
  resourceType: string,
  fhirId: string
): Promise<{
  isValid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  errorCount: number;
  warningCount: number;
  informationCount: number;
  validationScore: number;
  lastValidated: Date | null;
  aspectBreakdown: Record<string, {
    isValid: boolean;
    errorCount: number;
    warningCount: number;
    informationCount: number;
    score: number;
  }>;
} | null> {
  console.log(`[getResourceValidationSummary] Querying for serverId=${serverId}, resourceType=${resourceType}, fhirId=${fhirId}`);
  
  // Get all validation results for this resource
  const results = await db
    .select({
      aspect: validationResultsPerAspect.aspect,
      isValid: validationResultsPerAspect.isValid,
      errorCount: validationResultsPerAspect.errorCount,
      warningCount: validationResultsPerAspect.warningCount,
      informationCount: validationResultsPerAspect.informationCount,
      score: validationResultsPerAspect.score,
      validatedAt: validationResultsPerAspect.validatedAt,
    })
    .from(validationResultsPerAspect)
    .where(
      and(
        eq(validationResultsPerAspect.serverId, serverId),
        eq(validationResultsPerAspect.resourceType, resourceType),
        eq(validationResultsPerAspect.fhirId, fhirId)
      )
    )
    .orderBy(desc(validationResultsPerAspect.validatedAt));
  
  console.log(`[getResourceValidationSummary] Found ${results.length} validation results for ${resourceType}/${fhirId}`);
  
  if (results.length === 0) {
    console.log(`[getResourceValidationSummary] No validation data found for ${resourceType}/${fhirId}`);
    return null;
  }
  
  // Aggregate counts across all aspects
  // Note: Results are ordered by validatedAt DESC, so we get most recent first
  // We should only use the FIRST (most recent) result for each aspect
  let totalErrorCount = 0;
  let totalWarningCount = 0;
  let totalInformationCount = 0;
  let latestValidatedAt: Date | null = null;
  const aspectBreakdown: Record<string, any> = {};
  const seenAspects = new Set<string>();
  
  for (const result of results) {
    // Skip if we've already processed this aspect (we want the most recent one)
    if (seenAspects.has(result.aspect)) {
      console.log(`[getResourceValidationSummary] Skipping duplicate aspect ${result.aspect} (keeping most recent)`);
      continue;
    }
    seenAspects.add(result.aspect);
    
    totalErrorCount += result.errorCount || 0;
    totalWarningCount += result.warningCount || 0;
    totalInformationCount += result.informationCount || 0;
    
    if (!latestValidatedAt || (result.validatedAt && new Date(result.validatedAt) > latestValidatedAt)) {
      latestValidatedAt = result.validatedAt ? new Date(result.validatedAt) : null;
    }
    
    aspectBreakdown[result.aspect] = {
      isValid: result.isValid || false,
      errorCount: result.errorCount || 0,
      warningCount: result.warningCount || 0,
      informationCount: result.informationCount || 0,
      score: result.score || 0,
    };
  }
  
  // Calculate overall validation score
  // Start at 100 and deduct points for issues
  let validationScore = 100;
  validationScore -= totalErrorCount * 15;  // Error issues: -15 points each
  validationScore -= totalWarningCount * 5; // Warning issues: -5 points each
  validationScore -= totalInformationCount * 1; // Information issues: -1 point each
  validationScore = Math.max(0, Math.round(validationScore));
  
  return {
    isValid: totalErrorCount === 0,
    hasErrors: totalErrorCount > 0,
    hasWarnings: totalWarningCount > 0,
    errorCount: totalErrorCount,
    warningCount: totalWarningCount,
    informationCount: totalInformationCount,
    validationScore,
    lastValidated: latestValidatedAt,
    aspectBreakdown,
  };
}

export const ValidationGroupsRepository = {
  getValidationGroups,
  getGroupMembers,
  getResourceMessages,
  getResourceValidationSummary,
};
