import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Settings, 
  User, 
  RefreshCw,
  Server,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ModernDashboardHeaderProps {
  serverName?: string;
  serverVersion?: string;
  isConnected?: boolean;
  totalResources?: number;
  lastUpdated?: Date;
  onRefresh?: () => void;
  onSettings?: () => void;
  onUserMenu?: () => void;
}

export const ModernDashboardHeader: React.FC<ModernDashboardHeaderProps> = ({
  serverName = "Production FHIR Server",
  serverVersion = "R4",
  isConnected = true,
  totalResources = 0,
  lastUpdated = new Date(),
  onRefresh,
  onSettings,
  onUserMenu,
}) => {
  const formatResourceCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(0)}K`;
    }
    return count.toString();
  };

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-r from-background to-muted/20">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left Section - Title and Server Info */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <Activity className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  Records Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                  FHIR Validation Platform
                </p>
              </div>
            </div>
            
            <div className="hidden lg:flex items-center space-x-4 pl-6 border-l border-border">
              <div className="flex items-center space-x-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {serverName}
                </span>
                <Badge variant="outline" className="text-xs">
                  {serverVersion}
                </Badge>
              </div>
              
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">Connected</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-600 font-medium">Disconnected</span>
                  </>
                )}
              </div>
              
              <div className="text-sm text-muted-foreground">
                {formatResourceCount(totalResources)} Resources
              </div>
            </div>
          </div>

          {/* Right Section - Actions and Last Updated */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4" />
              <span>Last updated: {formatDistanceToNow(lastUpdated, { addSuffix: true })}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              {onRefresh && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRefresh}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              
              {onSettings && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSettings}
                  className="h-8 w-8 p-0"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              
              {onUserMenu && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onUserMenu}
                  className="h-8 w-8 p-0"
                >
                  <User className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Server Info */}
        <div className="lg:hidden mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{serverName}</span>
              <Badge variant="outline" className="text-xs">
                {serverVersion}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              {isConnected ? (
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-600 font-medium">Connected</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-red-600 font-medium">Disconnected</span>
                </div>
              )}
              
              <span className="text-muted-foreground">
                {formatResourceCount(totalResources)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
