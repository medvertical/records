import React from 'react';
import { getResourceTypeIcon } from '@/lib/resource-type-icons';
import { getShortId } from '@/lib/resource-utils';
import { cn } from '@/lib/utils';

export interface ResourceBadgeProps {
  resourceType: string;
  resourceId: string;
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'compact';
}

export function ResourceBadge({
  resourceType,
  resourceId,
  onClick,
  className,
  variant = 'default',
}: ResourceBadgeProps) {
  const Icon = getResourceTypeIcon(resourceType);
  const displayId = getShortId(resourceId);

  const baseClasses = cn(
    'inline-flex items-center gap-1.5 px-2 py-1 rounded border transition-colors',
    onClick
      ? 'cursor-pointer hover:bg-gray-100'
      : '',
    className
  );

  const content = (
    <>
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="text-xs">
        {variant === 'compact' ? displayId : `${resourceType}/${displayId}`}
      </span>
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

