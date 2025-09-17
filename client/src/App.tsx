import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { useServerData } from "@/hooks/use-server-data";
import { cn } from "@/lib/utils";
import Dashboard from "@/pages/dashboard";
import ResourceBrowser from "@/pages/resource-browser";
import ResourceDetail from "@/pages/resource-detail";
import { ProfileManagement } from "@/pages/profile-management";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

interface ConnectionStatus {
  connected: boolean;
  version?: string;
  error?: string;
}

function Router() {
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { activeServer } = useServerData();
  
  const { data: connectionStatus } = useQuery<ConnectionStatus>({
    queryKey: ["/api/fhir/connection/test"],
    refetchInterval: 30000,
    // Only fetch connection status when there's an active server
    enabled: !!activeServer,
  });

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  const getPageTitle = () => {
    if (location === "/" || location === "/dashboard") return "Records";
    if (location === "/resources") return "Records";
    if (location.startsWith("/resources/")) return "Records";
    if (location === "/packages") return "Records";
    if (location === "/settings") return "Records";
    return "Records";
  };

  const getPageSubtitle = () => {
    if (location === "/" || location === "/dashboard") return "Dashboard";
    if (location === "/resources") return "Browse Resources";
    if (location.startsWith("/resources/")) return "Resource Details";
    if (location === "/packages") return "Package Management";
    if (location === "/settings") return "Settings";
    return undefined;
  };



  // Component wrappers for routing
  const DashboardComponent = () => (
    <Dashboard />
  );
  
  const ResourceBrowserComponent = () => (
    <ResourceBrowser />
  );
  
  const ResourceDetailComponent = () => (
    <ResourceDetail />
  );

  const ProfileManagementComponent = () => (
    <div className="p-6 h-full overflow-auto">
      <ProfileManagement />
    </div>
  );

  const SettingsComponent = () => (
    <div className="p-6 h-full overflow-auto">
      <SettingsPage />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title={getPageTitle()}
        connectionStatus={connectionStatus}
        onSidebarToggle={toggleSidebar}
      />
      <div className="flex pt-16">
        <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
        <main className={cn(
          "flex-1 overflow-hidden relative z-10 transition-all duration-300 ease-in-out",
          sidebarOpen && !isMobile ? "ml-64" : "ml-0"
        )}>
          <Switch>
            <Route path="/" component={DashboardComponent} />
            <Route path="/dashboard" component={DashboardComponent} />
            <Route path="/resources" component={ResourceBrowserComponent} />
            <Route path="/resources/:id" component={ResourceDetailComponent} />
            <Route path="/packages" component={ProfileManagementComponent} />
            <Route path="/settings" component={SettingsComponent} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
