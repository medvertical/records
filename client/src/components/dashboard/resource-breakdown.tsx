import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Filter } from "lucide-react";
import { ResourceStats } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ResourceBreakdownProps {
  stats?: ResourceStats;
}

const resourceColors = {
  Patient: "bg-blue-500",
  Observation: "bg-green-500", 
  Encounter: "bg-purple-500",
  Condition: "bg-orange-500",
  Procedure: "bg-pink-500",
  DiagnosticReport: "bg-indigo-500",
};

export default function ResourceBreakdown({ stats }: ResourceBreakdownProps) {
  const resourceBreakdown = stats?.resourceBreakdown || {};
  const resourceTypes = Object.keys(resourceBreakdown);

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Resource Type Breakdown
          </CardTitle>
          <Button variant="ghost" size="sm">
            <Filter className="h-4 w-4 text-gray-400" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {resourceTypes.length > 0 ? (
          <div className="space-y-4">
            {resourceTypes.map((resourceType) => {
              const data = resourceBreakdown[resourceType];
              const colorClass = resourceColors[resourceType as keyof typeof resourceColors] || "bg-gray-500";
              
              return (
                <div key={resourceType} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={cn("w-3 h-3 rounded-full", colorClass)} />
                    <span className="text-sm font-medium text-gray-700">{resourceType}</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{data.total.toLocaleString()}</p>
                      <p className={cn(
                        "text-xs",
                        data.validPercent >= 90 ? "text-fhir-success" : 
                        data.validPercent >= 70 ? "text-fhir-warning" : "text-fhir-error"
                      )}>
                        {data.validPercent.toFixed(1)}%
                      </p>
                    </div>
                    <div className="w-20">
                      <Progress 
                        value={data.validPercent} 
                        className="h-2"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <Filter className="h-12 w-12 mx-auto" />
            </div>
            <p className="text-gray-500">No resource data available</p>
            <p className="text-sm text-gray-400">Resource breakdown will appear when data is loaded</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
