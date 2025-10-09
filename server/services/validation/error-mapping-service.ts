/**
 * Error Mapping Service
 * 
 * This service maps technical FHIR validation error codes to human-readable,
 * friendly messages in multiple languages. It loads mappings from a JSON
 * configuration file and provides lookup functionality.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface ErrorMapping {
  friendlyText: string;
  friendlyText_en?: string;
  category: 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata';
  severity: 'error' | 'warning' | 'info';
  suggestions?: string[];
}

export interface ErrorMapConfig {
  version: string;
  lastUpdated: string;
  description: string;
  mappings: Record<string, ErrorMapping>;
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'information';
  code: string;
  message: string;
  path?: string;
  expression?: string;
  category?: string;
}

export interface MappedIssue extends ValidationIssue {
  originalMessage: string;
  mappedMessage: string;
  suggestions: string[];
  hasMappedMessage: boolean;
}

// ============================================================================
// Error Mapping Service
// ============================================================================

export class ErrorMappingService {
  private mappings: Map<string, ErrorMapping> = new Map();
  private configPath: string;
  private language: 'de' | 'en' = 'de'; // Default to German
  private isLoaded: boolean = false;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'server', 'config', 'error_map.json');
  }

  /**
   * Load error mappings from JSON configuration file
   */
  loadMappings(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        logger.warn(`[ErrorMappingService] Config file not found: ${this.configPath}`);
        logger.warn('[ErrorMappingService] Using fallback mode without custom mappings');
        return;
      }

      const fileContent = fs.readFileSync(this.configPath, 'utf-8');
      const config: ErrorMapConfig = JSON.parse(fileContent);

      logger.info(`[ErrorMappingService] Loading error mappings version ${config.version}`);

      for (const [code, mapping] of Object.entries(config.mappings)) {
        this.mappings.set(code, mapping);
      }

      this.isLoaded = true;
      logger.info(`[ErrorMappingService] Loaded ${this.mappings.size} error mappings`);
    } catch (error: any) {
      logger.error('[ErrorMappingService] Failed to load error mappings:', error);
      logger.warn('[ErrorMappingService] Continuing with fallback mode');
    }
  }

  /**
   * Set the language for friendly messages
   * @param lang - Language code ('de' or 'en')
   */
  setLanguage(lang: 'de' | 'en'): void {
    this.language = lang;
    logger.info(`[ErrorMappingService] Language set to: ${lang}`);
  }

  /**
   * Get the current language
   */
  getLanguage(): 'de' | 'en' {
    return this.language;
  }

  /**
   * Map a validation issue to include friendly message
   * @param issue - Original validation issue
   * @returns Mapped issue with friendly text and suggestions
   */
  mapIssue(issue: ValidationIssue): MappedIssue {
    // Try to find exact match first
    let mapping = this.mappings.get(issue.code);

    // If no exact match, try pattern matching on message
    if (!mapping) {
      mapping = this.findMappingByMessage(issue.message);
    }

    if (mapping) {
      const friendlyText = this.language === 'en' && mapping.friendlyText_en 
        ? mapping.friendlyText_en 
        : mapping.friendlyText;

      return {
        ...issue,
        originalMessage: issue.message,
        mappedMessage: friendlyText,
        suggestions: mapping.suggestions || [],
        hasMappedMessage: true,
        category: mapping.category
      };
    }

    // No mapping found - return original
    return {
      ...issue,
      originalMessage: issue.message,
      mappedMessage: issue.message,
      suggestions: [],
      hasMappedMessage: false
    };
  }

  /**
   * Find mapping by matching message content
   * @param message - Original error message
   * @returns Found mapping or undefined
   */
  private findMappingByMessage(message: string): ErrorMapping | undefined {
    const lowerMessage = message.toLowerCase();

    // Common pattern mappings
    const patterns: Array<[string, string]> = [
      ['profile.*not.*found', 'profile-not-found'],
      ['reference.*not.*found', 'invalid-reference'],
      ['reference.*resolve', 'invalid-reference'],
      ['required.*missing', 'required-element-missing'],
      ['cardinality', 'cardinality-violation'],
      ['code.*not.*found.*valueset', 'terminology-check-failed'],
      ['unknown.*code.*system', 'invalid-code-system'],
      ['extension.*not.*allowed', 'extension-not-allowed'],
      ['slice.*not.*match', 'slice-not-matching'],
      ['metadata.*missing', 'metadata-incomplete'],
      ['circular.*reference', 'circular-reference'],
      ['version.*mismatch', 'version-mismatch'],
      ['unknown.*element', 'unknown-element'],
      ['binding.*strength', 'binding-strength-violation'],
      ['data.*type.*invalid', 'invalid-data-type'],
      ['business.*rule', 'business-rule-violation']
    ];

    for (const [pattern, code] of patterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(lowerMessage)) {
        const mapping = this.mappings.get(code);
        if (mapping) {
          logger.debug(`[ErrorMappingService] Pattern match: "${message}" → ${code}`);
          return mapping;
        }
      }
    }

    return undefined;
  }

  /**
   * Get friendly message for a specific error code
   * @param code - Error code
   * @returns Friendly message or the code itself if no mapping exists
   */
  getFriendlyMessage(code: string): string {
    const mapping = this.mappings.get(code);
    
    if (mapping) {
      return this.language === 'en' && mapping.friendlyText_en 
        ? mapping.friendlyText_en 
        : mapping.friendlyText;
    }

    return code;
  }

  /**
   * Get suggestions for a specific error code
   * @param code - Error code
   * @returns Array of suggestions
   */
  getSuggestions(code: string): string[] {
    const mapping = this.mappings.get(code);
    return mapping?.suggestions || [];
  }

  /**
   * Get all available error codes
   * @returns Array of error codes
   */
  getAllCodes(): string[] {
    return Array.from(this.mappings.keys());
  }

  /**
   * Get mapping count
   * @returns Number of loaded mappings
   */
  getMappingCount(): number {
    return this.mappings.size;
  }

  /**
   * Check if mappings are loaded
   * @returns True if mappings are loaded
   */
  isLoaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Reload mappings from file
   */
  reload(): void {
    this.mappings.clear();
    this.isLoaded = false;
    this.loadMappings();
  }

  /**
   * Get mapping statistics
   * @returns Statistics about loaded mappings
   */
  getStatistics(): {
    totalMappings: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    withSuggestions: number;
  } {
    const stats = {
      totalMappings: this.mappings.size,
      byCategory: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      withSuggestions: 0
    };

    for (const mapping of this.mappings.values()) {
      // Count by category
      stats.byCategory[mapping.category] = (stats.byCategory[mapping.category] || 0) + 1;
      
      // Count by severity
      stats.bySeverity[mapping.severity] = (stats.bySeverity[mapping.severity] || 0) + 1;
      
      // Count with suggestions
      if (mapping.suggestions && mapping.suggestions.length > 0) {
        stats.withSuggestions++;
      }
    }

    return stats;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let errorMappingServiceInstance: ErrorMappingService | null = null;

/**
 * Get or create the singleton Error Mapping Service instance
 */
export function getErrorMappingService(): ErrorMappingService {
  if (!errorMappingServiceInstance) {
    errorMappingServiceInstance = new ErrorMappingService();
    errorMappingServiceInstance.loadMappings();
  }
  return errorMappingServiceInstance;
}

/**
 * Initialize Error Mapping Service with custom config path
 */
export function initErrorMappingService(configPath: string): ErrorMappingService {
  errorMappingServiceInstance = new ErrorMappingService(configPath);
  errorMappingServiceInstance.loadMappings();
  return errorMappingServiceInstance;
}

// Export default instance getter
export default getErrorMappingService;

