import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface ValidationStatusChartCardProps {
  data: Record<string, {
    total: number;
    validated: number;
    valid: number;
    errors: number;
    warnings: number;
    unvalidated: number;
    validationRate: number;
    successRate: number;
  }>;
}

export function ValidationStatusChartCard({ data }: ValidationStatusChartCardProps) {
  // Transform data for chart
  const chartData = Object.entries(data)
    .filter(([, stats]) => {
      // Show types that have any validation data, even if incomplete
      return stats.total > 0 || stats.validated > 0 || stats.valid > 0 || stats.errors > 0;
    })
    .map(([type, stats]) => ({
      type,
      valid: stats.valid || 0,
      invalid: stats.errors || 0, // Only errors count as invalid
      warnings: stats.warnings || 0, // Keep for reference
      total: stats.validated || stats.total || 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10); // Show top 10

  const isEmpty = chartData.length === 0;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Validation Status by Type</h3>
          <Badge variant="secondary">{chartData.length} types validated</Badge>
        </div>

        {isEmpty ? (
          <div className="flex items-center justify-center h-80 text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium">No validated resources yet</p>
              <p className="text-sm mt-1">Start a batch validation to see results</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-50" />
              <XAxis
                dataKey="type"
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-card p-3 rounded-lg border shadow-lg">
                        <p className="font-semibold mb-2">{data.type}</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-green-600">Valid:</span>
                            <span className="font-medium">{data.valid}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-red-600">Invalid:</span>
                            <span className="font-medium">{data.invalid}</span>
                          </div>
                          {data.warnings > 0 && (
                            <div className="flex justify-between gap-4">
                              <span className="text-yellow-600">Warnings:</span>
                              <span className="font-medium">{data.warnings}</span>
                            </div>
                          )}
                          <div className="flex justify-between gap-4 pt-1 border-t">
                            <span>Total:</span>
                            <span className="font-medium">{data.total}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="square"
              />
              <Bar dataKey="valid" name="Valid" fill="hsl(142, 76%, 36%)" />
              <Bar dataKey="invalid" name="Invalid" fill="hsl(0, 84%, 60%)" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {!isEmpty && (
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {chartData.reduce((sum, item) => sum + item.valid, 0)}
              </div>
              <div className="text-xs text-muted-foreground">Total Valid</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {chartData.reduce((sum, item) => sum + item.invalid, 0)}
              </div>
              <div className="text-xs text-muted-foreground">Total Invalid</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {chartData.reduce((sum, item) => sum + item.warnings, 0)}
              </div>
              <div className="text-xs text-muted-foreground">Total Warnings</div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

