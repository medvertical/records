import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AspectCardProps {
  title: string;
  description: string;
  enabled: boolean;
  severity: 'info' | 'warning' | 'error';
  engine: string;
  availableEngines: string[];
  onToggle: (enabled: boolean) => void;
  onSeverityChange: (severity: 'info' | 'warning' | 'error') => void;
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
    <Card className="p-4">
      <div className="space-y-3">
        {/* Title with toggle on the right */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">{title}</h4>
          <Switch checked={enabled} onCheckedChange={onToggle} />
        </div>
        
        {/* Description */}
        <p className="text-xs text-muted-foreground">{description}</p>
        
        {/* Severity selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Severity</Label>
          <Select 
            value={severity} 
            onValueChange={(value) => onSeverityChange(value as 'info' | 'warning' | 'error')} 
            disabled={!enabled}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="error" className="text-xs">Error</SelectItem>
              <SelectItem value="warning" className="text-xs">Warning</SelectItem>
              <SelectItem value="info" className="text-xs">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Engine selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Engine</Label>
          <Select value={engine} onValueChange={onEngineChange} disabled={!enabled}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableEngines.map((eng) => (
                <SelectItem key={eng} value={eng} className="text-xs">
                  {eng.charAt(0).toUpperCase() + eng.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}

