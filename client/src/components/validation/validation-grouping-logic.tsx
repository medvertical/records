/**
 * Validation Grouping Logic
 * 
 * Provides utilities for grouping and organizing validation issues
 * by different criteria (category, severity, message, path).
 */

import { ValidationError } from '@shared/schema';

// ============================================================================
// Types
// ============================================================================

type GroupBy = 'category' | 'severity' | 'message' | 'path';

interface GroupedIssues {
  [key: string]: ValidationError[];
}

interface CategoryGroupedIssues {
  [category: string]: {
    [severity: string]: ValidationError[];
  };
}

interface AggregatedStats {
  totalIssues: number;
  severityBreakdown: {
    error: number;
    warning: number;
    information: number;
  };
  categoryBreakdown: {
    [category: string]: number;
  };
  resourcesAffected: Set<string>;
  topMessages: Array<{ message: string; count: number }>;
  topPaths: Array<{ path: string; count: number }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getCategoryInfo = (category: string) => {
  const categoryMap = {
    'structural': { name: 'Structural', color: 'purple', icon: '🔧' },
    'profile': { name: 'Profile', color: 'green', icon: '📋' },
    'terminology': { name: 'Terminology', color: 'blue', icon: '📚' },
    'reference': { name: 'Reference', color: 'orange', icon: '🔗' },
    'businessRule': { name: 'Business Rule', color: 'red', icon: '🛡️' },
    'metadata': { name: 'Metadata', color: 'gray', icon: '📄' }
  };
  
  return categoryMap[category as keyof typeof categoryMap] || { 
    name: 'Unknown', 
    color: 'gray', 
    icon: '❓' 
  };
};

// ============================================================================
// Grouping Functions
// ============================================================================

/**
 * Group issues by category and severity (traditional grouping)
 */
export function groupIssuesByCategoryAndSeverity(issues: ValidationError[]): CategoryGroupedIssues {
  return issues.reduce((groups, issue) => {
    const category = issue.category || 'unknown';
    const severity = issue.severity;
    
    if (!groups[category]) {
      groups[category] = {};
    }
    if (!groups[category][severity]) {
      groups[category][severity] = [];
    }
    
    groups[category][severity].push(issue);
    return groups;
  }, {} as CategoryGroupedIssues);
}

/**
 * Get group key for advanced grouping
 */
export function getGroupKey(issue: ValidationError, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'message':
      // Group by similar error messages (normalized)
      return issue.message.toLowerCase()
        .replace(/\d+/g, 'N') // Replace numbers with N
        .replace(/['"]/g, '') // Remove quotes
        .substring(0, 50); // Limit length
    case 'path':
      // Group by path pattern
      return issue.path.split('.').slice(0, -1).join('.') || 'root';
    case 'severity':
      return issue.severity;
    case 'category':
    default:
      return issue.category || 'structural';
  }
}

/**
 * Group issues by a specific criteria
 */
export function groupIssuesBy(issues: ValidationError[], groupBy: GroupBy): GroupedIssues {
  return issues.reduce((groups, issue) => {
    const key = getGroupKey(issue, groupBy);
    
    if (!groups[key]) {
      groups[key] = [];
    }
    
    groups[key].push(issue);
    return groups;
  }, {} as GroupedIssues);
}

/**
 * Filter issues based on search query
 */
export function filterIssuesBySearch(issues: ValidationError[], searchQuery: string): ValidationError[] {
  if (!searchQuery) return issues;
  
  const query = searchQuery.toLowerCase();
  
  return issues.filter(issue => 
    issue.message.toLowerCase().includes(query) ||
    (issue.code && issue.code.toLowerCase().includes(query)) ||
    issue.path.toLowerCase().includes(query) ||
    (issue.expression && issue.expression.toLowerCase().includes(query))
  );
}

/**
 * Filter issues by category and severity
 */
export function filterIssuesByCategoryAndSeverity(
  issues: ValidationError[], 
  selectedCategory: string, 
  selectedSeverity: string
): ValidationError[] {
  return issues.filter(issue => {
    const categoryMatch = selectedCategory === 'all' || issue.category === selectedCategory;
    const severityMatch = selectedSeverity === 'all' || issue.severity === selectedSeverity;
    return categoryMatch && severityMatch;
  });
}

// ============================================================================
// Aggregation Functions
// ============================================================================

/**
 * Calculate aggregated statistics for validation issues
 */
export function calculateAggregatedStats(issues: ValidationError[]): AggregatedStats {
  const severityBreakdown = {
    error: 0,
    warning: 0,
    information: 0
  };
  
  const categoryBreakdown: { [category: string]: number } = {};
  const resourcesAffected = new Set<string>();
  const messageCounts: { [message: string]: number } = {};
  const pathCounts: { [path: string]: number } = {};
  
  issues.forEach(issue => {
    // Severity breakdown
    severityBreakdown[issue.severity as keyof typeof severityBreakdown]++;
    
    // Category breakdown
    const category = issue.category || 'unknown';
    categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
    
    // Resources affected
    if (issue.resourceId) {
      resourcesAffected.add(issue.resourceId);
    }
    
    // Message counts
    const normalizedMessage = issue.message.toLowerCase()
      .replace(/\d+/g, 'N')
      .replace(/['"]/g, '')
      .substring(0, 50);
    messageCounts[normalizedMessage] = (messageCounts[normalizedMessage] || 0) + 1;
    
    // Path counts
    const path = issue.path.split('.').slice(0, -1).join('.') || 'root';
    pathCounts[path] = (pathCounts[path] || 0) + 1;
  });
  
  // Get top messages
  const topMessages = Object.entries(messageCounts)
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  // Get top paths
  const topPaths = Object.entries(pathCounts)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return {
    totalIssues: issues.length,
    severityBreakdown,
    categoryBreakdown,
    resourcesAffected,
    topMessages,
    topPaths
  };
}

/**
 * Get quick fixes based on common error patterns
 */
export function getQuickFixes(issues: ValidationError[]): string[] {
  const fixes: string[] = [];
  
  issues.forEach(issue => {
    if (issue.message.toLowerCase().includes('missing') && 
        issue.message.toLowerCase().includes('required')) {
      const field = issue.path?.split('.').pop() || 'field';
      fixes.push(`Add required field: ${field}`);
    }
    
    if (issue.message.toLowerCase().includes('invalid') && 
        issue.message.toLowerCase().includes('format')) {
      const field = issue.path?.split('.').pop() || 'field';
      fixes.push(`Fix format for: ${field}`);
    }
    
    if (issue.message.toLowerCase().includes('reference') && 
        issue.message.toLowerCase().includes('not found')) {
      fixes.push('Fix broken resource references');
    }
    
    if (issue.message.toLowerCase().includes('terminology') && 
        issue.message.toLowerCase().includes('invalid')) {
      fixes.push('Update terminology codes');
    }
  });
  
  return [...new Set(fixes)]; // Remove duplicates
}

// ============================================================================
// Export Helper Functions
// ============================================================================

export { getCategoryInfo };
