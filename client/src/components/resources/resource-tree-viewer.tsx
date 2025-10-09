import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, 
  ChevronRight, 
  AlertCircle, 
  AlertTriangle, 
  Info,
  Code,
  FileCheck,
  BookOpen,
  Link,
  Shield,
  FileText
} from 'lucide-react';
import { getSeverityInfo, getCategoryInfo } from './validation-message-converter';

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
}

interface CollapsibleNodeProps {
  keyName: string;
  value: any;
  level?: number;
  validationIssues?: ValidationIssue[];
  path?: string;
  expandAll?: boolean;
  onCategoryChange?: (category: string) => void;
  onSeverityChange?: (severity: string, path?: string) => void;
  onIssueClick?: (issueId: string) => void;
}

interface ResourceTreeViewerProps {
  resourceData: any;
  validationResults?: ValidationIssue[];
  selectedCategory?: string;
  selectedSeverity?: string;
  selectedPath?: string;
  onCategoryChange?: (category: string) => void;
  onSeverityChange?: (severity: string, path?: string) => void;
  onIssueClick?: (issueId: string) => void;
  expandAll?: boolean;
  onExpandAll?: (expand: boolean) => void;
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
// Collapsible Node Component
// ============================================================================

function CollapsibleNode({ 
  keyName, 
  value, 
  level = 0, 
  validationIssues = [], 
  path = '',
  expandAll = false,
  onCategoryChange,
  onSeverityChange,
  onIssueClick
}: CollapsibleNodeProps) {
  const [isExpanded, setIsExpanded] = useState(expandAll);
  
  // Helper function to get the highest severity color for a set of issues
  const getHighestSeverityColor = (issues: ValidationIssue[]) => {
    if (issues.length === 0) return '';
    
    const hasError = issues.some(issue => issue.severity === 'error');
    const hasWarning = issues.some(issue => issue.severity === 'warning');
    
    if (hasError) return 'border-l-red-500 bg-red-50';
    if (hasWarning) return 'border-l-yellow-500 bg-yellow-50';
    return 'border-l-blue-500 bg-blue-50';
  };
  
  // Get issues for this specific path
  const pathIssues = validationIssues.filter(issue => 
    issue.path === path || issue.location?.join('.') === path
  );
  
  const hasIssues = pathIssues.length > 0;
  const severityColor = getHighestSeverityColor(pathIssues);
  
  // Determine if this node should be expanded
  const shouldExpand = expandAll || isExpanded;
  
  // Handle click on severity badge
  const handleSeverityClick = (severity: string) => {
    onSeverityChange?.(severity, path);
  };
  
  // Handle click on category badge
  const handleCategoryClick = (category: string) => {
    onCategoryChange?.(category);
  };
  
  // Handle click on issue
  const handleIssueClick = (issueId: string) => {
    onIssueClick?.(issueId);
  };
  
  const renderValue = (val: any): React.ReactNode => {
    if (val === null) return <span className="text-gray-500 italic">null</span>;
    if (val === undefined) return <span className="text-gray-500 italic">undefined</span>;
    if (typeof val === 'boolean') return <span className="text-blue-600">{val.toString()}</span>;
    if (typeof val === 'number') return <span className="text-green-600">{val}</span>;
    if (typeof val === 'string') {
      // Check if it's a URL or reference
      if (val.startsWith('http') || val.startsWith('urn:')) {
        return <span className="text-blue-600 underline">{val}</span>;
      }
      return <span className="text-gray-800">"{val}"</span>;
    }
    if (Array.isArray(val)) {
      return <span className="text-purple-600">Array({val.length})</span>;
    }
    if (typeof val === 'object') {
      return <span className="text-orange-600">Object</span>;
    }
    return <span>{String(val)}</span>;
  };
  
  const isExpandable = value && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  
  return (
    <div className={`${hasIssues ? `border-l-2 ${severityColor}` : ''}`}>
      {/* Key-Value Grid Layout with fixed column width */}
      <div className="grid items-center py-0.5" style={{ 
        gridTemplateColumns: `${level * 16}px 24px minmax(150px, auto) 1fr auto`,
        paddingLeft: 0 
      }}>
        {/* Column 1: Indentation spacer */}
        <div />
        
        {/* Column 2: Expand/Collapse Button or Spacer */}
        <div className="flex items-center justify-start">
          {isExpandable ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {shouldExpand ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          ) : (
            <div className="w-6" />
          )}
        </div>
        
        {/* Column 3: Key Name - fixed width column */}
        <div className="flex items-center">
          <span className="font-medium text-gray-900 whitespace-nowrap">{keyName}:</span>
        </div>
        
        {/* Column 4: Value (all aligned on same X position) */}
        <div className="text-left pl-2">
          {!shouldExpand && (
            <>
              {isExpandable ? (
                <span className="text-gray-600">
                  Object ({Object.keys(value).length} properties)
                </span>
              ) : isArray ? (
                <span className="text-gray-600">
                  Array ({value.length} items)
                </span>
              ) : (
                renderValue(value)
              )}
            </>
          )}
        </div>
        
        {/* Column 5: Validation Issues */}
        <div className="flex items-center gap-1 justify-end ml-2">
          {hasIssues && pathIssues.map((issue, index) => (
            <div key={issue.id || index} className="flex items-center gap-1">
              {/* Severity Badge */}
              <Badge
                variant={issue.severity === 'error' ? 'destructive' : 'secondary'}
                className="h-5 text-xs cursor-pointer"
                onClick={() => handleSeverityClick(issue.severity || 'information')}
              >
                {getSeverityIcon(issue.severity || 'information')}
              </Badge>
              
              {/* Category Badge */}
              <Badge
                variant="outline"
                className="h-5 text-xs cursor-pointer"
                onClick={() => handleCategoryClick(issue.category || 'general')}
              >
                {getCategoryIcon(issue.category || 'general')}
              </Badge>
            </div>
          ))}
        </div>
      </div>
      
      {/* Expanded Content */}
      {shouldExpand && (
        <div className="space-y-1">
          {isExpandable && Object.entries(value).map(([key, val]) => (
            <CollapsibleNode
              key={key}
              keyName={key}
              value={val}
              level={level + 1}
              validationIssues={validationIssues}
              path={path ? `${path}.${key}` : key}
              expandAll={expandAll}
              onCategoryChange={onCategoryChange}
              onSeverityChange={onSeverityChange}
              onIssueClick={onIssueClick}
            />
          ))}
          
          {isArray && value.map((item: any, index: number) => (
            <CollapsibleNode
              key={index}
              keyName={`[${index}]`}
              value={item}
              level={level + 1}
              validationIssues={validationIssues}
              path={path ? `${path}[${index}]` : `[${index}]`}
              expandAll={expandAll}
              onCategoryChange={onCategoryChange}
              onSeverityChange={onSeverityChange}
              onIssueClick={onIssueClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Resource Tree Viewer Component
// ============================================================================

export default function ResourceTreeViewer({
  resourceData,
  validationResults = [],
  selectedCategory,
  selectedSeverity,
  selectedPath,
  onCategoryChange,
  onSeverityChange,
  onIssueClick,
  expandAll = false,
  onExpandAll
}: ResourceTreeViewerProps) {
  
  if (!resourceData) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p>No resource data available</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {/* Tree Structure */}
      <div className="font-mono text-sm">
        {Object.entries(resourceData)
          .filter(([key]) => !key.startsWith('_') && key !== 'resourceId') // Filter out internal fields
          .map(([key, value]) => (
            <CollapsibleNode
              key={key}
              keyName={key}
              value={value}
              level={0}
              validationIssues={validationResults}
              path={key}
              expandAll={expandAll}
              onCategoryChange={onCategoryChange}
              onSeverityChange={onSeverityChange}
              onIssueClick={onIssueClick}
            />
          ))}
      </div>
      
      {/* Summary */}
      {validationResults.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">
            <strong>{validationResults.length}</strong> validation issue{validationResults.length !== 1 ? 's' : ''} found
          </div>
        </div>
      )}
    </div>
  );
}