import { 
  Code, 
  FileCheck, 
  Book, 
  Link, 
  Shield, 
  FileText,
  XCircle,
  AlertTriangle,
  Info,
  LucideIcon
} from 'lucide-react';

// Category icons mapping
export const categoryIcons: Record<string, LucideIcon> = {
  'structural': Code,
  'profile': FileCheck,
  'terminology': Book,
  'reference': Link,
  'business-rule': Shield,
  'metadata': FileText,
  'general': Info
};

// Severity icons mapping
export const severityIcons: Record<string, LucideIcon> = {
  'error': XCircle,
  'warning': AlertTriangle,
  'information': Info
};

// Category descriptions
export const categoryDescriptions: Record<string, string> = {
  'structural': 'FHIR structure, data types, and cardinality rules',
  'profile': 'Profile conformance (US Core, HL7 profiles)',
  'terminology': 'Code systems, terminology bindings, and vocabulary',
  'reference': 'Resource references and relationship integrity',
  'business-rule': 'Clinical logic and healthcare business rules',
  'metadata': 'Resource metadata, security labels, and extensions',
  'general': 'General validation issues'
};

// Get category icon component
export function getCategoryIcon(category: string, className: string = "w-4 h-4"): JSX.Element {
  const Icon = categoryIcons[category] || categoryIcons.general;
  return <Icon className={className} />;
}

// Get severity icon component
export function getSeverityIcon(severity: string, className: string = "w-4 h-4"): JSX.Element {
  const Icon = severityIcons[severity] || severityIcons.information;
  return <Icon className={className} />;
}

// Get severity color classes
export function getSeverityColor(severity: string): string {
  switch(severity) {
    case 'error': return 'text-red-600';
    case 'warning': return 'text-yellow-600';
    case 'information': return 'text-blue-600';
    default: return 'text-gray-600';
  }
}

// Get category color classes
export function getCategoryColor(category: string): string {
  switch(category) {
    case 'structural': return 'text-purple-600';
    case 'profile': return 'text-green-600';
    case 'terminology': return 'text-indigo-600';
    case 'reference': return 'text-cyan-600';
    case 'business-rule': return 'text-orange-600';
    case 'metadata': return 'text-pink-600';
    default: return 'text-gray-600';
  }
}