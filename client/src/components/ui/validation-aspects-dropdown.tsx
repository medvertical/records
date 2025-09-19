import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { 
  CheckSquare, 
  Square, 
  ChevronDown,
  Settings,
  Zap,
  Database,
  BookOpen,
  Link,
  Briefcase,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ValidationSettings {
  structural: { enabled: boolean; severity: 'error' | 'warning' | 'information' };
  profile: { enabled: boolean; severity: 'error' | 'warning' | 'information' };
  terminology: { enabled: boolean; severity: 'error' | 'warning' | 'information' };
  reference: { enabled: boolean; severity: 'error' | 'warning' | 'information' };
  businessRule: { enabled: boolean; severity: 'error' | 'warning' | 'information' };
  metadata: { enabled: boolean; severity: 'error' | 'warning' | 'information' };
  strictMode: boolean;
  maxConcurrentValidations: number;
  timeoutMs: number;
}

interface ValidationAspectsDropdownProps {
  className?: string;
}

const validationAspects = [
  {
    key: 'structural' as keyof ValidationSettings,
    label: 'Structural Validation',
    icon: Database,
    description: 'Validates FHIR structure and syntax'
  },
  {
    key: 'profile' as keyof ValidationSettings,
    label: 'Profile Validation', 
    icon: FileText,
    description: 'Validates against FHIR profiles'
  },
  {
    key: 'terminology' as keyof ValidationSettings,
    label: 'Terminology Validation',
    icon: BookOpen,
    description: 'Validates terminology bindings'
  },
  {
    key: 'reference' as keyof ValidationSettings,
    label: 'Reference Validation',
    icon: Link,
    description: 'Validates resource references'
  },
  {
    key: 'businessRule' as keyof ValidationSettings,
    label: 'Business Rule Validation',
    icon: Briefcase,
    description: 'Validates business logic rules'
  },
  {
    key: 'metadata' as keyof ValidationSettings,
    label: 'Metadata Validation',
    icon: Settings,
    description: 'Validates resource metadata'
  }
];

export function ValidationAspectsDropdown({ className }: ValidationAspectsDropdownProps) {
  const [validationSettings, setValidationSettings] = useState<ValidationSettings>({
    structural: { enabled: true, severity: 'error' },
    profile: { enabled: true, severity: 'warning' },
    terminology: { enabled: true, severity: 'warning' },
    reference: { enabled: true, severity: 'error' },
    businessRule: { enabled: true, severity: 'warning' },
    metadata: { enabled: true, severity: 'information' },
    strictMode: false,
    maxConcurrentValidations: 8,
    timeoutMs: 30000,
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Load validation settings on mount
  useEffect(() => {
    loadValidationSettings();
  }, []);

  const loadValidationSettings = async () => {
    try {
      const response = await fetch('/api/validation/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setValidationSettings(data.settings);
        }
      }
    } catch (error) {
      console.error('Failed to load validation settings:', error);
    }
  };

  const updateValidationSettings = async (updates: Partial<ValidationSettings>) => {
    setIsLoading(true);
    try {
      const updatedSettings = { ...validationSettings, ...updates };
      
      const response = await fetch('/api/validation/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSettings),
      });

      if (response.ok) {
        setValidationSettings(updatedSettings);
        toast({
          title: "Validation Settings Updated",
          description: "Validation aspects have been updated successfully.",
        });
      } else {
        throw new Error('Failed to update validation settings');
      }
    } catch (error) {
      console.error('Failed to update validation settings:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update validation settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAspectToggle = (aspectKey: keyof ValidationSettings, enabled: boolean) => {
    if (typeof validationSettings[aspectKey] === 'object' && validationSettings[aspectKey] !== null) {
      const aspect = validationSettings[aspectKey] as { enabled: boolean; severity: string };
      updateValidationSettings({
        [aspectKey]: { ...aspect, enabled }
      });
    }
  };

  const enabledCount = validationAspects.filter(aspect => {
    const setting = validationSettings[aspect.key];
    return typeof setting === 'object' && setting !== null && (setting as any).enabled;
  }).length;

  const totalCount = validationAspects.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className={`flex items-center space-x-2 ${className}`}
          disabled={isLoading}
        >
          <Zap className="h-4 w-4" />
          <span className="hidden sm:inline">Validation</span>
          <Badge variant={enabledCount === totalCount ? "default" : "secondary"} className="ml-1">
            {enabledCount}/{totalCount}
          </Badge>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center space-x-2">
          <Zap className="h-4 w-4" />
          <span>Validation Aspects</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="p-2 space-y-3">
          {validationAspects.map((aspect) => {
            const Icon = aspect.icon;
            const setting = validationSettings[aspect.key];
            const isEnabled = typeof setting === 'object' && setting !== null && (setting as any).enabled;
            
            return (
              <div key={aspect.key} className="flex items-center justify-between space-x-3">
                <div className="flex items-center space-x-3 flex-1">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <Label 
                      htmlFor={aspect.key}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {aspect.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {aspect.description}
                    </p>
                  </div>
                </div>
                <Switch
                  id={aspect.key}
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleAspectToggle(aspect.key, checked)}
                  disabled={isLoading}
                />
              </div>
            );
          })}
        </div>
        <DropdownMenuSeparator />
        <div className="p-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{enabledCount} of {totalCount} aspects enabled</span>
            <Badge variant={enabledCount === totalCount ? "default" : "secondary"}>
              {enabledCount === totalCount ? "All Active" : "Partial"}
            </Badge>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
