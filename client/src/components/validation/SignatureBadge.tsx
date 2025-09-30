import { ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useGroupNavigation } from '@/hooks/use-group-navigation';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface SignatureBadgeProps {
  signature: string;
  aspect: string;
  resourceType?: string;
  serverId?: number;
  variant?: 'default' | 'compact' | 'inline';
  showCopy?: boolean;
  showLink?: boolean;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function SignatureBadge({
  signature,
  aspect,
  resourceType,
  serverId,
  variant = 'default',
  showCopy = true,
  showLink = true,
  className,
}: SignatureBadgeProps) {
  const { navigateToGroupMembers } = useGroupNavigation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(signature);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy signature:', error);
    }
  };

  const handleNavigate = () => {
    navigateToGroupMembers({
      signature,
      aspect,
      resourceType,
      serverId,
    });
  };

  // Compact variant - just the signature with minimal controls
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Badge variant="outline" className="font-mono text-xs">
          {signature.substring(0, 12)}...
        </Badge>
        {showLink && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={handleNavigate}
            aria-label="View all resources with this signature"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  // Inline variant - signature as clickable text
  if (variant === 'inline') {
    return (
      <button
        onClick={handleNavigate}
        className={cn(
          'font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1',
          className
        )}
        aria-label={`View all resources with signature ${signature}`}
      >
        <span className="break-all">{signature}</span>
        <ExternalLink className="h-3 w-3 flex-shrink-0" />
      </button>
    );
  }

  // Default variant - full signature with all controls
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <code className="text-xs text-gray-600 font-mono break-all bg-gray-50 px-2 py-1 rounded flex-1 min-w-0">
        {signature}
      </code>
      
      <div className="flex items-center gap-1 flex-shrink-0">
        {showCopy && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {copied ? 'Copied!' : 'Copy signature'}
            </TooltipContent>
          </Tooltip>
        )}
        
        {showLink && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="h-6 px-2 gap-1"
                onClick={handleNavigate}
              >
                <ExternalLink className="h-3 w-3" />
                <span className="text-xs">View Group</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View all resources with this signature</p>
              <p className="text-xs text-gray-400 mt-1">
                Opens group members in resource browser
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
