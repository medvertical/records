import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { useServerData } from "@/hooks/use-server-data";
import { useServerReactiveQueries } from "@/hooks/use-server-reactive-queries";
import { useGlobalErrorHandler } from "@/hooks/use-global-error-handler";
import { cn } from "@/lib/utils";
import Dashboard from "@/pages/dashboard";
import ResourceBrowser from "@/pages/resource-browser";
import ResourceDetail from "@/pages/resource-detail";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useKeyboardShortcuts, useKeyboardShortcutListener } from "@/hooks/use-keyboard-shortcuts";
import { ValidationActivityProvider } from "@/contexts/validation-activity-context";
import { ShortcutsHelpDialog } from "@/components/keyboard-shortcuts/shortcuts-help-dialog";
import { SettingsModalProvider, useSettingsModalControl } from "@/contexts/settings-modal-context";
import { SettingsModal } from "@/components/settings/SettingsModal";

// ConnectionStatus interface is now imported from use-server-data
import type { ServerStatus as ConnectionStatus } from "@/hooks/use-server-data";

/**
 * Global error handler component that monitors all queries
 */
function GlobalErrorHandler() {
  useGlobalErrorHandler();
  return null;
}

function Router() {
  const isMobile = useIsMobile();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const prevLocationRef = useRef<string>(location);

  const { activeServer, serverStatus, isConnectionLoading } = useServerData();
  const { isOpen, setIsOpen, activeTab, open } = useSettingsModalControl();
  
  // Enable automatic cache invalidation when server changes
  useServerReactiveQueries();
  
  // Use the centralized server status instead of separate query
  const connectionStatus = serverStatus as ConnectionStatus | undefined;

  // Handle /settings route by opening modal
  useEffect(() => {
    if (location === '/settings') {
      open('validation');
      setLocation('/');
    }
  }, [location, open, setLocation]);

  // Enable keyboard shortcuts globally
  useKeyboardShortcuts({
    enabled: true,
    showNotifications: false,
  });

  // Listen for settings modal shortcut
  useKeyboardShortcutListener('open-settings-modal', () => {
    open('validation');
  });

  // Scroll to top when location pathname changes (not query params)
  useEffect(() => {
    const currentPath = location.split('?')[0];
    const prevPath = prevLocationRef.current.split('?')[0];
    
    if (currentPath !== prevPath) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    prevLocationRef.current = location;
  }, [location]);

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  const getPageTitle = () => {
    if (location === "/" || location === "/dashboard") return "Records";
    if (location === "/resources") return "Records";
    if (location.startsWith("/resources/")) return "Records";
    if (location === "/settings") return "Records";
    return "Records";
  };

  const getPageSubtitle = () => {
    if (location === "/" || location === "/dashboard") return "Dashboard";
    if (location === "/resources") return "Browse Resources";
    if (location.startsWith("/resources/")) return "Resource Details";
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
        <Route path="/resources/:type/:id">
          {(params) => {
            if (!params?.type || !params?.id) {
              return <div className="p-4">Invalid resource URL</div>;
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
                    "flex-1 relative z-10 transition-all duration-300 ease-in-out",
                    sidebarOpen && !isMobile ? "ml-64" : "ml-0"
                  )}>
                    <ResourceDetail />
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
                "flex-1 relative z-10 transition-all duration-300 ease-in-out",
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
                "flex-1 relative z-10 transition-all duration-300 ease-in-out",
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
                "flex-1 relative z-10 transition-all duration-300 ease-in-out",
                sidebarOpen && !isMobile ? "ml-64" : "ml-0"
              )}>
                <ResourceBrowserComponent />
              </main>
            </div>
          </div>
        </Route>
        <Route component={NotFound} />
      </Switch>
      
      {/* Global Keyboard Shortcuts Help Dialog */}
      <ShortcutsHelpDialog />
      
      {/* Global Settings Modal */}
      <SettingsModal 
        open={isOpen} 
        onOpenChange={setIsOpen}
        defaultTab={activeTab}
      />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalErrorHandler />
      <TooltipProvider>
        <ValidationActivityProvider>
          <SettingsModalProvider>
            <Toaster />
            <Router />
          </SettingsModalProvider>
        </ValidationActivityProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
