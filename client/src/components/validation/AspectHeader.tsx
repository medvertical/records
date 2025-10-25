import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, CheckCircle } from 'lucide-react';
import { AspectBadge } from './AspectBadge';

interface AspectHeaderProps {
  aspect: string;
  messageCount?: number;
  isValid?: boolean;
  showChevron?: boolean;
  getAspectDescription: (aspect: string) => string;
  className?: string;
}

/**
 * Reusable header component for validation aspects
 * Can show either:
 * - Message count with chevron (for aspects with messages)
 * - Valid badge (for aspects without messages)
 */
export function AspectHeader({
  aspect,
  messageCount,
  isValid = false,
  showChevron = false,
  getAspectDescription,
  className = '',
}: AspectHeaderProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-0.5">
        <AspectBadge aspect={aspect} showIcon={false} className="text-base" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm">{getAspectDescription(aspect)}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      
      {/* Right side: either message count OR valid badge */}
      {isValid ? (
        <Badge className="bg-green-50 text-fhir-success border-green-200 hover:bg-green-50">
          <CheckCircle className="h-3 w-3 mr-1" />
          Valid
        </Badge>
      ) : (
        messageCount !== undefined && (
          <span className="text-sm text-muted-foreground">
            {messageCount}
          </span>
        )
      )}
    </div>
  );
}

