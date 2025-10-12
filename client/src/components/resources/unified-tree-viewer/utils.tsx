import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Code,
  FileCheck,
  BookOpen,
  Link,
  Shield,
  FileText,
} from 'lucide-react';

// ============================================================================
// Helper Functions for UnifiedTreeViewer
// ============================================================================

/**
 * Set a value at a nested path in an object/array
 */
export function setNestedValue(obj: any, path: string[], value: any): any {
  if (path.length === 0) return value;
  
  const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
  const [head, ...rest] = path;
  
  if (rest.length === 0) {
    newObj[head] = value;
  } else {
    newObj[head] = setNestedValue(newObj[head] || {}, rest, value);
  }
  
  return newObj;
}

/**
 * Delete a value at a nested path in an object/array
 */
export function deleteNestedValue(obj: any, path: string[]): any {
  if (path.length === 0) return obj;
  if (path.length === 1) {
    const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
    if (Array.isArray(newObj)) {
      newObj.splice(parseInt(path[0]), 1);
    } else {
      delete newObj[path[0]];
    }
    return newObj;
  }
  
  const [head, ...rest] = path;
  const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
  newObj[head] = deleteNestedValue(newObj[head], rest);
  return newObj;
}

/**
 * Get icon component for validation category
 */
export const getCategoryIcon = (category: string) => {
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

/**
 * Get icon component for validation severity
 */
export const getSeverityIcon = (severity: string) => {
  const iconMap = {
    'error': AlertCircle,
    'warning': AlertTriangle,
    'information': Info
  };
  
  const IconComponent = iconMap[severity as keyof typeof iconMap] || Info;
  return <IconComponent className="h-3 w-3" />;
};

