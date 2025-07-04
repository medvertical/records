import Header from "@/components/layout/header";
import StatCard from "@/components/dashboard/stat-card";
import ValidationChart from "@/components/dashboard/validation-chart";
import RecentErrors from "@/components/dashboard/recent-errors";
import ResourceBreakdown from "@/components/dashboard/resource-breakdown";
import QuickBrowser from "@/components/dashboard/quick-browser";
import { useQuery } from "@tanstack/react-query";
import { ResourceStats } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface ConnectionStatus {
  connected: boolean;
  version?: string;
  error?: string;
}

interface DashboardProps {
  onSidebarToggle?: () => void;
}

export default function Dashboard({ onSidebarToggle }: DashboardProps) {
  const { data: stats, isLoading: statsLoading } = useQuery<ResourceStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: connectionStatus } = useQuery<ConnectionStatus>({
    queryKey: ["/api/fhir/connection/test"],
    refetchInterval: 30000, // Check connection every 30 seconds
  });

  const { data: resourceCounts } = useQuery<Record<string, number>>({
    queryKey: ["/api/fhir/resource-counts"],
  });

  if (statsLoading) {
    return (
      <div className="flex-1 overflow-hidden">
        <Header 
          title="Records"
          connectionStatus={connectionStatus}
          onSidebarToggle={onSidebarToggle}
        />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden">
      <Header 
        title="Records"
        connectionStatus={connectionStatus}
        onSidebarToggle={onSidebarToggle}
      />
      
      <div className="p-6 overflow-y-auto h-full">
        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Resources"
            value={stats?.totalResources || 0}
            icon="database"
            trend={{ value: 12, direction: "up" }}
            subtitle="vs last week"
          />
          <StatCard
            title="Valid Resources"
            value={stats?.validResources || 0}
            icon="check-circle"
            color="success"
            subtitle={`${stats?.totalResources ? ((stats.validResources / stats.totalResources) * 100).toFixed(1) : 0}% validation rate`}
          />
          <StatCard
            title="Validation Errors"
            value={stats?.errorResources || 0}
            icon="exclamation-triangle"
            color="error"
            trend={{ value: 5, direction: "up" }}
            subtitle="new errors"
          />
          <StatCard
            title="Active Profiles"
            value={stats?.activeProfiles || 0}
            icon="shield-alt"
            color="warning"
            subtitle="3 custom profiles"
          />
        </div>

        {/* Dashboard Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ValidationChart stats={stats} />
          <RecentErrors />
          <ResourceBreakdown stats={stats} />
          <QuickBrowser resourceCounts={resourceCounts} />
        </div>
      </div>
    </div>
  );
}
