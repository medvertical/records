import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { XCircle, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { EngineIcon, getEngineName } from '@/components/validation/EngineIcon';

interface AspectCardProps {
  title: string;
  description: string;
  enabled: boolean;
  severity: 'inherit' | 'info' | 'warning' | 'error';
  engine: string;
  availableEngines: string[];
  onToggle: (enabled: boolean) => void;
  onSeverityChange: (severity: 'inherit' | 'info' | 'warning' | 'error') => void;
  onEngineChange: (engine: string) => void;
}

export function AspectCard({
  title,
  description,
  enabled,
  severity,
  engine,
  availableEngines,
  onToggle,
  onSeverityChange,
  onEngineChange
}: AspectCardProps) {
  return (
    <Card className="p-4 flex flex-col h-full">
      <div className="flex flex-col h-full">
        {/* Title with toggle on the right */}
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold">{title}</h4>
          <Switch checked={enabled} onCheckedChange={onToggle} />
        </div>
        
        {/* Description */}
        <p className="text-xs text-muted-foreground mb-3">{description}</p>
        
        {/* Engine and Severity in a row - pushed to bottom */}
        <div className="grid grid-cols-2 gap-3 mt-auto items-end">
          {/* Engine selector */}
          <div className="flex flex-col">
            <Label className="text-sm font-medium mb-1.5">Engine</Label>
            <Select value={engine} onValueChange={onEngineChange} disabled={!enabled}>
              <SelectTrigger className="h-9">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <EngineIcon engine={engine} size={14} />
                    <span>{getEngineName(engine)}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableEngines.map((eng) => (
                  <SelectItem key={eng} value={eng}>
                    <div className="flex items-center gap-2">
                      <EngineIcon engine={eng} size={14} />
                      <span>{getEngineName(eng)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Severity selector */}
          <div className="flex flex-col">
            <Label className="text-sm font-medium mb-1.5">Severity</Label>
            <Select 
              value={severity} 
              onValueChange={(value) => onSeverityChange(value as 'inherit' | 'info' | 'warning' | 'error')} 
              disabled={!enabled}
            >
              <SelectTrigger className="h-9">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {severity === 'inherit' && <RefreshCw className="h-3.5 w-3.5 text-gray-500" />}
                    {severity === 'error' && <XCircle className="h-3.5 w-3.5 text-red-600" />}
                    {severity === 'warning' && <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
                    {severity === 'info' && <Info className="h-3.5 w-3.5 text-blue-500" />}
                    <span>{severity === 'inherit' ? 'Inherit' : severity === 'error' ? 'Error' : severity === 'warning' ? 'Warning' : 'Info'}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-3.5 w-3.5 text-gray-500" />
                    <span>Inherit</span>
                  </div>
                </SelectItem>
                <SelectItem value="error">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 text-red-600" />
                    <span>Error</span>
                  </div>
                </SelectItem>
                <SelectItem value="warning">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                    <span>Warning</span>
                  </div>
                </SelectItem>
                <SelectItem value="info">
                  <div className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-blue-500" />
                    <span>Info</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </Card>
  );
}

