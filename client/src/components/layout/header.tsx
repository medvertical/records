import { Button } from "@/components/ui/button";
import { PanelLeft, AlertTriangle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AppIcon from "@/components/ui/app-icon";
import type { ServerStatus as ConnectionStatus } from "@/hooks/use-server-data";
import { ActivityWidget } from "@/components/layout/activity-widget";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useState } from "react";
import { Link } from "wouter";

interface HeaderProps {
  title: string;
  subtitle?: string;
  connectionStatus?: ConnectionStatus;
  onSidebarToggle?: () => void;
}

export default function Header({ title, subtitle, connectionStatus, onSidebarToggle }: HeaderProps) {
  const { toast } = useToast();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleClearAllValidationResults = async () => {
    console.log('[Header] Starting validation results deletion...');
    
    try {
      // Clear all validation results from database
      const response = await fetch('/api/admin/clear-all-validation-results', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[Header] Validation results cleared:', result);
      
      // Invalidate all validation-related queries to refresh UI
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/validation/results"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/validation/aspects"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/validation/analytics"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/fhir/resources"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/validation-stats"] }),
      ]);
      
      console.log('[Header] Validation results deletion completed');
      
      toast({
        title: "Validation Results Cleared",
        description: `Successfully deleted ${result.totalDeleted} validation records (${result.deleted.results} results, ${result.deleted.messages} messages, ${result.deleted.groups} groups).`,
      });
    } catch (error) {
      console.error('[Header] Validation results clear error:', error);
      toast({
        title: "Clear Failed",
        description: "Failed to clear validation results. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 w-screen fixed top-0 left-0 z-50">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center w-64">
          <Link href="/">
            <div className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity">
              <AppIcon size="md" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
              </div>
            </div>
          </Link>
          {onSidebarToggle && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSidebarToggle}
              className="p-2 ml-auto mr-8"
              aria-label="Toggle sidebar"
            >
              <PanelLeft className="h-5 w-5 text-gray-600" />
            </Button>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {/* Activity Widget */}
          <ActivityWidget />
          
          {/* Clear All Validation Results Button */}
          <Button 
            onClick={() => setConfirmDialogOpen(true)}
            variant="outline"
            size="sm"
            className="flex items-center space-x-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            aria-label="Clear all validation results"
          >
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden lg:inline">Clear Results</span>
          </Button>
          
          {/* Confirmation Dialog */}
          <ConfirmDialog
            open={confirmDialogOpen}
            onOpenChange={setConfirmDialogOpen}
            title="⚠️ Clear All Validation Results?"
            description="This will permanently delete all validation results, messages, and groups from the database. This action cannot be undone."
            onConfirm={handleClearAllValidationResults}
            confirmText="Yes, Delete All"
            cancelText="Cancel"
            variant="destructive"
          />
        </div>
      </div>
    </header>
  );
}
