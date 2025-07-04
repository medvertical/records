import StatCard from "@/components/dashboard/stat-card";
import ValidationChart from "@/components/dashboard/validation-chart";
import RecentErrors from "@/components/dashboard/recent-errors";
import ResourceBreakdown from "@/components/dashboard/resource-breakdown";
import QuickBrowser from "@/components/dashboard/quick-browser";
import { useQuery } from "@tanstack/react-query";
import { ResourceStats } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<ResourceStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: resourceCounts } = useQuery<Record<string, number>>({
    queryKey: ["/api/fhir/resource-counts"],
  });

  if (statsLoading) {
    return (
      <div className="p-6 space-y-6 h-full overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
          trend={{ value: 8, direction: "up" }}
          subtitle="passing validation"
        />
        <StatCard
          title="Validation Errors"
          value={stats?.errorResources || 0}
          icon="alert-circle"
          trend={{ value: 3, direction: "down" }}
          subtitle="requiring attention"
        />
        <StatCard
          title="Active Profiles"
          value={stats?.activeProfiles || 0}
          icon="settings"
          trend={{ value: 2, direction: "up" }}
          subtitle="in use"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Validation Chart - spans 2 columns on large screens */}
        <div className="lg:col-span-2">
          <ValidationChart />
        </div>
        
        {/* Resource Breakdown */}
        <div className="lg:col-span-1">
          <ResourceBreakdown data={stats?.resourceBreakdown} />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Errors */}
        <RecentErrors />
        
        {/* Quick Resource Browser */}
        <QuickBrowser resourceCounts={resourceCounts} />
      </div>
    </div>
  );
}