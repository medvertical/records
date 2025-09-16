import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Database, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface ResourceTypePieChartProps {
  resourceCounts?: Record<string, number>;
}

// Colors for the pie chart segments
const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#eab308', // yellow
];

export function ResourceTypePieChart({ resourceCounts }: ResourceTypePieChartProps) {
  // Transform resource counts into chart data
  const chartData = resourceCounts 
    ? Object.entries(resourceCounts)
        .map(([resourceType, count]) => ({
          name: resourceType,
          value: count,
          percentage: 0 // Will be calculated
        }))
        .sort((a, b) => b.value - a.value) // Sort by count descending
        .slice(0, 12) // Show top 12 resource types
    : [];

  // Calculate total for percentages
  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  
  // Add percentages
  chartData.forEach(item => {
    item.percentage = (item.value / total) * 100;
  });

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{data.name}</p>
          <p className="text-sm text-gray-600">
            {data.value.toLocaleString()} resources ({(data.percentage || 0).toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom label function
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null; // Don't show labels for very small slices
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${((percent || 0) * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-fhir-blue" />
              Resource Type Distribution
            </CardTitle>
            <CardDescription>
              Breakdown of FHIR resource types in your server
            </CardDescription>
          </div>
          <Link href="/resources">
            <Button variant="ghost" size="sm" className="text-fhir-blue hover:text-blue-700">
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      
      <CardContent>
        {!chartData || chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No resource data available</p>
              <p className="text-sm">Resource counts will appear here once data is loaded</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend with counts */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 mb-3">Resource Types</h4>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {chartData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        {item.value.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(item.percentage || 0).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {total > 0 && (
                <div className="pt-2 mt-2 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-900">Total Resources</span>
                    <span className="text-sm font-bold text-gray-900">{total.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}