import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: connectionStatus } = useQuery<ConnectionStatus>({
    queryKey: ["/api/fhir/connection/test"],
    refetchInterval: 30000,
  });

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  const getPageTitle = () => {
    if (location === "/" || location === "/dashboard") return "Dashboard";
    if (location === "/resources") return "Browse Resources";
    if (location.startsWith("/resources/")) return "Resource Details";
    if (location === "/profiles") return "Profile Management";
    if (location === "/settings") return "Settings";
    return "Records";
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
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      <main className="flex-1 overflow-hidden flex flex-col">
        <Header 
          title={getPageTitle()}
          connectionStatus={connectionStatus}
          onSidebarToggle={toggleSidebar}
        />
        <div className="flex-1 overflow-hidden">
          <Switch>
            <Route path="/" component={DashboardComponent} />
            <Route path="/dashboard" component={DashboardComponent} />
            <Route path="/resources" component={ResourceBrowserComponent} />
            <Route path="/resources/:id" component={ResourceDetailComponent} />
            <Route path="/profiles" component={ProfileManagementComponent} />
            <Route path="/settings" component={SettingsComponent} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>
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
