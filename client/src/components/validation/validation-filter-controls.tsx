import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Filter, 
  Search, 
  X, 
  Grid3X3, 
  Table,
  BarChart3
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type ValidationCategory = 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata';
type ValidationSeverity = 'error' | 'warning' | 'information';
type ViewMode = 'grouped' | 'flat' | 'aggregated';
type GroupBy = 'category' | 'severity' | 'message' | 'path';

interface ValidationFilterControlsProps {
  // Filter values
  selectedCategory: ValidationCategory | 'all';
  selectedSeverity: ValidationSeverity | 'all';
  viewMode: ViewMode;
  groupBy: GroupBy;
  searchQuery: string;
  
  // Filter handlers
  onCategoryChange: (category: ValidationCategory | 'all') => void;
  onSeverityChange: (severity: ValidationSeverity | 'all') => void;
  onViewModeChange: (mode: ViewMode) => void;
  onGroupByChange: (groupBy: GroupBy) => void;
  onSearchChange: (query: string) => void;
  onClearFilters: () => void;
  
  // Counts for display
  totalIssues: number;
  filteredIssues: number;
}

// ============================================================================
// Component
// ============================================================================

export function ValidationFilterControls({
  selectedCategory,
  selectedSeverity,
  viewMode,
  groupBy,
  searchQuery,
  onCategoryChange,
  onSeverityChange,
  onViewModeChange,
  onGroupByChange,
  onSearchChange,
  onClearFilters,
  totalIssues,
  filteredIssues
}: ValidationFilterControlsProps) {
  
  const hasActiveFilters = selectedCategory !== 'all' || 
                          selectedSeverity !== 'all' || 
                          searchQuery !== '' ||
                          viewMode !== 'grouped' ||
                          groupBy !== 'category';
  
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="h-4 w-4 text-gray-600" />
        <span className="font-medium text-gray-700">Filter & Group Issues</span>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear All
          </Button>
        )}
      </div>
      
      <div className="flex flex-wrap gap-4 items-center">
        {/* Search Input */}
        <div className="flex items-center gap-2 flex-1 min-w-64">
          <label className="text-sm font-medium text-gray-600">Search:</label>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search in messages, codes, paths..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSearchChange('')}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Category:</label>
          <Select value={selectedCategory} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="structural">Structural</SelectItem>
              <SelectItem value="profile">Profile</SelectItem>
              <SelectItem value="terminology">Terminology</SelectItem>
              <SelectItem value="reference">Reference</SelectItem>
              <SelectItem value="businessRule">Business Rule</SelectItem>
              <SelectItem value="metadata">Metadata</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Severity Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Severity:</label>
          <Select value={selectedSeverity} onValueChange={onSeverityChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
              <SelectItem value="warning">Warnings</SelectItem>
              <SelectItem value="information">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">View:</label>
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grouped' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('grouped')}
              className="rounded-r-none"
            >
              <Grid3X3 className="h-4 w-4 mr-1" />
              Grouped
            </Button>
            <Button
              variant={viewMode === 'flat' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('flat')}
              className="rounded-none"
            >
              <Table className="h-4 w-4 mr-1" />
              Flat
            </Button>
            <Button
              variant={viewMode === 'aggregated' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('aggregated')}
              className="rounded-l-none"
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Analytics
            </Button>
          </div>
        </div>

        {/* Group By Selector (only show when in grouped mode) */}
        {viewMode === 'grouped' && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Group by:</label>
            <Select value={groupBy} onValueChange={onGroupByChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="severity">Severity</SelectItem>
                <SelectItem value="message">Message</SelectItem>
                <SelectItem value="path">Path</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      
      {/* Results Summary */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing {filteredIssues} of {totalIssues} issues
          </span>
          {hasActiveFilters && (
            <span className="text-blue-600">
              Filters active
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
