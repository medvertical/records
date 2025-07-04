import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import Dashboard from "@/pages/dashboard";
import ResourceBrowser from "@/pages/resource-browser";
import ResourceDetail from "@/pages/resource-detail";
import { ProfileManagement } from "@/pages/profile-management";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/layout/sidebar";

function Router() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  // Create components with sidebar toggle
  const DashboardWithSidebar = () => (
    <Dashboard onSidebarToggle={isMobile ? toggleSidebar : undefined} />
  );
  
  const ResourceBrowserWithSidebar = () => (
    <ResourceBrowser onSidebarToggle={isMobile ? toggleSidebar : undefined} />
  );
  
  const ResourceDetailWithSidebar = () => (
    <ResourceDetail onSidebarToggle={isMobile ? toggleSidebar : undefined} />
  );

  const ProfileManagementWithSidebar = () => (
    <div className="flex flex-col h-screen">
      {isMobile && (
        <div className="md:hidden border-b bg-white p-4">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      )}
      <div className="flex-1 overflow-auto p-6">
        <ProfileManagement />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      <main className="flex-1 overflow-hidden">
        <Switch>
          <Route path="/" component={DashboardWithSidebar} />
          <Route path="/dashboard" component={DashboardWithSidebar} />
          <Route path="/resources" component={ResourceBrowserWithSidebar} />
          <Route path="/resources/:id" component={ResourceDetailWithSidebar} />
          <Route path="/profiles" component={ProfileManagementWithSidebar} />
          <Route component={NotFound} />
        </Switch>
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
