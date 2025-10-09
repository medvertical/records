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
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { ShortcutsHelpDialog } from "@/components/keyboard-shortcuts/shortcuts-help-dialog";

// ConnectionStatus interface is now imported from use-server-data
import type { ServerStatus as ConnectionStatus } from "@/hooks/use-server-data";

function Router() {
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { activeServer, serverStatus, isConnectionLoading } = useServerData();
  
  // Use the centralized server status instead of separate query
  const connectionStatus = serverStatus as ConnectionStatus | undefined;

  // Enable keyboard shortcuts globally
  useKeyboardShortcuts({
    enabled: true,
    showNotifications: false,
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
    return "Records";
  };

  // Component wrappers for routing
  const DashboardComponent = () => (
    <Dashboard />
  );
  
  const ResourceBrowserComponent = () => (
    <ResourceBrowser />
  );

  const ResourceDetailComponent = ({ params }: { params: { id: string } }) => {
    if (!params || !params.id) {
      return <div>Loading...</div>;
    }
    return <ResourceDetail resourceId={params.id} />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Switch>
        <Route path="/resources/:id">
          {(params) => {
            if (!params?.id) {
              return <div className="p-4">No resource ID provided</div>;
            }
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
                    <ResourceDetail resourceId={params.id} />
                  </main>
                </div>
              </div>
            );
          }}
        </Route>
        <Route path="/">
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
                <DashboardComponent />
              </main>
            </div>
          </div>
        </Route>
        <Route path="/dashboard">
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
                <DashboardComponent />
              </main>
            </div>
          </div>
        </Route>
        <Route path="/resources">
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
                <ResourceBrowserComponent />
              </main>
            </div>
          </div>
        </Route>
        <Route path="/packages">
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
                <div className="p-8">
                  <h1 className="text-2xl font-bold mb-4">Package Management</h1>
                  <p className="text-gray-600">Package management functionality coming soon...</p>
                </div>
              </main>
            </div>
          </div>
        </Route>
        <Route path="/settings">
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
                <SettingsPage />
              </main>
            </div>
          </div>
        </Route>
        <Route component={NotFound} />
      </Switch>
      
      {/* Global Keyboard Shortcuts Help Dialog */}
      <ShortcutsHelpDialog />
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
