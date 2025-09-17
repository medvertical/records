import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useServerData } from "@/hooks/use-server-data";
import { cn, formatCount } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ServerConnectionModal from "@/components/settings/server-connection-modal";

import { 
  Database, 
  ChartPie, 
  Settings, 
  HospitalIcon,
  Package,
  Server,
  RefreshCw
} from "lucide-react";

interface ServerStatus {
  connected: boolean;
  version?: string;
  error?: string;
}

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
  
  const { servers, serverStatus, activeServer, isLoading, refreshServerData } = useServerData();
  
  // Debug logging for server status changes
  console.log('[Sidebar] Server data:', { 
    serversCount: servers?.length, 
    activeServer: activeServer?.name, 
    serverStatus: serverStatus?.connected,
    isLoading 
  });
  
  // Log when active server changes
  useEffect(() => {
    if (activeServer) {
      console.log('[Sidebar] Active server changed:', {
        name: activeServer.name,
        url: activeServer.url,
        isActive: activeServer.isActive,
        id: activeServer.id
      });
    } else {
      console.log('[Sidebar] No active server');
    }
  }, [activeServer]);
  
  // Log when servers list changes
  useEffect(() => {
    console.log('[Sidebar] Servers list changed:', servers?.map(s => ({
      id: s.id,
      name: s.name,
      isActive: s.isActive
    })));
  }, [servers]);

  const { data: resourceCounts } = useQuery<Record<string, number>>({
    queryKey: ["/api/fhir/resource-counts"],
    // Keep previous data during refetch to prevent flashing
    keepPreviousData: true,
    staleTime: 0,
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
            location={location}
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
          location={location}
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
  location, 
  onItemClick,
  onChangeServer
}: {
  serverStatus?: ServerStatus;
  resourceCounts?: Record<string, number>;
  activeServer?: any;
  location: string;
  onItemClick?: () => void;
  onChangeServer?: () => void;
}) {
  // Get the current location to make the component reactive to URL changes
  const [currentLocation] = useLocation();
  const [currentUrl, setCurrentUrl] = useState(window.location.href);
  
  // Update currentUrl when location changes
  useEffect(() => {
    setCurrentUrl(window.location.href);
  }, [currentLocation]);
  
  // Also listen for popstate events and manual URL changes
  useEffect(() => {
    const handleUrlChange = () => {
      setCurrentUrl(window.location.href);
    };
    
    // Listen for browser navigation events
    window.addEventListener('popstate', handleUrlChange);
    
    // Also check for URL changes periodically (fallback)
    const interval = setInterval(() => {
      if (window.location.href !== currentUrl) {
        setCurrentUrl(window.location.href);
      }
    }, 100); // Check every 100ms
    
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      clearInterval(interval);
    };
  }, [currentUrl]);
  return (
    <div className="h-full flex flex-col">
      {/* Server Connection Status */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Server Connection</span>
          <div className="flex items-center space-x-1">
            <div className={cn(
              "w-2 h-2 rounded-full transition-colors duration-200",
              activeServer && serverStatus?.connected 
                ? "bg-fhir-success" 
                : activeServer 
                  ? "bg-yellow-500" 
                  : "bg-fhir-error"
            )} />
            <span className={cn(
              "text-xs transition-colors duration-200 font-medium",
              activeServer && serverStatus?.connected 
                ? "text-fhir-success" 
                : activeServer 
                  ? "text-yellow-600" 
                  : "text-fhir-error"
            )}>
              {isLoading ? "Checking..." : 
               activeServer && serverStatus?.connected ? "Connected" : 
               activeServer ? "Configured" : "No Server"}
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
                  {activeServer && (
                    <span className="text-xs text-gray-400 font-normal">
                      (ID: {activeServer.id})
                    </span>
                  )}
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
                  {servers && servers.length > 1 && (
                    <span className="ml-1 text-gray-400">
                      ({servers.length} servers)
                    </span>
                  )}
                </>
              )}
            </div>
            {isLoading && !activeServer ? (
              <div className="flex items-center gap-2 mt-1">
                <div className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-700">
                  🔄 Switching...
                </div>
              </div>
            ) : activeServer && serverStatus ? (
              <div className="flex items-center gap-2 mt-1">
                <div className={cn(
                  "text-xs px-2 py-1 rounded-full font-medium",
                  serverStatus.connected 
                    ? "bg-green-100 text-green-700" 
                    : "bg-red-100 text-red-700"
                )}>
                  {serverStatus.connected ? "✓ Connected" : "✗ Failed"}
                </div>
                {serverStatus.version && (
                  <span className="text-xs text-gray-500">
                    FHIR {serverStatus.version}
                  </span>
                )}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={refreshServerData}
              className="h-auto p-1 text-gray-500 hover:text-fhir-blue hover:bg-gray-100"
              title="Refresh connection status"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
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

        {/* Resource Types Quick Access */}
        <div className="mt-8">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Quick Access
          </h3>
          <ul className="space-y-1">
            {quickAccessItems.map((item) => {
              // Check if this resource type is currently selected
              const url = new URL(currentUrl);
              const selectedType = url.searchParams.get('type');
              const isSelected = selectedType === item.resourceType;
              
              return (
                <li key={item.href}>
                  <Link href={item.href}>
                    <div 
                      className={cn(
                        "flex items-center justify-between p-2 text-sm rounded transition-colors cursor-pointer",
                        isSelected 
                          ? "text-fhir-blue bg-blue-50 font-medium" 
                          : "text-gray-600 hover:bg-gray-100"
                      )}
                      onClick={onItemClick}
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
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
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
