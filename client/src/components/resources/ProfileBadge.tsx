import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProfileBadgeProps {
  profiles: string[];
  maxDisplay?: number; // Max number of profiles to show before "+N more"
  size?: 'sm' | 'md';
  variant?: 'default' | 'outline';
  className?: string;
}

/**
 * Extracts the last segment of a profile URL for display
 * e.g., "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient" -> "us-core-patient"
 */
function extractProfileName(profileUrl: string): string {
  try {
    // Remove trailing slash if present
    const cleanUrl = profileUrl.replace(/\/$/, '');
    // Get the last segment after the final slash
    const lastSegment = cleanUrl.split('/').pop() || '';
    
    // If it's a StructureDefinition URL, remove the "StructureDefinition/" part
    if (lastSegment.includes('StructureDefinition')) {
      const parts = cleanUrl.split('/');
      const structureDefIndex = parts.indexOf('StructureDefinition');
      if (structureDefIndex !== -1 && structureDefIndex < parts.length - 1) {
        return parts[structureDefIndex + 1];
      }
    }
    
    return lastSegment || profileUrl;
  } catch (error) {
    // Fallback to original URL if parsing fails
    return profileUrl;
  }
}

/**
 * ProfileBadge component for displaying FHIR profile information
 * 
 * Features:
 * - Extracts readable profile names from URLs
 * - Shows tooltip with full URL on hover
 * - Supports truncation with "+N more" for long lists
 * - Different sizes for different contexts
 * - Handles empty/null/undefined profile arrays gracefully
 */
export function ProfileBadge({ 
  profiles, 
  maxDisplay = 3, 
  size = 'sm', 
  variant = 'outline',
  className 
}: ProfileBadgeProps) {
  // Handle empty or invalid profiles
  if (!profiles || !Array.isArray(profiles) || profiles.length === 0) {
    return null;
  }

  // Filter out empty/null/undefined profile URLs
  const validProfiles = profiles.filter(profile => 
    profile && typeof profile === 'string' && profile.trim().length > 0
  );

  if (validProfiles.length === 0) {
    return null;
  }

  // Determine which profiles to show and if we need truncation
  const profilesToShow = validProfiles.slice(0, maxDisplay);
  const remainingCount = validProfiles.length - maxDisplay;
  const needsTruncation = remainingCount > 0;

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs px-2 py-0.5';
      case 'md':
        return 'text-sm px-2.5 py-1';
      default:
        return 'text-xs px-2 py-0.5';
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'default':
        return 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200';
      case 'outline':
        return 'border-purple-300 text-purple-700 hover:bg-purple-50';
      default:
        return 'border-purple-300 text-purple-700 hover:bg-purple-50';
    }
  };

  return (
    <div className={cn('flex items-center gap-1 flex-wrap', className)}>
      {profilesToShow.map((profileUrl, index) => {
        const profileName = extractProfileName(profileUrl);
        
        return (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <Badge
                variant={variant}
                className={cn(
                  'flex items-center gap-1 font-mono',
                  getSizeClasses(),
                  getVariantClasses()
                )}
              >
                <FileText className="h-3 w-3" />
                <span>{profileName}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="max-w-xs">
                <p className="font-medium">FHIR Profile</p>
                <p className="text-sm break-all">{profileUrl}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
      
      {needsTruncation && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={variant}
              className={cn(
                'flex items-center gap-1 font-mono',
                getSizeClasses(),
                getVariantClasses(),
                'opacity-75'
              )}
            >
              <span>+{remainingCount} more</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-xs">
              <p className="font-medium">Additional Profiles</p>
              <div className="space-y-1">
                {validProfiles.slice(maxDisplay).map((profileUrl, index) => (
                  <p key={index} className="text-xs break-all">
                    {extractProfileName(profileUrl)}
                  </p>
                ))}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export default ProfileBadge;
