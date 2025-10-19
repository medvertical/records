import React from 'react';
import { getResourceTypeIcon } from '@/lib/resource-type-icons';
import { getShortId } from '@/lib/resource-utils';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

export interface ResourceBadgeProps {
  resourceType: string;
  resourceId: string;
  onClick?: () => void;
  className?: string;
  showExternalLink?: boolean;
  variant?: 'default' | 'compact';
}

export function ResourceBadge({
  resourceType,
  resourceId,
  onClick,
  className,
  showExternalLink = false,
  variant = 'default',
}: ResourceBadgeProps) {
  const Icon = getResourceTypeIcon(resourceType);
  const displayId = getShortId(resourceId);

  const baseClasses = cn(
    'inline-flex items-center gap-1.5 px-2 py-1 rounded border transition-colors',
    onClick
      ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'
      : '',
    className
  );

  const content = (
    <>
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="text-xs">
        {variant === 'compact' ? displayId : `${resourceType}/${displayId}`}
      </span>
      {showExternalLink && onClick && (
        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={cn(baseClasses, 'bg-white border-gray-300 text-gray-700 group')}
        title={`Navigate to ${resourceType}/${resourceId}`}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={cn(baseClasses, 'bg-white border-gray-300 text-gray-700')}>
      {content}
    </span>
  );
}

export default ResourceBadge;

