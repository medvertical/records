import React from 'react';
import { cn } from '@/lib/utils';

export interface PathBadgeProps {
  path: string;
  onClick?: () => void;
  className?: string;
}

export function PathBadge({ path, onClick, className }: PathBadgeProps) {
  const isClickable = !!onClick;

  return (
    <code
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-medium transition-colors',
        'bg-black/5 text-gray-900',
        'dark:bg-white/5 dark:text-gray-100',
        isClickable && 'cursor-pointer hover:bg-black/10 dark:hover:bg-white/10',
        !isClickable && 'cursor-default',
        className
      )}
      title={isClickable ? 'Click to highlight in tree viewer' : path}
    >
      {path}
    </code>
  );
}

