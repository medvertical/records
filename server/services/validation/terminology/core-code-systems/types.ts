/**
 * Core Code Systems - Shared Types
 */

export interface CoreCodeDefinition {
  code: string;
  display: string;
  definition?: string;
}

export type CoreCodeSystemMap = Record<string, CoreCodeDefinition[]>;

