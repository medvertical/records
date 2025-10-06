import React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Pause, 
  Square,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ValidationStatus = 
  | 'idle' 
  | 'running' 
  | 'paused' 
  | 'completed' 
  | 'error' 
  | 'stopped' 
  | 'initializing' 
  | 'connecting' 
  | 'disconnected';

export type ValidationStatusVariant = 
  | 'default' 
  | 'secondary' 
  | 'destructive' 
  | 'outline' 
  | 'success' 
  | 'warning' 
  | 'info';

interface ValidationStatusBadgeProps {
  status: ValidationStatus;
  variant?: ValidationStatusVariant;
  showIcon?: boolean;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
  customText?: string;
}

/**
 * ValidationStatusBadge Component - Comprehensive status indicator for validation operations
 */
export const ValidationStatusBadge: React.FC<ValidationStatusBadgeProps> = ({
  status,
  variant,
  showIcon = true,
  showText = true,
  size = 'md',
  animated = true,
  className,
  customText,
}) => {
  // Get status configuration
  const getStatusConfig = (status: ValidationStatus) => {
    switch (status) {
      case 'idle':
        return {
          icon: Clock,
          text: 'Idle',
          variant: 'outline' as ValidationStatusVariant,
          color: 'text-gray-500',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
        };
      case 'running':
        return {
          icon: Activity,
          text: 'Running',
          variant: 'default' as ValidationStatusVariant,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
        };
      case 'paused':
        return {
          icon: Pause,
          text: 'Paused',
          variant: 'secondary' as ValidationStatusVariant,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
        };
      case 'completed':
        return {
          icon: CheckCircle,
          text: 'Completed',
          variant: 'success' as ValidationStatusVariant,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
        };
      case 'error':
        return {
          icon: XCircle,
          text: 'Error',
          variant: 'destructive' as ValidationStatusVariant,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
        };
      case 'stopped':
        return {
          icon: Square,
          text: 'Stopped',
          variant: 'secondary' as ValidationStatusVariant,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
        };
      case 'initializing':
        return {
          icon: Loader2,
          text: 'Initializing',
          variant: 'info' as ValidationStatusVariant,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
        };
      case 'connecting':
        return {
          icon: Loader2,
          text: 'Connecting',
          variant: 'info' as ValidationStatusVariant,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
        };
      case 'disconnected':
        return {
          icon: AlertCircle,
          text: 'Disconnected',
          variant: 'destructive' as ValidationStatusVariant,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
        };
      default:
        return {
          icon: AlertTriangle,
          text: 'Unknown',
          variant: 'outline' as ValidationStatusVariant,
          color: 'text-gray-500',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
        };
    }
  };

  const config = getStatusConfig(status);
  const IconComponent = config.icon;
  const displayText = customText || config.text;
  const badgeVariant = variant || config.variant;

  // Get size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'px-2 py-1 text-xs',
          icon: 'h-3 w-3',
          text: 'text-xs',
        };
      case 'lg':
        return {
          container: 'px-4 py-2 text-base',
          icon: 'h-5 w-5',
          text: 'text-base',
        };
      default: // md
        return {
          container: 'px-3 py-1.5 text-sm',
          icon: 'h-4 w-4',
          text: 'text-sm',
        };
    }
  };

  const sizeClasses = getSizeClasses();

  // Get animation classes
  const getAnimationClasses = () => {
    if (!animated) return '';
    
    switch (status) {
      case 'running':
      case 'initializing':
      case 'connecting':
        return 'animate-pulse';
      default:
        return '';
    }
  };

  const animationClasses = getAnimationClasses();

  // Get icon animation classes
  const getIconAnimationClasses = () => {
    if (!animated) return '';
    
    switch (status) {
      case 'running':
      case 'initializing':
      case 'connecting':
        return 'animate-spin';
      default:
        return '';
    }
  };

  const iconAnimationClasses = getIconAnimationClasses();

  return (
    <Badge 
      variant={badgeVariant}
      className={cn(
        'inline-flex items-center gap-1.5 font-medium transition-all duration-200',
        sizeClasses.container,
        config.bgColor,
        config.borderColor,
        config.color,
        animationClasses,
        className
      )}
    >
      {showIcon && (
        <IconComponent 
          className={cn(
            sizeClasses.icon,
            iconAnimationClasses
          )} 
        />
      )}
      {showText && (
        <span className={sizeClasses.text}>
          {displayText}
        </span>
      )}
    </Badge>
  );
};

/**
 * CompactValidationStatusBadge Component - Minimal status indicator
 */
interface CompactValidationStatusBadgeProps {
  status: ValidationStatus;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

export const CompactValidationStatusBadge: React.FC<CompactValidationStatusBadgeProps> = ({
  status,
  size = 'sm',
  animated = true,
  className,
}) => {
  return (
    <ValidationStatusBadge
      status={status}
      size={size}
      animated={animated}
      showText={false}
      className={className}
    />
  );
};

/**
 * ValidationStatusIndicator Component - Status indicator with additional context
 */
interface ValidationStatusIndicatorProps {
  status: ValidationStatus;
  showProgress?: boolean;
  progress?: number;
  showDetails?: boolean;
  details?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ValidationStatusIndicator: React.FC<ValidationStatusIndicatorProps> = ({
  status,
  showProgress = false,
  progress = 0,
  showDetails = false,
  details,
  size = 'md',
  className,
}) => {
  const getStatusConfig = (status: ValidationStatus) => {
    switch (status) {
      case 'idle':
        return { text: 'Idle', color: 'text-gray-500' };
      case 'running':
        return { text: 'Running', color: 'text-blue-600' };
      case 'paused':
        return { text: 'Paused', color: 'text-yellow-600' };
      case 'completed':
        return { text: 'Completed', color: 'text-green-600' };
      case 'error':
        return { text: 'Error', color: 'text-red-600' };
      case 'stopped':
        return { text: 'Stopped', color: 'text-gray-600' };
      case 'initializing':
        return { text: 'Initializing', color: 'text-blue-600' };
      case 'connecting':
        return { text: 'Connecting', color: 'text-blue-600' };
      case 'disconnected':
        return { text: 'Disconnected', color: 'text-red-600' };
      default:
        return { text: 'Unknown', color: 'text-gray-500' };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <ValidationStatusBadge
        status={status}
        size={size}
        showText={true}
      />
      
      {showProgress && progress > 0 && (
        <div className="flex items-center gap-1">
          <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{progress}%</span>
        </div>
      )}
      
      {showDetails && details && (
        <span className="text-xs text-gray-500">{details}</span>
      )}
    </div>
  );
};

export default ValidationStatusBadge;
