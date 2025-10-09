import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DashboardHeaderProps } from '@/shared/types/dashboard-new';
import { Settings, User, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { ValidationModeBadge } from '@/components/validation/ValidationModeBadge';

/**
 * DashboardHeader Component - Single responsibility: Display server status and user menu
 * Follows global rules: Single responsibility, under 400 lines, uses existing UI components
 */
export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  serverName,
  serverVersion,
  connected,
  lastUpdated,
  totalResources,
  onSettingsClick,
  onUserMenuClick,
}) => {
  const formatLastUpdated = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (60000));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const formatResourceCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <header className="dashboard-header">
      <div className="flex items-center justify-between w-full">
        {/* Left Section - App Title and Server Status */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="text-2xl">🏥</div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Records Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                FHIR Validation Platform
              </p>
            </div>
          </div>
          
          {/* Server Status */}
          <div className="flex items-center space-x-2">
            <div className="h-px bg-border w-8" />
            <div className="flex items-center space-x-2">
              {connected ? (
                <Wifi className="h-4 w-4 text-fhir-success" />
              ) : (
                <WifiOff className="h-4 w-4 text-fhir-error" />
              )}
              <div className="text-sm">
                <div className="font-medium">
                  {serverName || 'No Server'}
                </div>
                <div className="text-muted-foreground">
                  {connected ? (
                    <>
                      {serverVersion && `${serverVersion} • `}
                      {formatResourceCount(totalResources)} Resources
                    </>
                  ) : (
                    'Disconnected'
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section - Last Updated and Actions */}
        <div className="flex items-center space-x-4">
          {/* Last Updated */}
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
            <span>Last updated: {formatLastUpdated(lastUpdated)}</span>
          </div>

          {/* Connection Status Badge */}
          <Badge 
            variant={connected ? "default" : "destructive"}
            className={cn(
              connected 
                ? "bg-fhir-success/10 text-fhir-success border-fhir-success/20" 
                : "bg-fhir-error/10 text-fhir-error border-fhir-error/20"
            )}
          >
            {connected ? "Connected" : "Disconnected"}
          </Badge>

          {/* Task 3.8: Validation Mode Badge */}
          <ValidationModeBadge 
            clickable={true}
            showTooltip={true}
            size="md"
          />

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onSettingsClick}
              className="flex items-center space-x-1"
              aria-label="Open settings"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onUserMenuClick}
              className="flex items-center space-x-1"
              aria-label="Open user menu"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">User</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

/**
 * Compact Header for Mobile - Simplified version for smaller screens
 */
interface CompactHeaderProps {
  serverName: string;
  connected: boolean;
  totalResources: number;
  onMenuClick: () => void;
  onSettingsClick: () => void;
}

export const CompactHeader: React.FC<CompactHeaderProps> = ({
  serverName,
  connected,
  totalResources,
  onMenuClick,
  onSettingsClick,
}) => {
  const formatResourceCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <header className="dashboard-header-mobile">
      <div className="flex items-center justify-between w-full">
        {/* Left - Menu and Title */}
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            className="p-2"
            aria-label="Open navigation menu"
          >
            <div className="w-5 h-5 flex flex-col justify-center space-y-1">
              <div className="w-full h-0.5 bg-current"></div>
              <div className="w-full h-0.5 bg-current"></div>
              <div className="w-full h-0.5 bg-current"></div>
            </div>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Records</h1>
          </div>
        </div>

        {/* Center - Server Status */}
        <div className="flex items-center space-x-2">
          {connected ? (
            <Wifi className="h-4 w-4 text-fhir-success" />
          ) : (
            <WifiOff className="h-4 w-4 text-fhir-error" />
          )}
          <span className="text-sm font-medium">
            {serverName || 'No Server'}
          </span>
          {connected && (
            <Badge variant="outline" className="text-xs">
              {formatResourceCount(totalResources)}
            </Badge>
          )}
        </div>

        {/* Right - Actions */}
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSettingsClick}
            className="p-2"
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="p-2"
            aria-label="User menu"
          >
            <User className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

/**
 * Server Status Indicator - Reusable component for showing connection status
 */
interface ServerStatusIndicatorProps {
  connected: boolean;
  serverName: string;
  serverVersion?: string;
  totalResources?: number;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export const ServerStatusIndicator: React.FC<ServerStatusIndicatorProps> = ({
  connected,
  serverName,
  serverVersion,
  totalResources,
  size = 'md',
  showDetails = true,
}) => {
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const formatResourceCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className={cn("flex items-center space-x-2", sizeClasses[size])}>
      {connected ? (
        <Wifi className={cn("text-fhir-success", iconSizes[size])} />
      ) : (
        <WifiOff className={cn("text-fhir-error", iconSizes[size])} />
      )}
      
      <div>
        <div className="font-medium">
          {serverName || 'No Server'}
        </div>
        {showDetails && (
          <div className="text-muted-foreground">
            {connected ? (
              <>
                {serverVersion && `${serverVersion} • `}
                {totalResources && `${formatResourceCount(totalResources)} Resources`}
              </>
            ) : (
              'Disconnected'
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardHeader;
