/**
 * Validation Aspect Badge Component
 * 
 * Displays a colored badge for validation aspects with icons
 */

import { Badge } from '@/components/ui/badge';
import { 
  Layers, 
  FileCode2, 
  Code, 
  Link2, 
  Workflow, 
  Info 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ValidationAspect = 
  | 'structural' 
  | 'profile' 
  | 'terminology' 
  | 'reference' 
  | 'businessRule' 
  | 'metadata';

interface AspectBadgeProps {
  aspect: ValidationAspect | string;
  className?: string;
  showIcon?: boolean;
}

/**
 * Get icon component for a validation aspect
 */
function getAspectIcon(aspect: ValidationAspect | string) {
  const aspectLower = aspect.toLowerCase();
  
  switch (aspectLower) {
    case 'structural':
      return Layers; // Structure/layers
    case 'profile':
      return FileCode2; // Profile definition
    case 'terminology':
      return Code; // Code systems
    case 'reference':
      return Link2; // References/links
    case 'businessrule':
      return Workflow; // Business logic flow
    case 'metadata':
      return Info; // Metadata information
    default:
      return Layers; // Default fallback
  }
}

/**
 * Get friendly display name for aspect
 */
function getAspectName(aspect: ValidationAspect | string): string {
  const aspectLower = aspect.toLowerCase();
  
  const nameMap: Record<string, string> = {
    structural: 'Structural',
    profile: 'Profile',
    terminology: 'Terminology',
    reference: 'Reference',
    businessrule: 'Business Rule',
    metadata: 'Metadata'
  };
  
  return nameMap[aspectLower] || aspect;
}

/**
 * Get color classes for aspect badge (neutral styling)
 */
function getAspectColorClasses(): string {
  // Use neutral muted background for all aspects
  return 'bg-muted/50 text-foreground';
}

/**
 * Aspect badge component
 */
export function AspectBadge({ aspect, className = '', showIcon = true }: AspectBadgeProps) {
  const IconComponent = getAspectIcon(aspect);
  const aspectName = getAspectName(aspect);
  const colorClasses = getAspectColorClasses();
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        'font-medium border-0',
        colorClasses,
        className
      )}
    >
      {showIcon && <IconComponent className="h-3.5 w-3.5 mr-1.5" />}
      {aspectName}
    </Badge>
  );
}

