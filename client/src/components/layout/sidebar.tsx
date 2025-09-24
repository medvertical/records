import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useServerData } from "@/hooks/use-server-data";
import type { ServerStatus } from "@/hooks/use-server-data";
import { cn, formatCount } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import ServerConnectionModal from "@/components/settings/server-connection-modal";

import { 
  Database, 
  ChartPie, 
  Settings, 
  Package,
  Server
} from "lucide-react";

const navigationItems = [
  { href: "/", label: "Dashboard", icon: ChartPie },
  { href: "/resources", label: "Browse Resources", icon: Database },
  { href: "/packages", label: "Package Management", icon: Package },
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
  
  // Close sidebar on mobile when location changes
  useEffect(() => {
    if (isMobile && isOpen && onToggle) {
      onToggle();
    }
  }, [location]);
  
  const { servers, serverStatus, activeServer, isLoading, isConnectionLoading, refreshServerData } = useServerData();
  // Use actual connection status if available, otherwise fall back to isActive
  const isServerConnected = serverStatus ? serverStatus.connected : (activeServer?.isActive || false);

  const { data: resourceCounts } = useQuery<Record<string, number>>({
    queryKey: ["/api/fhir/resource-counts"],
    // Keep previous data to prevent flickering during refetches
    keepPreviousData: true,
    staleTime: 10 * 60 * 1000, // Consider data fresh for 10 minutes
    refetchInterval: false, // Disable automatic refetching
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
    // Only fetch resource counts when there's an active server
    enabled: isServerConnected,
    queryFn: async () => {
      const response = await fetch('/api/fhir/resource-counts');
      const data = await response.json();
      
      // Transform the API response format to the expected format
      const counts: Record<string, number> = {};
      if (data.resourceTypes && Array.isArray(data.resourceTypes)) {
        data.resourceTypes.forEach((item: { resourceType: string; count: number }) => {
          counts[item.resourceType] = item.count;
        });
      }
      
      return counts;
    },
  });

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
          "fixed left-0 top-16 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out z-40 md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}>
        <SidebarContent 
          serverStatus={serverStatus} 
          resourceCounts={resourceCounts} 
          activeServer={activeServer}
          servers={servers}
          isLoading={isLoading}
          isConnectionLoading={isConnectionLoading}
          refreshServerData={refreshServerData}
          location={location}
          isServerConnected={isServerConnected}
          onItemClick={() => onToggle && onToggle()}
          onChangeServer={() => setIsServerModalOpen(true)}
        />
        </aside>
      </>
    );
  }

  return (
    <aside className={cn(
      "fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 transition-all duration-300 ease-in-out z-30 overflow-y-auto",
      isOpen ? "w-64" : "w-0 overflow-hidden"
    )}>
      <div className="w-64">
        <SidebarContent 
          serverStatus={serverStatus} 
          resourceCounts={resourceCounts} 
          activeServer={activeServer}
          servers={servers}
          isLoading={isLoading}
          isConnectionLoading={isConnectionLoading}
          refreshServerData={refreshServerData}
          location={location}
          isServerConnected={isServerConnected}
          onChangeServer={() => setIsServerModalOpen(true)}
        />
      </div>
      
      {/* Server Connection Modal */}
      <ServerConnectionModal
        open={isServerModalOpen}
        onOpenChange={setIsServerModalOpen}
      />
    </aside>
  );
}

function SidebarContent({ 
  serverStatus, 
  resourceCounts, 
  activeServer,
  servers,
  isLoading,
  isConnectionLoading,
  refreshServerData,
  location, 
  isServerConnected,
  onItemClick,
  onChangeServer
}: {
  serverStatus?: ServerStatus;
  resourceCounts?: Record<string, number>;
  activeServer?: any;
  servers?: any[];
  isLoading?: boolean;
  isConnectionLoading?: boolean;
  refreshServerData?: () => void;
  location: string;
  isServerConnected: boolean;
  onItemClick?: () => void;
  onChangeServer?: () => void;
}) {
  // Determine connection state for UI gating
  // Show "Checking..." only during initial connection test, otherwise show actual status
  const isCheckingConnection = Boolean(activeServer && isConnectionLoading && !serverStatus);
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

  // Debug logging to see connection status changes
  useEffect(() => {
    console.log('[Sidebar] Connection status update:', {
      activeServer: activeServer?.name || 'No active server',
      isActive: activeServer?.isActive || false,
      serverStatus: serverStatus || 'Not loaded yet',
      isServerConnected: isServerConnected || false,
      isConnectionLoading: isConnectionLoading || false,
      isCheckingConnection: isCheckingConnection || false
    });
  }, [activeServer?.id, serverStatus, isServerConnected, isConnectionLoading, isCheckingConnection]);

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
          <span className="text-sm font-medium text-gray-700">Server Connection</span>
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
        <div className={cn(
          "flex items-center justify-between bg-gray-50 p-2 rounded transition-all duration-200",
          isLoading && "bg-blue-50 border border-blue-200"
        )}>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-gray-700 truncate flex items-center gap-1">
              {isLoading && !activeServer ? (
                <span className="text-gray-500">Switching servers...</span>
              ) : (
                <>
                  {activeServer?.name || "No Server"}
                </>
              )}
              {isLoading && activeServer && (
                <div className="w-2 h-2 border border-gray-300 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {isLoading && !activeServer ? (
                <span className="text-gray-400">Updating connection...</span>
              ) : (
                <>
                  {activeServer?.url || "Not connected"}
                </>
              )}
            </div>
            {isLoading && !activeServer ? (
              <div className="flex items-center gap-2 mt-1">
                <div className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-700">
                  🔄 Switching...
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onChangeServer}
              className="h-auto p-1 text-gray-500 hover:text-fhir-blue hover:bg-gray-100"
              title="Change server connection"
            >
              <Server className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
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
                  <Link href={item.href}>
                    <div 
                      className={cn(
                        "flex items-center space-x-3 p-2 rounded-lg font-medium transition-colors cursor-pointer",
                        isActive 
                          ? "text-fhir-blue bg-blue-50" 
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                      onClick={onItemClick}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* Resource Types Quick Access */}
        {isServerConnected && (
          <div className="mt-8">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Quick Access
            </h3>
            <ul className="space-y-1">
              {quickAccessItems.map((item) => {
                // Check if this resource type is currently selected
                // Use window.location.search to match how resource-browser.tsx reads the URL
                // Include urlVersion to ensure re-render when URL changes
                const urlParams = new URLSearchParams(window.location.search);
                const selectedType = urlParams.get('type');
                const isSelected = selectedType === item.resourceType;
                
                // Force re-render by referencing urlVersion
                const _ = urlVersion;
                
                // Debug logging
                if (item.resourceType === 'Encounter' || item.resourceType === 'Patient' || item.resourceType === 'Observation') {
                  console.log('[Sidebar] Quick access item:', {
                    resourceType: item.resourceType,
                    selectedType,
                    isSelected,
                    urlVersion,
                    search: window.location.search
                  });
                }
                
                return (
                  <li key={item.href}>
                    <div 
                      className={cn(
                        "flex items-center justify-between p-2 text-sm rounded transition-colors cursor-pointer",
                        isSelected 
                          ? "text-fhir-blue bg-blue-50 font-medium" 
                          : "text-gray-600 hover:bg-gray-100"
                      )}
                      onClick={() => {
                        // Use the same navigation approach as resource browser
                        window.history.pushState({}, '', item.href);
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }}
                    >
                        <span>{item.label}</span>
                        {resourceCounts && resourceCounts[item.resourceType] ? (
                          <span className={cn(
                            "text-xs font-medium",
                            isSelected 
                              ? "text-blue-600" 
                              : "text-gray-400"
                          )}>
                            {formatCount(resourceCounts[item.resourceType])}
                          </span>
                        ) : (
                          <div className="w-4 h-4 border border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                        )}
                      </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>

      {/* Settings at Bottom */}
      <div className="p-4 border-t border-gray-200 mt-auto">
        <Link href={settingsItem.href}>
          <div 
            className={cn(
              "flex items-center space-x-3 p-2 rounded-lg font-medium transition-colors cursor-pointer",
              location === settingsItem.href 
                ? "text-fhir-blue bg-blue-50" 
                : "text-gray-700 hover:bg-gray-100"
            )}
            onClick={onItemClick}
          >
            <Settings className="w-4 h-4" />
            <span>{settingsItem.label}</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
