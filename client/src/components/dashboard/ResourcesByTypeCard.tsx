import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ResourcesByTypeCardProps {
  data: Record<string, number>;
}

export function ResourcesByTypeCard({ data }: ResourcesByTypeCardProps) {
  // Sort by count descending
  const sortedTypes = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15); // Show top 15

  const total = Object.values(data).reduce((sum, count) => sum + count, 0);

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Resources by Type</h3>
          <Badge variant="secondary">{sortedTypes.length} types</Badge>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resource Type</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No resources found
                  </TableCell>
                </TableRow>
              ) : (
                sortedTypes.map(([type, count]) => {
                  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
                  return (
                    <TableRow key={type}>
                      <TableCell className="font-medium">{type}</TableCell>
                      <TableCell className="text-right">
                        {count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {percentage}%
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {sortedTypes.length > 0 && (
          <div className="text-sm text-muted-foreground text-right">
            Total: {total.toLocaleString()} resources
          </div>
        )}
      </div>
    </Card>
  );
}

