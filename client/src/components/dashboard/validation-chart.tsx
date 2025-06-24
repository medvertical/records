import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Expand } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { ResourceStats } from "@shared/schema";

interface ValidationChartProps {
  stats?: ResourceStats;
}

const COLORS = {
  valid: "hsl(159, 84%, 35%)", // --fhir-success
  error: "hsl(0, 84%, 55%)",   // --fhir-error
};

export default function ValidationChart({ stats }: ValidationChartProps) {
  const data = stats ? [
    {
      name: "Valid Resources",
      value: stats.validResources,
      color: COLORS.valid,
    },
    {
      name: "Resources with Errors",
      value: stats.errorResources,
      color: COLORS.error,
    },
  ] : [];

  const totalValidated = (stats?.validResources || 0) + (stats?.errorResources || 0);
  const validPercent = totalValidated > 0 ? ((stats?.validResources || 0) / totalValidated * 100).toFixed(1) : "0";
  const errorPercent = totalValidated > 0 ? ((stats?.errorResources || 0) / totalValidated * 100).toFixed(1) : "0";

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Validation Overview
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4 text-gray-400" />
            </Button>
            <Button variant="ghost" size="sm">
              <Expand className="h-4 w-4 text-gray-400" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length > 0 && totalValidated > 0 ? (
          <>
            <div className="h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value.toLocaleString(), ""]}
                    labelFormatter={(label) => label}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="flex items-center justify-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-fhir-success rounded-full" />
                <span className="text-gray-600">Valid ({validPercent}%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-fhir-error rounded-full" />
                <span className="text-gray-600">Errors ({errorPercent}%)</span>
              </div>
            </div>
          </>
        ) : (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="text-gray-400 mb-2">
                <PieChart className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-500">No validation data available</p>
              <p className="text-sm text-gray-400">Chart will appear when resources are validated</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
