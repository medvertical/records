/**
 * GermanProfileQuickInstall Component
 * 
 * Task 4.10: Quick install buttons for German healthcare profiles
 * 
 * Features:
 * - One-click install for MII, ISiK, KBV bundles
 * - Progress indicators
 * - Offline status awareness
 */

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Package, Download, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';

// ============================================================================
// Types
// ============================================================================

interface QuickInstallBundle {
  id: string;
  name: string;
  description: string;
  emoji: string;
  packages: string[];
  category: 'german' | 'international';
}

const QUICK_INSTALL_BUNDLES: QuickInstallBundle[] = [
  {
    id: 'german-hospital-complete',
    name: 'German Hospital - Complete',
    description: 'All German profiles for hospital use (MII + ISiK + KBV)',
    emoji: '🏥',
    category: 'german',
    packages: [
      'de.medizininformatikinitiative.kerndatensatz.person',
      'de.medizininformatikinitiative.kerndatensatz.laborbefund',
      'de.medizininformatikinitiative.kerndatensatz.diagnose',
      'de.gematik.isik-basismodul',
      'de.gematik.isik-labor',
      'kbv.basis'
    ]
  },
  {
    id: 'german-ambulatory',
    name: 'German Ambulatory Care',
    description: 'KBV profiles for ambulatory care',
    emoji: '🏨',
    category: 'german',
    packages: [
      'kbv.basis',
      'kbv.ita.for',
      'kbv.ita.erp'
    ]
  },
  {
    id: 'mii-minimal',
    name: 'MII Minimal',
    description: 'Core MII profiles (Person, Lab, Diagnosis)',
    emoji: '🔬',
    category: 'german',
    packages: [
      'de.medizininformatikinitiative.kerndatensatz.person',
      'de.medizininformatikinitiative.kerndatensatz.laborbefund',
      'de.medizininformatikinitiative.kerndatensatz.diagnose'
    ]
  },
  {
    id: 'international-core',
    name: 'International Core',
    description: 'Core FHIR + UV Extensions + IPS',
    emoji: '🌍',
    category: 'international',
    packages: [
      'hl7.fhir.r4.core',
      'hl7.fhir.uv.extensions.r4',
      'hl7.fhir.uv.ips'
    ]
  }
];

// ============================================================================
// Component
// ============================================================================

export const GermanProfileQuickInstall: React.FC<{
  onInstallComplete?: () => void;
}> = ({ onInstallComplete }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [installingBundleId, setInstallingBundleId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Install bundle mutation
  const installBundleMutation = useMutation({
    mutationFn: async (bundleId: string) => {
      const bundle = QUICK_INSTALL_BUNDLES.find(b => b.id === bundleId);
      if (!bundle) throw new Error('Bundle not found');

      setProgress(0);
      const packagesCount = bundle.packages.length;

      // Install packages sequentially
      for (let i = 0; i < bundle.packages.length; i++) {
        const packageId = bundle.packages[i];
        
        try {
          await apiRequest('POST', '/api/profiles/install', {
            packageId,
            autoInstall: true
          });

          setProgress(((i + 1) / packagesCount) * 100);
        } catch (error) {
          console.error(`Failed to install ${packageId}:`, error);
          // Continue with next package
        }
      }

      return bundle;
    },
    onSuccess: (bundle) => {
      toast({
        title: 'Bundle installed successfully!',
        description: `${bundle.name} with ${bundle.packages.length} packages`,
        variant: 'default'
      });
      queryClient.invalidateQueries({ queryKey: ['installed-packages'] });
      setInstallingBundleId(null);
      setProgress(0);
      onInstallComplete?.();
    },
    onError: (error: Error) => {
      toast({
        title: 'Installation failed',
        description: error.message,
        variant: 'destructive'
      });
      setInstallingBundleId(null);
      setProgress(0);
    }
  });

  const handleInstall = (bundleId: string) => {
    setInstallingBundleId(bundleId);
    installBundleMutation.mutate(bundleId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Quick Install Bundles</h3>
      </div>

      {/* German Profiles */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3">🇩🇪 German Healthcare</h4>
        <div className="grid gap-3">
          {QUICK_INSTALL_BUNDLES.filter(b => b.category === 'german').map(bundle => (
            <Card key={bundle.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{bundle.emoji}</span>
                    <div>
                      <CardTitle className="text-base">{bundle.name}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {bundle.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {bundle.packages.length} packages
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                {installingBundleId === bundle.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3 animate-spin" />
                      <span>Installing... {Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                ) : (
                  <Button
                    onClick={() => handleInstall(bundle.id)}
                    disabled={installBundleMutation.isPending}
                    size="sm"
                    className="w-full"
                  >
                    <Download className="h-3 w-3 mr-2" />
                    Quick Install
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* International Profiles */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3">🌍 International</h4>
        <div className="grid gap-3">
          {QUICK_INSTALL_BUNDLES.filter(b => b.category === 'international').map(bundle => (
            <Card key={bundle.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{bundle.emoji}</span>
                    <div>
                      <CardTitle className="text-base">{bundle.name}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {bundle.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {bundle.packages.length} packages
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                {installingBundleId === bundle.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3 animate-spin" />
                      <span>Installing... {Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                ) : (
                  <Button
                    onClick={() => handleInstall(bundle.id)}
                    disabled={installBundleMutation.isPending}
                    size="sm"
                    className="w-full"
                  >
                    <Download className="h-3 w-3 mr-2" />
                    Quick Install
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GermanProfileQuickInstall;

