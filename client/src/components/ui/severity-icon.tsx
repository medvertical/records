import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type SeverityLevel = 'error' | 'warning' | 'information' | 'info';

interface SeverityIconProps {
  severity: SeverityLevel;
  className?: string;
}

/**
 * Consistent severity icon component used across the application
 * Provides unified icons for error, warning, and information severity levels
 */
export function SeverityIcon({ severity, className = "h-4 w-4" }: SeverityIconProps) {
  const normalizedSeverity = severity.toLowerCase();
  
  switch (normalizedSeverity) {
    case 'error':
      return <AlertCircle className={`${className} text-red-600`} />;
    case 'warning':
      return <AlertTriangle className={`${className} text-yellow-600`} />;
    case 'information':
    case 'info':
      return <Info className={`${className} text-blue-600`} />;
    default:
      return <Info className={`${className} text-gray-600`} />;
  }
}

/**
 * Get severity color classes for use in badges and text
 */
export function getSeverityColor(severity: SeverityLevel): string {
  const normalizedSeverity = severity.toLowerCase();
  
  switch (normalizedSeverity) {
    case 'error':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'warning':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'information':
    case 'info':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

/**
 * Get severity badge variant for shadcn/ui Badge component
 */
export function getSeverityVariant(severity: SeverityLevel): "default" | "destructive" | "secondary" {
  const normalizedSeverity = severity.toLowerCase();
  
  switch (normalizedSeverity) {
    case 'error':
      return 'destructive';
    case 'warning':
      return 'secondary';
    default:
      return 'default';
  }
}

