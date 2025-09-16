import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ValidationTrendData {
  time: string;
  totalValidated: number;
  validResources: number;
  errorResources: number;
  validationRate: number;
}

interface ValidationTrendsProps {
  currentProgress?: {
    processedResources: number;
    validResources: number;
    errorResources: number;
  } | null;
}

export function ValidationTrends({ currentProgress }: ValidationTrendsProps) {
  const [trendData, setTrendData] = useState<ValidationTrendData[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);

  // Update trend data when progress changes
  useEffect(() => {
    if (currentProgress && currentProgress.processedResources > 0) {
      const now = Date.now();
      
      // Only add data point if significant time has passed (every 30 seconds)
      if (now - lastUpdateTime > 30000) {
        const newDataPoint: ValidationTrendData = {
          time: new Date().toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          totalValidated: currentProgress.processedResources,
          validResources: currentProgress.validResources,
          errorResources: currentProgress.errorResources,
          validationRate: currentProgress.validResources / currentProgress.processedResources * 100
        };

        setTrendData(prev => {
          const updated = [...prev, newDataPoint];
          // Keep only last 20 data points to prevent chart from getting too crowded
          return updated.slice(-20);
        });
        
        setLastUpdateTime(now);
      }
    }
  }, [currentProgress, lastUpdateTime]);

  // Calculate trend indicators
  const latestData = trendData && trendData.length > 0 ? trendData[trendData.length - 1] : null;
  const previousData = trendData && trendData.length > 1 ? trendData[trendData.length - 2] : null;
  
  const validationRateTrend = latestData && previousData 
    ? latestData.validationRate - previousData.validationRate
    : 0;
    
  const totalValidatedTrend = latestData && previousData
    ? latestData.totalValidated - previousData.totalValidated
    : 0;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Validation Trends
            </CardTitle>
            <CardDescription>
              Real-time validation progress and quality metrics over time
            </CardDescription>
          </div>
          
          {latestData && (
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                {validationRateTrend > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className="font-medium">
                  {(latestData.validationRate || 0).toFixed(1)}% Valid
                </span>
              </div>
              
              <div className="flex items-center gap-1">
                <Activity className="h-4 w-4 text-blue-500" />
                <span className="font-medium">
                  +{totalValidatedTrend.toLocaleString()} Resources
                </span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {!trendData || trendData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Validation trends will appear here as data is processed</p>
              <p className="text-sm">Start validation to see real-time progress</p>
            </div>
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Resources', angle: -90, position: 'insideLeft' }}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Validation Rate (%)', angle: 90, position: 'insideRight' }}
                />
                <Tooltip 
                  formatter={(value, name) => [
                    typeof value === 'number' ? value.toLocaleString() : value,
                    name
                  ]}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                <Legend />
                
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalValidated"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  name="Total Validated"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="validResources"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  name="Valid Resources"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="errorResources"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                  name="Error Resources"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="validationRate"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                  name="Success Rate %"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}