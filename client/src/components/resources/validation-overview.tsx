import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { SeverityIcon } from '@/components/ui/severity-icon';

export interface ValidationSummary {
  totalResources: number;
  validatedCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

interface ValidationOverviewProps {
  validationSummary: ValidationSummary;
  onRevalidate: () => void;
  isRevalidating?: boolean;
}

export function ValidationOverview({
  validationSummary,
  onRevalidate,
  isRevalidating = false,
}: ValidationOverviewProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Validation Overview</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={onRevalidate}
          disabled={isRevalidating}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRevalidating ? 'animate-spin' : ''}`} />
          Revalidate
        </Button>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="grid grid-cols-4 gap-3">
          {/* Total Resources */}
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {validationSummary.totalResources}
            </div>
            <div className="text-xs text-gray-600 mt-0.5">Total Resources</div>
          </div>

          {/* Errors */}
          <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center justify-center gap-1.5">
              <SeverityIcon severity="error" className="h-4 w-4" />
              <div className="text-2xl font-bold text-red-600">
                {validationSummary.errorCount}
              </div>
            </div>
            <div className="text-xs text-red-700 mt-0.5">Errors</div>
          </div>

          {/* Warnings */}
          <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center justify-center gap-1.5">
              <SeverityIcon severity="warning" className="h-4 w-4" />
              <div className="text-2xl font-bold text-yellow-600">
                {validationSummary.warningCount}
              </div>
            </div>
            <div className="text-xs text-yellow-700 mt-0.5">Warnings</div>
          </div>

          {/* Information */}
          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-center gap-1.5">
              <SeverityIcon severity="information" className="h-4 w-4" />
              <div className="text-2xl font-bold text-blue-600">
                {validationSummary.infoCount}
              </div>
            </div>
            <div className="text-xs text-blue-700 mt-0.5">Information</div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-3 text-center text-xs text-gray-600">
          {validationSummary.validatedCount} of {validationSummary.totalResources} resources validated
        </div>
      </CardContent>
    </Card>
  );
}

