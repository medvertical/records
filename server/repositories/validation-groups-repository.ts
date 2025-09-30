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
  // Get all validation results for this resource
  const results = await db
    .select()
    .from(validationResultsPerAspect)
    .where(
      and(
        eq(validationResultsPerAspect.serverId, serverId),
        eq(validationResultsPerAspect.resourceType, resourceType),
        eq(validationResultsPerAspect.fhirId, fhirId)
      )
    );
  
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

export const ValidationGroupsRepository = {
  getValidationGroups,
  getGroupMembers,
  getResourceMessages,
};
