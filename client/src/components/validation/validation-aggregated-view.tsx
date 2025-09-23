import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Filter, 
  Download, 
  Lightbulb,
  AlertCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { ValidationError } from '@shared/schema';
import { calculateAggregatedStats, getQuickFixes, getCategoryInfo } from './validation-grouping-logic';

// ============================================================================
// Types
// ============================================================================

interface ValidationAggregatedViewProps {
  issues: ValidationError[];
  onExport?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function ValidationAggregatedView({ issues, onExport }: ValidationAggregatedViewProps) {
  const stats = calculateAggregatedStats(issues);
  const quickFixes = getQuickFixes(issues);
  
  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Validation Error Summary
          </h3>
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="text-xs"
            >
              <Download className="h-4 w-4 mr-1" />
              Export Report
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.totalIssues}</div>
            <div className="text-sm text-gray-600">Total Issues</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.severityBreakdown.error || 0}</div>
            <div className="text-sm text-gray-600">Errors</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.severityBreakdown.warning || 0}</div>
            <div className="text-sm text-gray-600">Warnings</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.resourcesAffected.size}</div>
            <div className="text-sm text-gray-600">Resources Affected</div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-3">Issues by Category</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(stats.categoryBreakdown).map(([category, count]) => {
              const categoryInfo = getCategoryInfo(category);
              return (
                <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{categoryInfo.icon}</span>
                    <span className="text-sm font-medium">{categoryInfo.name}</span>
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Messages */}
        {stats.topMessages.length > 0 && (
          <div className="mb-6">
            <h4 className="font-medium text-gray-700 mb-3">Most Common Error Messages</h4>
            <div className="space-y-2">
              {stats.topMessages.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700 flex-1 mr-3">{item.message}</span>
                  <Badge variant="outline">{item.count} occurrences</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Paths */}
        {stats.topPaths.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-3">Most Problematic Paths</h4>
            <div className="space-y-2">
              {stats.topPaths.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <code className="text-sm text-gray-700 flex-1 mr-3 font-mono">{item.path}</code>
                  <Badge variant="outline">{item.count} issues</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Fixes */}
      {quickFixes.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-blue-600" />
            <h4 className="font-medium text-blue-800">Suggested Quick Fixes</h4>
          </div>
          <div className="space-y-2">
            {quickFixes.map((fix, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-blue-700">
                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                {fix}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Severity Breakdown Chart */}
      <div className="bg-white border rounded-lg p-6">
        <h4 className="font-medium text-gray-700 mb-4">Severity Distribution</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Errors</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full" 
                  style={{ 
                    width: `${stats.totalIssues > 0 ? (stats.severityBreakdown.error / stats.totalIssues) * 100 : 0}%` 
                  }}
                ></div>
              </div>
              <span className="text-sm text-gray-600 w-8">{stats.severityBreakdown.error}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Warnings</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-yellow-500 h-2 rounded-full" 
                  style={{ 
                    width: `${stats.totalIssues > 0 ? (stats.severityBreakdown.warning / stats.totalIssues) * 100 : 0}%` 
                  }}
                ></div>
              </div>
              <span className="text-sm text-gray-600 w-8">{stats.severityBreakdown.warning}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Information</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ 
                    width: `${stats.totalIssues > 0 ? (stats.severityBreakdown.information / stats.totalIssues) * 100 : 0}%` 
                  }}
                ></div>
              </div>
              <span className="text-sm text-gray-600 w-8">{stats.severityBreakdown.information}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Distribution */}
      <div className="bg-white border rounded-lg p-6">
        <h4 className="font-medium text-gray-700 mb-4">Category Distribution</h4>
        <div className="space-y-3">
          {Object.entries(stats.categoryBreakdown)
            .sort(([,a], [,b]) => b - a)
            .map(([category, count]) => {
              const categoryInfo = getCategoryInfo(category);
              const percentage = (count / stats.totalIssues) * 100;
              
              return (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{categoryInfo.icon}</span>
                    <span className="text-sm font-medium">{categoryInfo.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`bg-${categoryInfo.color}-500 h-2 rounded-full`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 w-8">{count}</span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
