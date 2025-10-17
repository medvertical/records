import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProfileName } from '@/lib/profile-name-resolver';

export interface ProfileBadgeProps {
  profiles: string | string[]; // Single URL or array of URLs
  maxDisplay?: number; // Max number of profiles to show before "+N more"
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Unified ProfileBadge component for displaying FHIR profiles
 * 
 * Features:
 * - Supports single profile URL or array of profile URLs
 * - Fetches human-readable profile names using profile resolver
 * - Two size variants: sm (validation messages) and md (resource headers)
 * - Enhanced tooltips with profile name, URL, and description
 * - Clickable links to profile documentation
 * - Purple styling to indicate FHIR profiles
 */
export function ProfileBadge({ 
  profiles, 
  maxDisplay = 3, 
  size = 'sm',
  className 
}: ProfileBadgeProps) {
  // Normalize input to always be an array
  const profileArray = Array.isArray(profiles) ? profiles : [profiles];
  
  // Filter out empty/null/undefined profile URLs
  const validProfiles = profileArray.filter(profile => 
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
        return {
          text: 'text-xs',
          padding: 'px-2 py-0.5',
          iconSize: 'h-3 w-3',
          gap: 'gap-1',
        };
      case 'md':
        return {
          text: 'text-sm',
          padding: 'px-2.5 py-1',
          iconSize: 'h-4 w-4',
          gap: 'gap-1.5',
        };
      default:
        return {
          text: 'text-xs',
          padding: 'px-2 py-0.5',
          iconSize: 'h-3 w-3',
          gap: 'gap-1',
        };
    }
  };

  const sizeClasses = getSizeClasses();

  return (
    <div className={cn('flex items-center gap-1 flex-wrap', className)}>
      {profilesToShow.map((profileUrl, index) => (
        <SingleProfileBadge
          key={index}
          profileUrl={profileUrl}
          size={size}
          sizeClasses={sizeClasses}
        />
      ))}
      
      {needsTruncation && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              className={cn(
                'flex items-center font-mono bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 transition-colors',
                sizeClasses.text,
                sizeClasses.padding,
                sizeClasses.gap,
                'opacity-75'
              )}
            >
              <span>+{remainingCount} more</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-xs">
              <p className="font-medium mb-1">Additional Profiles</p>
              <div className="space-y-1">
                {validProfiles.slice(maxDisplay).map((profileUrl, index) => (
                  <RemainingProfileItem key={index} profileUrl={profileUrl} />
                ))}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

/**
 * Single profile badge with async name resolution
 */
function SingleProfileBadge({ 
  profileUrl, 
  size,
  sizeClasses 
}: { 
  profileUrl: string; 
  size: 'sm' | 'md';
  sizeClasses: any;
}) {
  const [profileName, setProfileName] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    async function fetchName() {
      try {
        const name = await getProfileName(profileUrl);
        if (isMounted) {
          setProfileName(name);
        }
      } catch (error) {
        console.error('Failed to get profile name:', error);
        // Fallback to last segment of URL
        const parts = profileUrl.split('/');
        const lastPart = parts[parts.length - 1];
        const fallbackName = lastPart.split('|')[0];
        if (isMounted) {
          setProfileName(fallbackName);
        }
      }
    }

    fetchName();

    return () => {
      isMounted = false;
    };
  }, [profileUrl]);

  const displayName = profileName || 'Profile';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            window.open(profileUrl, '_blank', 'noopener,noreferrer');
          }}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              e.preventDefault();
              window.open(profileUrl, '_blank', 'noopener,noreferrer');
            }
          }}
          className={cn(
            'inline-flex items-center font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-md hover:bg-purple-100 transition-colors cursor-pointer',
            sizeClasses.text,
            sizeClasses.padding,
            sizeClasses.gap
          )}
        >
          <FileText className={cn(sizeClasses.iconSize, 'flex-shrink-0')} />
          <span>{displayName}</span>
          <ExternalLink className={cn(sizeClasses.iconSize, 'flex-shrink-0')} />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-md">
        <div className="space-y-1">
          <p className="font-medium">{profileName || 'FHIR Profile'}</p>
          <p className="text-xs break-all text-muted-foreground">{profileUrl}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Remaining profile item for "+N more" tooltip
 */
function RemainingProfileItem({ profileUrl }: { profileUrl: string }) {
  const [profileName, setProfileName] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    async function fetchName() {
      try {
        const name = await getProfileName(profileUrl);
        if (isMounted) {
          setProfileName(name);
        }
      } catch (error) {
        const parts = profileUrl.split('/');
        const lastPart = parts[parts.length - 1];
        const fallbackName = lastPart.split('|')[0];
        if (isMounted) {
          setProfileName(fallbackName);
        }
      }
    }

    fetchName();

    return () => {
      isMounted = false;
    };
  }, [profileUrl]);

  return (
    <div className="text-xs">
      <p className="font-medium">{profileName || 'Profile'}</p>
      <p className="text-muted-foreground break-all">{profileUrl}</p>
    </div>
  );
}

export default ProfileBadge;
