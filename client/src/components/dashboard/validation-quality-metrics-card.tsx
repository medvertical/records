/**
 * Validation Quality Metrics Card
 * 
 * Displays comprehensive validation quality metrics including accuracy,
 * completeness, consistency, performance, and reliability scores.
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  Target, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  Shield,
  Activity,
  BarChart3,
  Award,
  TrendingDown
} from 'lucide-react';
import type { ValidationQualityMetrics } from '@shared/types/validation';

interface ValidationQualityMetricsCardProps {
  qualityMetrics: ValidationQualityMetrics;
  isLoading?: boolean;
  className?: string;
}

export function ValidationQualityMetricsCard({ 
  qualityMetrics, 
  isLoading = false,
  className = ''
}: ValidationQualityMetricsCardProps) {
  if (isLoading || !qualityMetrics) {
    return (
      <Card className={`transition-all duration-300 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Validation Quality Metrics
          </CardTitle>
          <CardDescription>
            Comprehensive quality assessment of validation performance
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

  const getQualityGrade = (score: number): string => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  const getQualityColor = (score: number): string => {
    if (score >= 90) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 80) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (score >= 60) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getQualityStatus = (score: number): string => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Acceptable';
    if (score >= 60) return 'Poor';
    return 'Unacceptable';
  };

  const getTrendIcon = (score: number) => {
    if (score >= 85) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (score >= 70) return <Activity className="h-4 w-4 text-blue-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  return (
    <Card className={`transition-all duration-300 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Validation Quality Metrics
          <Badge className={`ml-auto ${getQualityColor(qualityMetrics.overallQualityScore)}`}>
            Grade {getQualityGrade(qualityMetrics.overallQualityScore)}
          </Badge>
        </CardTitle>
        <CardDescription>
          Comprehensive quality assessment of validation performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Quality Score */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-gray-600" />
              <span className="font-medium">Overall Quality Score</span>
              {getTrendIcon(qualityMetrics.overallQualityScore)}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{Math.round(qualityMetrics.overallQualityScore)}</div>
              <div className="text-sm text-gray-600">{getQualityStatus(qualityMetrics.overallQualityScore)}</div>
            </div>
          </div>
          <Progress value={qualityMetrics.overallQualityScore} className="h-2" />
        </div>

        {/* Quality Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Accuracy */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Accuracy</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(qualityMetrics.accuracy.accuracy)}%
            </div>
            <Progress value={qualityMetrics.accuracy.accuracy} className="h-1" />
            <div className="text-xs text-gray-600">
              F1: {Math.round(qualityMetrics.accuracy.f1Score * 100)}% | 
              Conf: {Math.round(qualityMetrics.accuracy.confidence)}%
            </div>
          </div>

          {/* Completeness */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Completeness</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {Math.round(qualityMetrics.completeness.completenessScore)}%
            </div>
            <Progress value={qualityMetrics.completeness.completenessScore} className="h-1" />
            <div className="text-xs text-gray-600">
              Coverage: {Math.round(qualityMetrics.completeness.fullValidationCoverage)}%
            </div>
          </div>

          {/* Consistency */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium">Consistency</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(qualityMetrics.consistency.consistencyScore)}%
            </div>
            <Progress value={qualityMetrics.consistency.consistencyScore} className="h-1" />
            <div className="text-xs text-gray-600">
              StdDev: {Math.round(qualityMetrics.consistency.scoreStandardDeviation)}
            </div>
          </div>

          {/* Performance */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">Performance</span>
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {Math.round(qualityMetrics.performance.performanceScore)}%
            </div>
            <Progress value={qualityMetrics.performance.performanceScore} className="h-1" />
            <div className="text-xs text-gray-600">
              {Math.round(qualityMetrics.performance.throughput)} res/min
            </div>
          </div>

          {/* Reliability */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-medium">Reliability</span>
            </div>
            <div className="text-2xl font-bold text-indigo-600">
              {Math.round(qualityMetrics.reliability.reliabilityScore)}%
            </div>
            <Progress value={qualityMetrics.reliability.reliabilityScore} className="h-1" />
            <div className="text-xs text-gray-600">
              Uptime: {Math.round(qualityMetrics.reliability.uptime)}%
            </div>
          </div>

          {/* Confidence */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-teal-600" />
              <span className="text-sm font-medium">Confidence</span>
            </div>
            <div className="text-2xl font-bold text-teal-600">
              {Math.round(qualityMetrics.accuracy.confidence)}%
            </div>
            <Progress value={qualityMetrics.accuracy.confidence} className="h-1" />
            <div className="text-xs text-gray-600">
              Validation Confidence
            </div>
          </div>
        </div>

        {/* Aspect Quality Breakdown */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Validation Aspect Quality</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(qualityMetrics.aspectQualityScores).map(([aspect, quality]) => (
              <div key={aspect} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">
                    {aspect.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getQualityColor(quality.qualityScore)}`}
                  >
                    {Math.round(quality.qualityScore)}%
                  </Badge>
                </div>
                <Progress value={quality.qualityScore} className="h-1" />
                <div className="text-xs text-gray-600">
                  Issues: {quality.issueCount} | Coverage: {Math.round(quality.coverage)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Metrics Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-700">
              {Math.round(qualityMetrics.accuracy.precision * 100)}%
            </div>
            <div className="text-xs text-gray-600">Precision</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-700">
              {Math.round(qualityMetrics.accuracy.recall * 100)}%
            </div>
            <div className="text-xs text-gray-600">Recall</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-700">
              {qualityMetrics.consistency.inconsistentValidations}
            </div>
            <div className="text-xs text-gray-600">Inconsistent</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-700">
              {qualityMetrics.performance.bottlenecks.length}
            </div>
            <div className="text-xs text-gray-600">Bottlenecks</div>
          </div>
        </div>

        {/* Recommendations Preview */}
        {qualityMetrics.recommendations.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-gray-900">Top Recommendations</span>
            </div>
            <div className="space-y-2">
              {qualityMetrics.recommendations.slice(0, 3).map((rec) => (
                <div key={rec.id} className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      rec.priority === 'critical' ? 'bg-red-100 text-red-700' :
                      rec.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                      rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {rec.priority}
                  </Badge>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{rec.title}</div>
                    <div className="text-xs text-gray-600 mt-1">{rec.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
