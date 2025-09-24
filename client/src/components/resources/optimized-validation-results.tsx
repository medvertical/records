import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, 
  AlertCircle, 
  AlertTriangle, 
  Info,
  CheckCircle,
  Code,
  FileCheck,
  BookOpen,
  Link,
  Shield,
  FileText,
  Eye,
  EyeOff
} from 'lucide-react';
import { ValidationIssueList } from './validation-issue-components';
import { ValidationSummaryBadge } from './validation-summary-badge';

// ============================================================================
// Types
// ============================================================================

interface ValidationIssue {
  id?: string;
  code?: string;
  message?: string;
  category?: string;
  severity?: string;
  path?: string;
  location?: string[];
  humanReadable?: string;
}

interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  summary: {
    totalIssues: number;
    errorCount: number;
    warningCount: number;
    informationCount: number;
    score: number;
  };
  performance?: {
    totalTimeMs: number;
    aspectTimes: Record<string, number>;
  };
}

interface OptimizedValidationResultsProps {
  result: ValidationResult;
  onRevalidate: () => void;
  isValidating: boolean;
  selectedCategory?: string;
  selectedSeverity?: string;
  selectedPath?: string;
  highlightedIssueId?: string | null;
  onClearFilters: () => void;
  onNavigateToPath: (path: string) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getCategoryIcon = (category: string) => {
  const iconMap = {
    'structural': Code,
    'profile': FileCheck,
    'terminology': BookOpen,
    'reference': Link,
    'business-rule': Shield,
    'metadata': FileText,
    'general': AlertCircle
  };
  
  const IconComponent = iconMap[category as keyof typeof iconMap] || AlertCircle;
  return <IconComponent className="h-3 w-3" />;
};

const getSeverityIcon = (severity: string) => {
  const iconMap = {
    'error': AlertCircle,
    'warning': AlertTriangle,
    'information': Info
  };
  
  const IconComponent = iconMap[severity as keyof typeof iconMap] || Info;
  return <IconComponent className="h-3 w-3" />;
};

// ============================================================================
// Component
// ============================================================================

export function OptimizedValidationResults({
  result,
  onRevalidate,
  isValidating,
  selectedCategory,
  selectedSeverity,
  selectedPath,
  highlightedIssueId,
  onClearFilters,
  onNavigateToPath
}: OptimizedValidationResultsProps) {
  const [humanReadableMode, setHumanReadableMode] = useState(false);
  
  // Memoized filtered issues
  const filteredIssues = useMemo(() => {
    return (result.issues || []).filter(issue => {
      if (selectedCategory && selectedCategory !== 'all' && issue.category !== selectedCategory) {
        return false;
      }
      if (selectedSeverity && selectedSeverity !== 'all' && issue.severity !== selectedSeverity) {
        return false;
      }
      if (selectedPath && issue.path !== selectedPath) {
        return false;
      }
      return true;
    });
  }, [(result.issues || []), selectedCategory, selectedSeverity, selectedPath]);
  
  // Memoized category counts
  const categoryCounts = useMemo(() => {
    return (result.issues || []).reduce((acc: any, issue: any) => {
      const category = issue.category || 'general';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
  }, [(result.issues || [])]);
  
  // Memoized severity counts
  const severityCounts = useMemo(() => {
    return (result.issues || []).reduce((acc: any, issue: any) => {
      const severity = issue.severity || 'information';
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    }, {});
  }, [(result.issues || [])]);
  
  const categories = [
    { value: 'all', label: 'All', count: (result.issues || []).length },
    { value: 'structural', label: 'Structural', count: categoryCounts.structural || 0 },
    { value: 'profile', label: 'Profile', count: categoryCounts.profile || 0 },
    { value: 'terminology', label: 'Terminology', count: categoryCounts.terminology || 0 },
    { value: 'reference', label: 'Reference', count: categoryCounts.reference || 0 },
    { value: 'business-rule', label: 'Business Rule', count: categoryCounts['business-rule'] || 0 },
    { value: 'metadata', label: 'Metadata', count: categoryCounts.metadata || 0 },
    { value: 'general', label: 'General', count: categoryCounts.general || 0 }
  ].filter(cat => cat.value === 'all' || cat.count > 0);
  
  const severities = [
    { value: 'all', label: 'All', count: (result.issues || []).length },
    { value: 'error', label: 'Errors', count: severityCounts.error || 0 },
    { value: 'warning', label: 'Warnings', count: severityCounts.warning || 0 },
    { value: 'information', label: 'Information', count: severityCounts.information || 0 }
  ].filter(sev => sev.value === 'all' || sev.count > 0);
  
  return (
    <div className="space-y-4">
      {/* Summary Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ValidationSummaryBadge result={result} />
            {result.performance && (
              <Badge variant="outline" className="text-xs">
                {result.performance.totalTimeMs}ms
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Label htmlFor="human-readable" className="text-xs">
              Plain language
            </Label>
            <Switch
              id="human-readable"
              checked={humanReadableMode}
              onCheckedChange={setHumanReadableMode}
            />
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Validation Score</span>
            <span>{result.summary.score}%</span>
          </div>
          <Progress 
            value={result.summary.score} 
            className="h-2"
          />
        </div>
      </div>
      
      {/* Filters */}
      {(result.issues || []).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Filter Issues</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-xs"
            >
              Clear Filters
            </Button>
          </div>
          
          {/* Severity Filters */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-600">By Severity</Label>
            <div className="flex flex-wrap gap-1">
              {severities.map(sev => (
                <button
                  key={sev.value}
                  className={`px-2 py-1 text-xs rounded-full border transition-colors flex items-center gap-1 ${
                    selectedSeverity === sev.value
                      ? sev.value === 'error' ? 'bg-red-500 text-white border-red-500' :
                        sev.value === 'warning' ? 'bg-yellow-500 text-white border-yellow-500' :
                        sev.value === 'information' ? 'bg-blue-500 text-white border-blue-500' :
                        'bg-gray-600 text-white border-gray-600'
                      : sev.value === 'error' ? 'bg-white text-red-600 border-red-300 hover:border-red-400' :
                        sev.value === 'warning' ? 'bg-white text-yellow-600 border-yellow-300 hover:border-yellow-400' :
                        sev.value === 'information' ? 'bg-white text-blue-600 border-blue-300 hover:border-blue-400' :
                        'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {sev.value !== 'all' && getSeverityIcon(sev.value)}
                  {sev.label} ({sev.count})
                </button>
              ))}
            </div>
          </div>
          
          {/* Category Filters */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-600">By Category</Label>
            <div className="flex flex-wrap gap-1">
              {categories.map(cat => (
                <button
                  key={cat.value}
                  className={`px-2 py-1 text-xs rounded-full border transition-colors flex items-center gap-1 ${
                    selectedCategory === cat.value
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {cat.value !== 'all' && getCategoryIcon(cat.value)}
                  {cat.label} ({cat.count})
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Issues List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">
            Issues ({filteredIssues.length})
          </h4>
          <Button
            variant="outline"
            size="sm"
            onClick={onRevalidate}
            disabled={isValidating}
            className="text-xs"
          >
            {isValidating ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Revalidate
              </>
            )}
          </Button>
        </div>
        
        <ValidationIssueList
          issues={filteredIssues}
          selectedCategory={selectedCategory}
          selectedSeverity={selectedSeverity}
          selectedPath={selectedPath}
          highlightedIssueId={highlightedIssueId}
          humanReadableMode={humanReadableMode}
          onNavigateToPath={onNavigateToPath}
        />
      </div>
      
      {/* Performance Metrics */}
      {result.performance && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h5 className="text-xs font-medium text-gray-600 mb-2">Performance</h5>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Total Time: {result.performance.totalTimeMs}ms</div>
            {Object.entries(result.performance.aspectTimes).map(([aspect, time]) => (
              <div key={aspect}>
                {aspect}: {time}ms
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
