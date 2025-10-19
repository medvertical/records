import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Play, ChevronDown, ChevronUp } from 'lucide-react';
import { ResourceTypeMultiSelect } from './ResourceTypeMultiSelect';
import { BatchHistoryTable } from './BatchHistoryTable';
import { useDashboardBatchState } from '@/hooks/use-dashboard-batch-state';
import { formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';

export function BatchControlIdleWidget() {
  const { startBatch, isStarting, history } = useDashboardBatchState();
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [batchSize, setBatchSize] = useState(10);
  const [maxConcurrent, setMaxConcurrent] = useState(5);
  const [aspects, setAspects] = useState({
    structural: true,
    profile: true,
    terminology: false,
    reference: false,
    businessRule: false,
    metadata: false,
  });

  // Fetch validation stats for last run time
  const { data: validationStats } = useQuery({
    queryKey: ['dashboard-validation-stats'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/validation-stats');
      if (!response.ok) throw new Error('Failed to fetch validation stats');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const handleStart = () => {
    if (selectedTypes.length === 0) {
      alert('Please select at least one resource type');
      return;
    }

    startBatch({
      resourceTypes: selectedTypes,
      validationAspects: aspects,
      config: {
        batchSize,
        maxConcurrent,
        priority: 'normal',
      },
    });
  };

  const lastValidationRun = validationStats?.lastValidationRun
    ? formatDistanceToNow(new Date(validationStats.lastValidationRun), { addSuffix: true })
    : 'Never';

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Batch Validation Control</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Last validation run: {lastValidationRun}
            </p>
          </div>
        </div>

        {/* Resource Type Selection */}
        <div className="space-y-2">
          <Label htmlFor="resource-types">Select Resource Types</Label>
          <ResourceTypeMultiSelect
            selectedTypes={selectedTypes}
            onChange={setSelectedTypes}
          />
        </div>

        {/* Advanced Options */}
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full justify-between"
          >
            <span>Advanced Options</span>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {showAdvanced && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              {/* Batch Size Slider */}
              <div className="space-y-2">
                <Label htmlFor="batch-size">
                  Batch Size: {batchSize} resources
                </Label>
                <Slider
                  id="batch-size"
                  value={[batchSize]}
                  onValueChange={([value]) => setBatchSize(value)}
                  min={5}
                  max={50}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Max Concurrency Slider */}
              <div className="space-y-2">
                <Label htmlFor="max-concurrent">
                  Max Concurrency: {maxConcurrent}
                </Label>
                <Slider
                  id="max-concurrent"
                  value={[maxConcurrent]}
                  onValueChange={([value]) => setMaxConcurrent(value)}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Validation Aspects */}
              <div className="space-y-3">
                <Label>Validation Aspects</Label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(aspects).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`aspect-${key}`}
                        checked={value}
                        onCheckedChange={(checked) =>
                          setAspects({ ...aspects, [key]: checked })
                        }
                      />
                      <Label
                        htmlFor={`aspect-${key}`}
                        className="text-sm font-normal capitalize cursor-pointer"
                      >
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Start Button */}
        <Button
          onClick={handleStart}
          disabled={isStarting || selectedTypes.length === 0}
          className="w-full"
          size="lg"
        >
          <Play className="mr-2 h-5 w-5" />
          {isStarting ? 'Starting...' : 'Start Batch Validation'}
        </Button>

        {/* Batch History */}
        {history.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <h3 className="text-lg font-semibold">Recent Batch Runs</h3>
            <BatchHistoryTable history={history.slice(0, 5)} />
          </div>
        )}
      </div>
    </Card>
  );
}

