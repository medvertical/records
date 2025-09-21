/**
 * Validation Confidence Card
 * 
 * Displays confidence scoring for validation results including confidence level,
 * factors, issues, and recommended actions.
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Target,
  Database,
  BarChart3,
  Clock,
  Zap,
  Info,
  AlertCircle,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import type { ValidationConfidenceMetrics } from '@shared/types/validation';

interface ValidationConfidenceCardProps {
  confidence: ValidationConfidenceMetrics;
  isLoading?: boolean;
  className?: string;
}

export function ValidationConfidenceCard({ 
  confidence, 
  isLoading = false,
  className = ''
}: ValidationConfidenceCardProps) {
  if (isLoading) {
    return (
      <Card className={`transition-all duration-300 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Validation Confidence
          </CardTitle>
          <CardDescription>
            Confidence assessment of validation results
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

  const getConfidenceColor = (level: string): string => {
    switch (level) {
      case 'very_high': return 'text-green-600 bg-green-50 border-green-200';
      case 'high': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'very_low': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getConfidenceIcon = (level: string) => {
    switch (level) {
      case 'very_high': return <ThumbsUp className="h-4 w-4 text-green-600" />;
      case 'high': return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'medium': return <Activity className="h-4 w-4 text-yellow-600" />;
      case 'low': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'very_low': return <AlertCircle className="h-4 w-4 text-red-600" />;
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

  const formatConfidenceLevel = (level: string): string => {
    return level.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <Card className={`transition-all duration-300 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Validation Confidence
          <Badge className={`ml-auto ${getConfidenceColor(confidence.confidenceLevel)}`}>
            {getConfidenceIcon(confidence.confidenceLevel)}
            <span className="ml-1">{formatConfidenceLevel(confidence.confidenceLevel)}</span>
          </Badge>
        </CardTitle>
        <CardDescription>
          Confidence assessment of validation results
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Confidence Score */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-gray-600" />
              <span className="font-medium">Overall Confidence</span>
              {getTrendIcon(confidence.confidenceTrend)}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{confidence.confidenceScore}/100</div>
              <div className="text-sm text-gray-600">{confidence.validationCertainty}% Certainty</div>
            </div>
          </div>
          <Progress value={confidence.confidenceScore} className="h-2" />
        </div>

        {/* Confidence Factors */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Confidence Factors</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-blue-600" />
                <span className="text-xs font-medium">Completeness</span>
              </div>
              <div className="text-lg font-semibold text-blue-600">
                {Math.round(confidence.confidenceFactors.aspectCompleteness)}%
              </div>
              <Progress value={confidence.confidenceFactors.aspectCompleteness} className="h-1" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Database className="h-3 w-3 text-green-600" />
                <span className="text-xs font-medium">Data Quality</span>
              </div>
              <div className="text-lg font-semibold text-green-600">
                {Math.round(confidence.confidenceFactors.dataSourceQuality)}%
              </div>
              <Progress value={confidence.confidenceFactors.dataSourceQuality} className="h-1" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-3 w-3 text-purple-600" />
                <span className="text-xs font-medium">Consistency</span>
              </div>
              <div className="text-lg font-semibold text-purple-600">
                {Math.round(confidence.confidenceFactors.resultConsistency)}%
              </div>
              <Progress value={confidence.confidenceFactors.resultConsistency} className="h-1" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Target className="h-3 w-3 text-orange-600" />
                <span className="text-xs font-medium">Rule Coverage</span>
              </div>
              <div className="text-lg font-semibold text-orange-600">
                {Math.round(confidence.confidenceFactors.ruleCoverage)}%
              </div>
              <Progress value={confidence.confidenceFactors.ruleCoverage} className="h-1" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-teal-600" />
                <span className="text-xs font-medium">Historical</span>
              </div>
              <div className="text-lg font-semibold text-teal-600">
                {Math.round(confidence.confidenceFactors.historicalAccuracy)}%
              </div>
              <Progress value={confidence.confidenceFactors.historicalAccuracy} className="h-1" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="h-3 w-3 text-indigo-600" />
                <span className="text-xs font-medium">Engine</span>
              </div>
              <div className="text-lg font-semibold text-indigo-600">
                {Math.round(confidence.confidenceFactors.engineReliability)}%
              </div>
              <Progress value={confidence.confidenceFactors.engineReliability} className="h-1" />
            </div>
          </div>
        </div>

        {/* Confidence Issues */}
        {confidence.confidenceIssues.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-gray-900">Confidence Issues</span>
              <Badge variant="outline" className="text-xs">
                {confidence.confidenceIssues.length} issue{confidence.confidenceIssues.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="space-y-2">
              {confidence.confidenceIssues.map((issue, index) => (
                <div key={index} className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      issue.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      issue.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                      issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {issue.severity}
                  </Badge>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{issue.description}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Impact: -{issue.confidenceImpact}% confidence
                    </div>
                    {issue.resolution && (
                      <div className="text-xs text-blue-600 mt-1">
                        Resolution: {issue.resolution}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confidence Explanation */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Confidence Analysis</h4>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">{confidence.explanation}</p>
          </div>
        </div>

        {/* Recommendations */}
        {confidence.recommendations.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-gray-900">Recommendations</span>
            </div>
            <div className="space-y-2">
              {confidence.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div className="text-sm text-gray-700">{recommendation}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confidence Trend */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Confidence Trend:</span>
            <div className="flex items-center gap-1">
              {getTrendIcon(confidence.confidenceTrend)}
              <span className="text-sm capitalize">{confidence.confidenceTrend}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-700">Validation Certainty</div>
            <div className="text-lg font-semibold text-gray-900">
              {confidence.validationCertainty}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
