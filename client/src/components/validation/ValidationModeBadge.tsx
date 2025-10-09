/**
 * ValidationModeBadge Component
 * 
 * Task 3.8: Mode indicator badge displaying online/offline status
 * 
 * Displays:
 * - 🌐 Online (blue) or 📦 Offline (green) badge
 * - Tooltip with health information
 * - Click to toggle mode (optional)
 */

import React from 'react';
import { Badge } from '../ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { Globe, Package, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useValidationMode, type ValidationMode } from '../../hooks/use-validation-mode';

// ============================================================================
// Types
// ============================================================================

interface ValidationModeBadgeProps {
  /** Enable click to toggle mode */
  clickable?: boolean;
  /** Show detailed tooltip */
  showTooltip?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom className */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export const ValidationModeBadge: React.FC<ValidationModeBadgeProps> = ({
  clickable = false,
  showTooltip = true,
  size = 'md',
  className
}) => {
  const {
    mode,
    isOnline,
    isOffline,
    txFhirOrgHealthy,
    ontoserverHealthy,
    isLoading,
    toggleMode,
    hasHealthIssues
  } = useValidationMode();

  const handleClick = async () => {
    if (!clickable || isLoading) {
      return;
    }

    try {
      await toggleMode({ reason: 'User clicked badge' });
    } catch (error) {
      console.error('[ValidationModeBadge] Toggle failed:', error);
    }
  };

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  // Mode-specific styling
  const modeConfig = {
    online: {
      icon: <Globe className={iconSizes[size]} />,
      emoji: '🌐',
      label: 'Online',
      bgClass: 'bg-blue-500 hover:bg-blue-600',
      textClass: 'text-white'
    },
    offline: {
      icon: <Package className={iconSizes[size]} />,
      emoji: '📦',
      label: 'Offline',
      bgClass: 'bg-green-600 hover:bg-green-700',
      textClass: 'text-white'
    }
  };

  const config = mode ? modeConfig[mode] : modeConfig.online;

  // Tooltip content
  const tooltipContent = (
    <div className="space-y-2">
      <div className="font-semibold">
        Validation Mode: {config.label}
      </div>
      
      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-2">
          <Globe className="h-3 w-3" />
          <span>tx.fhir.org:</span>
          <span className={txFhirOrgHealthy ? 'text-green-400' : 'text-red-400'}>
            {txFhirOrgHealthy ? '✅ Healthy' : '❌ Unhealthy'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Package className="h-3 w-3" />
          <span>Ontoserver:</span>
          <span className={ontoserverHealthy ? 'text-green-400' : 'text-gray-400'}>
            {ontoserverHealthy ? '✅ Healthy' : '⚪ Not available'}
          </span>
        </div>
      </div>

      {hasHealthIssues && (
        <div className="flex items-center gap-2 text-xs text-yellow-400">
          <AlertTriangle className="h-3 w-3" />
          <span>Health issues detected</span>
        </div>
      )}

      {clickable && (
        <div className="text-xs text-gray-400 pt-1 border-t border-gray-700">
          Click to switch to {isOnline ? 'offline' : 'online'} mode
        </div>
      )}
    </div>
  );

  const badgeContent = (
    <Badge
      variant="secondary"
      className={cn(
        sizeClasses[size],
        config.bgClass,
        config.textClass,
        'font-medium',
        clickable && !isLoading && 'cursor-pointer transition-colors',
        isLoading && 'opacity-70 cursor-wait',
        hasHealthIssues && 'ring-2 ring-yellow-400 ring-offset-2',
        className
      )}
      onClick={handleClick}
    >
      <span className="flex items-center gap-1.5">
        <span>{config.emoji}</span>
        <span>{config.label}</span>
        {isLoading && (
          <span className="inline-block animate-spin">⟳</span>
        )}
        {hasHealthIssues && !isLoading && (
          <AlertTriangle className="h-3 w-3" />
        )}
      </span>
    </Badge>
  );

  if (!showTooltip) {
    return badgeContent;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-gray-900 text-white border-gray-700">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ============================================================================
// Compact variant for headers
// ============================================================================

export const ValidationModeCompactBadge: React.FC<{
  className?: string;
}> = ({ className }) => {
  const { mode, isLoading } = useValidationMode();

  const emoji = mode === 'online' ? '🌐' : '📦';
  const bgColor = mode === 'online' ? 'bg-blue-500' : 'bg-green-600';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-medium text-white',
        bgColor,
        isLoading && 'opacity-70',
        className
      )}
      title={`Validation Mode: ${mode === 'online' ? 'Online' : 'Offline'}`}
    >
      {emoji}
    </span>
  );
};

export default ValidationModeBadge;

