import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, PanelLeft, Trash2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import AppIcon from "@/components/ui/app-icon";
import { ValidationAspectsDropdown } from "@/components/ui/validation-aspects-dropdown";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { ServerStatus as ConnectionStatus } from "@/hooks/use-server-data";

interface HeaderProps {
  title: string;
  subtitle?: string;
  connectionStatus?: ConnectionStatus;
  onSidebarToggle?: () => void;
}

export default function Header({ title, subtitle, connectionStatus, onSidebarToggle }: HeaderProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const handleRefresh = async () => {
    try {
      // First, call the backend to clear resource count caches
      await fetch('/api/dashboard/force-refresh', { method: 'POST' });
      
      // Then invalidate frontend queries to trigger refetch
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/fhir/resource-counts"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/fhir/resource-types"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/fhir-server-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/validation-stats"] }),
      ]);
      
      toast({
        title: "Data Refreshed",
        description: "Resource counts and dashboard data have been refreshed.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClearCache = async () => {
    console.log('[Header] Starting cache clearing process...');
    
    try {
      console.log('[Header] Clearing validation caches...');
      // Clear all validation caches
      const response = await fetch('/api/validation/cache/clear-all', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[Header] Validation cache clear result:', result);
      
      console.log('[Header] Clearing analytics cache...');
      // Also clear analytics cache
      const analyticsResponse = await fetch('/api/validation/analytics/clear-cache', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (analyticsResponse.ok) {
        const analyticsResult = await analyticsResponse.json();
        console.log('[Header] Analytics cache clear result:', analyticsResult);
      }
      
      console.log('[Header] Invalidating frontend query caches...');
      // Invalidate all validation-related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/validation/results"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/validation/aspects"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/validation/analytics"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/fhir/resources"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/validation-stats"] }),
      ]);
      
      console.log('[Header] Cache clearing completed successfully');
      
      // Trigger cache cleared event for other components
      if (typeof window !== 'undefined' && (window as any).triggerCacheCleared) {
        (window as any).triggerCacheCleared();
      }
      
      toast({
        title: "Cache Cleared",
        description: "All validation caches have been cleared successfully.",
      });
    } catch (error) {
      console.error('[Header] Cache clear error:', error);
      toast({
        title: "Cache Clear Failed",
        description: "Failed to clear validation cache. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 w-screen fixed top-0 left-0 z-50">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center w-64">
          <div className="flex items-center space-x-3">
            <AppIcon size="md" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
            </div>
          </div>
          {onSidebarToggle && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSidebarToggle}
              className="p-2 ml-auto mr-8"
            >
              <PanelLeft className="h-5 w-5 text-gray-600" />
            </Button>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {/* Validation Aspects Dropdown */}
          <ValidationAspectsDropdown />
          
          {/* Cache Clear Button */}
          <Button 
            onClick={handleClearCache}
            variant="outline"
            size="sm"
            className="flex items-center space-x-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden lg:inline">Clear Cache</span>
          </Button>
          
          {/* Refresh Button - Keep for now but make it smaller */}
          <Button 
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            className="flex items-center space-x-1"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden lg:inline">Refresh</span>
          </Button>
          
          {/* Theme Toggle - Dark Mode */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
