import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, PanelLeftOpen } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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
    <header className="bg-white shadow-sm border-b border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {onSidebarToggle && (
            <Button
              variant="ghost"
              size="sm"
              className="p-2 md:hidden"
              onClick={onSidebarToggle}
            >
              <PanelLeftOpen className="h-5 w-5 text-gray-600" />
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          {/* Server Health Indicator */}
          {connectionStatus && (
            <Badge 
              variant="secondary"
              className={cn(
                "flex items-center space-x-2 px-3 py-2",
                connectionStatus.connected 
                  ? "bg-green-50 text-green-700 border-green-200" 
                  : "bg-red-50 text-red-700 border-red-200"
              )}
            >
              <div className={cn(
                "w-2 h-2 rounded-full",
                connectionStatus.connected 
                  ? "bg-fhir-success animate-pulse" 
                  : "bg-fhir-error"
              )} />
              <span className="text-sm font-medium">
                {connectionStatus.connected ? "Server Healthy" : "Server Error"}
              </span>
            </Badge>
          )}
          
          {/* Refresh Button */}
          <Button 
            onClick={handleRefresh}
            className="flex items-center space-x-2 bg-fhir-blue text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
