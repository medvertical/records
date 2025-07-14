import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  Server
} from "lucide-react";

interface ServerStatus {
  connected: boolean;
  version?: string;
  error?: string;
}

const navigationItems = [
  { href: "/", label: "Dashboard", icon: ChartPie },
  { href: "/resources", label: "Browse Resources", icon: Database },
  { href: "/profiles", label: "Profile Management", icon: Package },
  { href: "/settings", label: "Settings", icon: Settings },
];

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
  
  const { data: serverStatus } = useQuery<ServerStatus>({
    queryKey: ["/api/fhir/connection/test"],
    refetchInterval: 30000,
  });

  const { data: servers } = useQuery({
    queryKey: ["/api/fhir/servers"],
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: resourceCounts } = useQuery<Record<string, number>>({
    queryKey: ["/api/fhir/resource-counts"],
  });

  // Find the active server
  const activeServer = servers?.find((server: any) => server.isActive);

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
  return (
    <div className="h-full flex flex-col">
      {/* Server Connection Status */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Server Connection</span>
          <Badge 
            variant="secondary"
            className={cn(
              "flex items-center space-x-1 px-2 py-1",
              serverStatus?.connected 
                ? "bg-green-50 text-green-700 border-green-200" 
                : "bg-red-50 text-red-700 border-red-200"
            )}
          >
            <div className={cn(
              "w-2 h-2 rounded-full",
              serverStatus?.connected 
                ? "bg-fhir-success animate-pulse" 
                : "bg-fhir-error"
            )} />
            <span className="text-xs font-medium">
              {serverStatus?.connected ? "Connected" : "Disconnected"}
            </span>
          </Badge>
        </div>
        <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-gray-700 truncate">
              {activeServer?.name || "No Server"}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {activeServer?.url || "Not connected"}
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onChangeServer}
            className="h-auto p-1 text-gray-500 hover:text-fhir-blue hover:bg-gray-100 ml-2 flex-shrink-0"
          >
            <Server className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || 
              (item.href === "/" && location === "/dashboard");
            
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
            {quickAccessItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>
                  <div 
                    className="flex items-center justify-between p-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                    onClick={onItemClick}
                  >
                    <span>{item.label}</span>
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                      {formatCount(resourceCounts?.[item.resourceType] || 0)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
}
