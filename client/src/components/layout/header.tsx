import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, PanelLeft } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import AppIcon from "@/components/ui/app-icon";
import { ValidationAspectsDropdown } from "@/components/ui/validation-aspects-dropdown";

interface ConnectionStatus {
  connected: boolean;
  version?: string;
  error?: string;
}

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
      await queryClient.invalidateQueries();
      toast({
        title: "Data Refreshed",
        description: "All data has been refreshed from the FHIR server.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh data. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 w-screen fixed top-0 left-0 z-50">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center w-64">
          <div className="flex items-center space-x-3">
            <AppIcon size="md" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{title}</h1>
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
        </div>
      </div>
    </header>
  );
}
