import StatCard from "@/components/dashboard/stat-card";
import ValidationChart from "@/components/dashboard/validation-chart";
import RecentErrors from "@/components/dashboard/recent-errors";
import ResourceBreakdown from "@/components/dashboard/resource-breakdown";
import QuickBrowser from "@/components/dashboard/quick-browser";
import ServerValidation from "@/components/validation/server-validation";
import { ValidationTrends } from "@/components/dashboard/validation-trends";
import { ResourceTypePieChart } from "@/components/dashboard/resource-type-pie-chart";
import { useQuery } from "@tanstack/react-query";
import { ResourceStats } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useValidationWebSocket } from "@/hooks/use-validation-websocket";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<ResourceStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: resourceCounts } = useQuery<Record<string, number>>({
    queryKey: ["/api/fhir/resource-counts"],
  });

  // Get validation summary for detailed progress
  const { data: validationSummary } = useQuery({
    queryKey: ["/api/validation/bulk/summary"],
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Get real-time validation progress for trends
  const { progress: validationProgress } = useValidationWebSocket();

  if (statsLoading) {
    return (
      <div className="p-6 space-y-6 h-full overflow-y-auto">
        <div className="grid grid-cols-2 gap-6">
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
      <div className="grid grid-cols-2 gap-6 mb-8">
        <StatCard
          title="Total Resources"
          value={resourceCounts ? Object.values(resourceCounts).reduce((sum, count) => sum + count, 0) : 0}
          icon="database"
          subtitle="FHIR resources available"
        />
        <StatCard
          title="Valid Resources"
          value={stats?.validResources || 0}
          icon="check-circle"
          subtitle="passing validation"
        />
        <StatCard
          title="Validation Errors"
          value={stats?.errorResources || 0}
          icon="alert-circle"
          subtitle="requiring attention"
        />
        <StatCard
          title="Active Profiles"
          value={stats?.activeProfiles || 0}
          icon="settings"
          subtitle="validation profiles"
        />
      </div>

      {/* Validation Overview */}
      {validationSummary && (
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Validation Coverage Overview</h2>
            
            {/* Overall Progress */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-900">
                  {validationSummary.validationCoverage?.toFixed(1) || '0'}%
                </div>
                <div className="text-sm text-blue-600">Coverage Complete</div>
                <div className="text-xs text-gray-500 mt-1">
                  {validationSummary.totalValidated?.toLocaleString() || '0'} / {validationSummary.totalResources?.toLocaleString() || '0'}
                </div>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-900">
                  {validationSummary.validResources?.toLocaleString() || '0'}
                </div>
                <div className="text-sm text-green-600">Valid Resources</div>
                <div className="text-xs text-gray-500 mt-1">
                  {validationSummary.totalValidated > 0 ? 
                    `${((validationSummary.validResources / validationSummary.totalValidated) * 100).toFixed(1)}% success rate` : 
                    'No data'
                  }
                </div>
              </div>
              
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-900">
                  {validationSummary.resourcesWithErrors?.toLocaleString() || '0'}
                </div>
                <div className="text-sm text-red-600">With Errors</div>
                <div className="text-xs text-gray-500 mt-1">
                  {validationSummary.totalValidated > 0 ? 
                    `${((validationSummary.resourcesWithErrors / validationSummary.totalValidated) * 100).toFixed(1)}% error rate` : 
                    'No data'
                  }
                </div>
              </div>
            </div>

            {/* Resource Type Progress */}
            {validationSummary.resourceTypeBreakdown && (
              <div>
                <h3 className="text-md font-medium text-gray-800 mb-3">Resource Type Progress</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(validationSummary.resourceTypeBreakdown)
                    .filter(([_, data]) => data.total > 0)
                    .sort(([_, a], [__, b]) => b.coverage - a.coverage)
                    .map(([type, data]) => (
                    <div key={type} className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-gray-800">{type}</span>
                        <span className="text-sm text-gray-600">{data.coverage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${Math.min(data.coverage, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>{data.validated.toLocaleString()} / {data.total.toLocaleString()}</span>
                        <span>{data.valid.toLocaleString()} valid, {data.errors.toLocaleString()} errors</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Validation Chart - spans 2 columns on large screens */}
        <div className="lg:col-span-2">
          <ValidationChart />
        </div>
        
        {/* Resource Breakdown */}
        <div className="lg:col-span-1">
          <ResourceBreakdown stats={stats} />
        </div>
      </div>

      {/* Server Validation Section */}
      <div className="mb-8">
        <ServerValidation />
      </div>

      {/* Validation Trends Section */}
      <div className="mb-8">
        <ValidationTrends currentProgress={validationProgress} />
      </div>

      {/* Resource Type Distribution */}
      <div className="mb-8">
        <ResourceTypePieChart resourceCounts={resourceCounts} />
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