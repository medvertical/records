/**
 * Validation Completeness Card
 * 
 * Displays validation completeness indicators including coverage metrics,
 * missing validation areas, and completeness scores.
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  CheckCircle, 
  AlertTriangle, 
  Target, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Database,
  FileText,
  Shield,
  Zap,
  Info,
  AlertCircle,
  Clock,
  BarChart3,
  Layers
} from 'lucide-react';
import type { ValidationCompletenessMetrics } from '@shared/types/validation';

interface ValidationCompletenessCardProps {
  completeness: ValidationCompletenessMetrics;
  isLoading?: boolean;
  className?: string;
}

export function ValidationCompletenessCard({ 
  completeness, 
  isLoading = false,
  className = ''
}: ValidationCompletenessCardProps) {
  if (isLoading) {
    return (
      <Card className={`transition-all duration-300 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Validation Completeness
          </CardTitle>
          <CardDescription>
            Completeness assessment of validation coverage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-2 bg-gray-200 rounded w-full"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getCompletenessColor = (level: string): string => {
    switch (level) {
      case 'fully_complete': return 'text-green-600 bg-green-50 border-green-200';
      case 'complete': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'mostly_complete': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'partial': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'incomplete': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getCompletenessIcon = (level: string) => {
    switch (level) {
      case 'fully_complete': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'complete': return <Target className="h-4 w-4 text-blue-600" />;
      case 'mostly_complete': return <Activity className="h-4 w-4 text-yellow-600" />;
      case 'partial': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'incomplete': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'stable': return <Activity className="h-4 w-4 text-blue-600" />;
      default: return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatCompletenessLevel = (level: string): string => {
    return level.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getEffortColor = (effort: string): string => {
    switch (effort) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'very_high': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <Card className={`transition-all duration-300 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Validation Completeness
          <Badge className={`ml-auto ${getCompletenessColor(completeness.completenessLevel)}`}>
            {getCompletenessIcon(completeness.completenessLevel)}
            <span className="ml-1">{formatCompletenessLevel(completeness.completenessLevel)}</span>
          </Badge>
        </CardTitle>
        <CardDescription>
          Completeness assessment of validation coverage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Completeness Score */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-gray-600" />
              <span className="font-medium">Overall Completeness</span>
              {getTrendIcon(completeness.completenessTrend)}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{completeness.completenessScore}/100</div>
              <div className="text-sm text-gray-600">
                Coverage: {Math.round(completeness.coverageMetrics.overallCoverage)}%
              </div>
            </div>
          </div>
          <Progress value={completeness.completenessScore} className="h-2" />
        </div>

        {/* Completeness Factors */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Completeness Factors</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Layers className="h-3 w-3 text-blue-600" />
                <span className="text-xs font-medium">Aspects</span>
              </div>
              <div className="text-lg font-semibold text-blue-600">
                {Math.round(completeness.completenessFactors.aspectCompleteness)}%
              </div>
              <Progress value={completeness.completenessFactors.aspectCompleteness} className="h-1" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Database className="h-3 w-3 text-green-600" />
                <span className="text-xs font-medium">Fields</span>
              </div>
              <div className="text-lg font-semibold text-green-600">
                {Math.round(completeness.completenessFactors.fieldCoverage)}%
              </div>
              <Progress value={completeness.completenessFactors.fieldCoverage} className="h-1" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-purple-600" />
                <span className="text-xs font-medium">Rules</span>
              </div>
              <div className="text-lg font-semibold text-purple-600">
                {Math.round(completeness.completenessFactors.ruleCoverage)}%
              </div>
              <Progress value={completeness.completenessFactors.ruleCoverage} className="h-1" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileText className="h-3 w-3 text-orange-600" />
                <span className="text-xs font-medium">Profile</span>
              </div>
              <div className="text-lg font-semibold text-orange-600">
                {Math.round(completeness.completenessFactors.profileCompliance)}%
              </div>
              <Progress value={completeness.completenessFactors.profileCompliance} className="h-1" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-3 w-3 text-teal-600" />
                <span className="text-xs font-medium">Terminology</span>
              </div>
              <div className="text-lg font-semibold text-teal-600">
                {Math.round(completeness.completenessFactors.terminologyCoverage)}%
              </div>
              <Progress value={completeness.completenessFactors.terminologyCoverage} className="h-1" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="h-3 w-3 text-indigo-600" />
                <span className="text-xs font-medium">References</span>
              </div>
              <div className="text-lg font-semibold text-indigo-600">
                {Math.round(completeness.completenessFactors.referenceCoverage)}%
              </div>
              <Progress value={completeness.completenessFactors.referenceCoverage} className="h-1" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-pink-600" />
                <span className="text-xs font-medium">Business Rules</span>
              </div>
              <div className="text-lg font-semibold text-pink-600">
                {Math.round(completeness.completenessFactors.businessRuleCoverage)}%
              </div>
              <Progress value={completeness.completenessFactors.businessRuleCoverage} className="h-1" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Info className="h-3 w-3 text-gray-600" />
                <span className="text-xs font-medium">Metadata</span>
              </div>
              <div className="text-lg font-semibold text-gray-600">
                {Math.round(completeness.completenessFactors.metadataCoverage)}%
              </div>
              <Progress value={completeness.completenessFactors.metadataCoverage} className="h-1" />
            </div>
          </div>
        </div>

        {/* Coverage Metrics */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Coverage Metrics</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Aspect Coverage</span>
              </div>
              <div className="space-y-1">
                {Object.entries(completeness.coverageMetrics.aspectCoverage).map(([aspect, coverage]) => (
                  <div key={aspect} className="flex items-center justify-between text-xs">
                    <span className="capitalize">{aspect.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={coverage.coverage} className="h-1 w-16" />
                      <span className="w-8 text-right">{Math.round(coverage.coverage)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Field Type Coverage</span>
              </div>
              <div className="space-y-1">
                {Object.entries(completeness.coverageMetrics.fieldTypeCoverage).map(([type, coverage]) => (
                  <div key={type} className="flex items-center justify-between text-xs">
                    <span className="capitalize">{type}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={coverage.coverage} className="h-1 w-16" />
                      <span className="w-8 text-right">{Math.round(coverage.coverage)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Section Coverage</span>
              </div>
              <div className="space-y-1">
                {Object.entries(completeness.coverageMetrics.sectionCoverage).map(([section, coverage]) => (
                  <div key={section} className="flex items-center justify-between text-xs">
                    <span className="capitalize">{section}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={coverage.coverage} className="h-1 w-16" />
                      <span className="w-8 text-right">{Math.round(coverage.coverage)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Missing Validation Areas */}
        {completeness.missingValidationAreas.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-gray-900">Missing Validation Areas</span>
              <Badge variant="outline" className="text-xs">
                {completeness.missingValidationAreas.length} area{completeness.missingValidationAreas.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="space-y-2">
              {completeness.missingValidationAreas.slice(0, 3).map((area, index) => (
                <div key={index} className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      area.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      area.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                      area.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {area.severity}
                  </Badge>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{area.description}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Impact: -{area.impact}% completeness
                    </div>
                    {area.resolution && (
                      <div className="text-xs text-blue-600 mt-1">
                        Resolution: {area.resolution}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {completeness.missingValidationAreas.length > 3 && (
                <div className="text-xs text-gray-500 text-center">
                  +{completeness.missingValidationAreas.length - 3} more areas
                </div>
              )}
            </div>
          </div>
        )}

        {/* Validation Gaps */}
        {completeness.validationGaps.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="font-medium text-gray-900">Validation Gaps</span>
              <Badge variant="outline" className="text-xs">
                {completeness.validationGaps.length} gap{completeness.validationGaps.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="space-y-2">
              {completeness.validationGaps.slice(0, 2).map((gap, index) => (
                <div key={index} className="flex items-start gap-2 p-2 bg-red-50 rounded-lg">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      gap.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      gap.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                      gap.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {gap.severity}
                  </Badge>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{gap.description}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Impact: -{gap.completenessImpact}% completeness
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      Fix: {gap.suggestedFix}
                    </div>
                  </div>
                </div>
              ))}
              {completeness.validationGaps.length > 2 && (
                <div className="text-xs text-gray-500 text-center">
                  +{completeness.validationGaps.length - 2} more gaps
                </div>
              )}
            </div>
          </div>
        )}

        {/* Completeness Explanation */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Completeness Analysis</h4>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">{completeness.explanation}</p>
          </div>
        </div>

        {/* Recommendations */}
        {completeness.recommendations.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-gray-900">Recommendations</span>
            </div>
            <div className="space-y-2">
              {completeness.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div className="text-sm text-gray-700">{recommendation}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completeness Summary */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Completeness Trend:</span>
            <div className="flex items-center gap-1">
              {getTrendIcon(completeness.completenessTrend)}
              <span className="text-sm capitalize">{completeness.completenessTrend}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-700">Effort to Complete</div>
            <Badge className={`text-xs ${getEffortColor(completeness.estimatedEffort)}`}>
              {completeness.estimatedEffort.replace('_', ' ')}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
