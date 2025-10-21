import { Link, useLocation } from "wouter";
import { useServerData } from "@/hooks/use-server-data";
import type { ServerStatus } from "@/hooks/use-server-data";
import { cn, formatCount } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ServerConnectionModal from "@/components/settings/server-connection-modal";
import { useSettingsModalControl } from "@/contexts/settings-modal-context";

import { 
  Database, 
  ChartPie, 
  Settings,
  Loader2, 
  Server
} from "lucide-react";
import { useQuickAccessItems, useQuickAccessCounts } from "@/hooks/use-quick-access-preferences";
import { ManageQuickAccessDialog } from "@/components/dashboard/AddQuickAccessDialog";
import { getResourceTypeIcon } from "@/lib/resource-type-icons";

const navigationItems = [
  { href: "/", label: "Dashboard", icon: ChartPie },
  { href: "/resources", label: "Browse Resources", icon: Database },
];

const settingsItem = { href: "/settings", label: "Settings", icon: Settings };

const quickAccessItems = [
  { href: "/resources?type=Patient", label: "Patients", resourceType: "Patient" },
  { href: "/resources?type=Observation", label: "Observations", resourceType: "Observation" },
  { href: "/resources?type=Encounter", label: "Encounters", resourceType: "Encounter" },
  { href: "/resources?type=Condition", label: "Conditions", resourceType: "Condition" },
];

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ isOpen = false, onToggle }: SidebarProps = {}) {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { open: openSettingsModal } = useSettingsModalControl();
  
  // Helper function for handling item clicks (close sidebar on mobile)
  const onItemClick = () => {
    if (isMobile && onToggle) {
      onToggle();
    }
  };
  
  // Close sidebar on mobile when location changes
  useEffect(() => {
    if (isMobile && isOpen && onToggle) {
      onToggle();
    }
  }, [location]);
  
  const { servers, serverStatus, activeServer, isLoading, isConnectionLoading, refreshServerData } = useServerData();
  // Use actual connection status if available, otherwise fall back to isActive
  const isServerConnected = serverStatus ? serverStatus.connected : (activeServer?.isActive || false);

  // Resource counts are now handled by useQuickAccessCounts in SidebarContent
  // Removed duplicate query that was causing timeouts

  if (isMobile) {
    return (
      <>
        {/* Mobile Overlay */}
        {isOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => onToggle && onToggle()}
          />
        )}

        {/* Mobile Sidebar */}
        <aside className={cn(
          "fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out z-40 md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="h-full flex flex-col">
        <SidebarContent
          serverStatus={serverStatus}
          activeServer={activeServer}
          servers={servers}
          isLoading={isLoading}
          isConnectionLoading={isConnectionLoading}
          refreshServerData={refreshServerData}
          location={location}
          isServerConnected={isServerConnected}
          onItemClick={() => onToggle && onToggle()}
          onChangeServer={() => setIsServerModalOpen(true)}
          addDialogOpen={addDialogOpen}
          setAddDialogOpen={setAddDialogOpen}
          openSettingsModal={openSettingsModal}
        />
          </div>
        </aside>
      </>
    );
  }

  return (
    <aside className={cn(
      "fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out z-30",
      isOpen ? "w-64" : "w-0 overflow-hidden"
    )}>
      <div className="w-64 h-full flex flex-col">
        <SidebarContent 
          serverStatus={serverStatus} 
          activeServer={activeServer}
          servers={servers}
          isLoading={isLoading}
          isConnectionLoading={isConnectionLoading}
          refreshServerData={refreshServerData}
          location={location}
          isServerConnected={isServerConnected}
          onItemClick={onItemClick}
          onChangeServer={() => setIsServerModalOpen(true)}
          addDialogOpen={addDialogOpen}
          setAddDialogOpen={setAddDialogOpen}
          openSettingsModal={openSettingsModal}
        />
      </div>
      
      {/* Server Connection Modal */}
      <ServerConnectionModal
        open={isServerModalOpen}
        onOpenChange={setIsServerModalOpen}
      />
      
      {/* Add Quick Access Dialog */}
      <ManageQuickAccessDialog 
        open={addDialogOpen} 
        onOpenChange={setAddDialogOpen} 
      />
    </aside>
  );
}

function SidebarContent({ 
  serverStatus, 
  activeServer,
  servers,
  isLoading,
  isConnectionLoading,
  refreshServerData,
  location, 
  isServerConnected,
  onItemClick,
  onChangeServer,
  addDialogOpen,
  setAddDialogOpen,
  openSettingsModal
}: {
  serverStatus?: ServerStatus;
  activeServer?: any;
  servers?: any[];
  isLoading?: boolean;
  isConnectionLoading?: boolean;
  refreshServerData?: () => void;
  location: string;
  isServerConnected: boolean;
  onItemClick?: () => void;
  onChangeServer?: () => void;
  openSettingsModal: (tab?: string) => void;
  addDialogOpen: boolean;
  setAddDialogOpen: (open: boolean) => void;
}) {
  // Use the new hook to get user's custom quick access items
  const { data: userQuickAccess, isLoading: isLoadingQuickAccess } = useQuickAccessItems();
  const { data: quickAccessCounts, isLoading: isQuickAccessCountsLoading } = useQuickAccessCounts();

  // Memoize the quick access items to show
  const itemsToShow = useMemo(() => {
    const userQuickAccessItems = userQuickAccess?.quickAccessItems || [];
    const counts = quickAccessCounts?.counts || {};
    return userQuickAccessItems.length > 0 
      ? userQuickAccessItems.map(resourceType => ({
          href: `/resources?type=${resourceType}`,
          label: resourceType,
          resourceType,
          count: counts[resourceType] ?? 0
        }))
      : quickAccessItems;
  }, [userQuickAccess?.quickAccessItems, quickAccessItems, quickAccessCounts]);

  // Determine connection state for UI gating
  // Show "Checking..." only during initial connection test, otherwise show actual status
  const isCheckingConnection = useMemo(() => 
    Boolean(activeServer && isConnectionLoading && !serverStatus), 
    [activeServer, isConnectionLoading, serverStatus]
  );
  const connectionLabel = isCheckingConnection
    ? "Connecting..."
    : isServerConnected
      ? "Connected"
      : activeServer
        ? "Disconnected"
        : "No Server";
  const indicatorColor = isCheckingConnection
    ? "bg-blue-500"
    : isServerConnected
      ? "bg-fhir-success"
      : activeServer
        ? "bg-fhir-error"
        : "bg-fhir-error";
  const connectionTextStyle = isCheckingConnection
    ? "text-blue-600"
    : isServerConnected
      ? "text-fhir-success"
      : activeServer
        ? "text-fhir-error"
        : "text-fhir-error";

  // Debug logging to see connection status changes - temporarily disabled to fix infinite loop
  // useEffect(() => {
  //   console.log('[Sidebar] Connection status update:', {
  //     activeServer: activeServer?.name || 'No active server',
  //     isActive: activeServer?.isActive || false,
  //     serverStatus: serverStatus || 'Not loaded yet',
  //     isServerConnected: isServerConnected || false,
  //     isConnectionLoading: isConnectionLoading || false,
  //     isCheckingConnection: isCheckingConnection || false
  //   });
  // }, [activeServer?.id, serverStatus, isServerConnected, isConnectionLoading, isCheckingConnection]);

  // Get the current location to make the component reactive to URL changes
  const [currentLocation] = useLocation();
  const [urlVersion, setUrlVersion] = useState(0);
  
  // Listen for URL changes to make the component reactive
  useEffect(() => {
    const handleUrlChange = () => {
      setUrlVersion(prev => prev + 1);
    };
    
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);
  
  // Use the current location from wouter to ensure reactivity
  const currentUrl = `${window.location.origin}${currentLocation}`;
  return (
    <div className="h-full flex flex-col">
      {/* Server Connection Status */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Server</span>
          <div className="flex items-center space-x-1">
            <div className={cn(
              "w-2 h-2 rounded-full transition-colors duration-200",
              indicatorColor
            )} />
            <span className={cn(
              "text-xs transition-colors duration-200 font-medium",
              connectionTextStyle
            )}>
              {connectionLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded transition-all duration-200">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex items-center gap-1">
              {activeServer?.name || "No Server"}
              {activeServer?.fhirVersion && (
                <Badge 
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 font-medium bg-gray-100 text-gray-700 hover:bg-gray-100"
                >
                  {activeServer.fhirVersion}
                </Badge>
              )}
              {isLoading && activeServer && (
                <div className="w-2 h-2 border border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {activeServer?.url || "Not connected"}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onChangeServer}
              className="h-auto p-1 text-gray-500 dark:text-gray-400 hover:text-fhir-blue dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Change server connection"
            >
              <Server className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 overflow-y-auto min-h-0">
        {!isServerConnected ? (
          <div className="text-center py-8">
            <Server className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              {activeServer ? "Server Connection Lost" : "No Server Connected"}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {activeServer 
                ? "Reconnect to the FHIR server to access resources and validation features."
                : "Connect to a FHIR server to access resources and validation features."}
            </p>
            <div className="flex flex-col gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={onChangeServer}
                className="w-full"
              >
                <Server className="w-4 h-4 mr-2" />
                {activeServer ? "Reconnect Server" : "Connect Server"}
              </Button>
              {activeServer && refreshServerData && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="w-full"
                  onClick={refreshServerData}
                >
                  Retry Connection
                </Button>
              )}
              {activeServer && serverStatus?.error && (
                <span className="text-xs text-fhir-error">
                  {serverStatus.error}
                </span>
              )}
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || 
                (item.href === "/" && location === "/dashboard") ||
                (item.href === "/resources" && location.startsWith("/resources"));
              
              return (
                <li key={item.href}>
                  {item.href === "/resources" ? (
                    <div 
                      className={cn(
                        "flex items-center space-x-3 p-2 rounded-lg font-medium transition-colors cursor-pointer",
                        isActive 
                          ? "text-fhir-blue bg-blue-50 dark:bg-blue-900/30" 
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                      onClick={() => {
                        // Explicitly navigate to clear any query params
                        // Include default pagination parameters
                        window.history.pushState({}, '', '/resources?page=1&pageSize=20');
                        window.dispatchEvent(new PopStateEvent('popstate'));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        if (onItemClick) onItemClick();
                      }}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                  ) : (
                    <Link href={item.href}>
                      <div 
                        className={cn(
                          "flex items-center space-x-3 p-2 rounded-lg font-medium transition-colors cursor-pointer",
                          isActive 
                            ? "text-fhir-blue bg-blue-50 dark:bg-blue-900/30" 
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                        )}
                        onClick={() => {
                          if (onItemClick) onItemClick();
                        }}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Resource Types Quick Access */}
        {isServerConnected && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3 group">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Quick Access
              </h3>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setAddDialogOpen(true)}
                title="Customize quick access"
              >
                <Settings className="h-4 w-4 text-gray-400" />
              </Button>
            </div>
            <ul className="space-y-1">
              {isLoadingQuickAccess ? (
                <li className="text-sm text-muted-foreground">Loading...</li>
              ) : (
                itemsToShow.map((item) => {
                // Check if this resource type is currently selected
                // Use window.location.search to match how resource-browser.tsx reads the URL
                // Include urlVersion to ensure re-render when URL changes
                const urlParams = new URLSearchParams(window.location.search);
                const selectedType = urlParams.get('type');
                const isSelected = selectedType === item.resourceType;
                
                // Force re-render by referencing urlVersion
                const _ = urlVersion;
                
                const Icon = getResourceTypeIcon(item.resourceType);
                
                return (
                  <li key={item.href}>
                    <div 
                      className={cn(
                        "flex items-center justify-between p-2 text-sm rounded transition-colors cursor-pointer",
                        isSelected 
                          ? "text-fhir-blue bg-blue-50 dark:bg-blue-900/30 font-medium" 
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                      onClick={() => {
                        // Use the same navigation approach as resource browser
                        window.history.pushState({}, '', item.href);
                        window.dispatchEvent(new PopStateEvent('popstate'));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        if (onItemClick) onItemClick();
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                      {quickAccessCounts?.counts && quickAccessCounts.counts[item.resourceType] !== undefined ? (
                        <span className={cn(
                          "text-xs font-medium",
                          isSelected 
                            ? "text-blue-600 dark:text-blue-400" 
                            : "text-gray-400 dark:text-gray-500"
                        )}>
                          {formatCount(quickAccessCounts.counts[item.resourceType])}
                        </span>
                      ) : (
                        <span title="Loading count">
                          <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                        </span>
                      )}
                    </div>
                  </li>
                );
                })
              )}
            </ul>
          </div>
        )}
      </nav>

      {/* Settings at Bottom */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 mt-auto flex-shrink-0">
        <div 
          className={cn(
            "flex items-center space-x-3 p-2 rounded-lg font-medium transition-colors cursor-pointer",
            "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          )}
          onClick={() => {
            openSettingsModal('validation');
            onItemClick();
          }}
        >
          <Settings className="w-4 h-4" />
          <span>{settingsItem.label}</span>
        </div>
      </div>
    </div>
  );
}
