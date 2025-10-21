import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Zap, 
  Server, 
  Code2, 
  BarChart3, 
  Database 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SaveFooter } from './shared/SaveFooter';
import {
  ValidationTab,
  ServersTab,
  RulesTab,
  DashboardTab,
  SystemTab
} from './tabs';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
}

export function SettingsModal({ 
  open, 
  onOpenChange,
  defaultTab = 'validation'
}: SettingsModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveCounter, setSaveCounter] = useState(0);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [saveSuccesses, setSaveSuccesses] = useState<number>(0);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  
  // Use refs to track save counts for accurate polling (avoids stale closure)
  const saveSuccessesRef = useRef(0);
  const saveErrorsRef = useRef<string[]>([]);

  // Parse initial state from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#settings')) {
      // Extract tab if specified (e.g., #settings-system)
      const parts = hash.split('-');
      if (parts.length > 1) {
        const tab = parts.slice(1).join('-'); // Handle multi-part tabs
        setActiveTab(tab);
      }
      // Open modal if not already open
      if (!open) {
        onOpenChange(true);
      }
    }
  }, []); // Only run on mount

  // Update URL hash when modal opens/closes or tab changes
  useEffect(() => {
    if (open) {
      const newHash = activeTab ? `#settings-${activeTab}` : '#settings';
      if (window.location.hash !== newHash) {
        window.history.replaceState(null, '', newHash);
      }
    } else {
      // Remove hash when modal closes
      if (window.location.hash.startsWith('#settings')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, [open, activeTab]);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#settings')) {
        // Extract tab if specified
        const parts = hash.split('-');
        if (parts.length > 1) {
          const tab = parts.slice(1).join('-');
          setActiveTab(tab);
        }
        // Open modal if it's closed
        if (!open) {
          onOpenChange(true);
        }
      } else {
        // Close modal if hash is removed
        if (open) {
          onOpenChange(false);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [open, onOpenChange]);

  // Reload settings when modal opens
  useEffect(() => {
    console.log('[SettingsModal] Modal open state changed:', open);
    if (open) {
      console.log('[SettingsModal] Incrementing reloadTrigger');
      setReloadTrigger(prev => {
        const next = prev + 1;
        console.log('[SettingsModal] ReloadTrigger:', prev, '→', next);
        return next;
      });
    }
  }, [open]);

  // Reset saveCounter when modal closes
  useEffect(() => {
    if (!open) {
      console.log('[SettingsModal] Modal closed, resetting saveCounter');
      setSaveCounter(0);
    }
  }, [open]);

  const handleSaveComplete = () => {
    saveSuccessesRef.current += 1;
    setSaveSuccesses(saveSuccessesRef.current);
    console.log('[SettingsModal] Save completed, count:', saveSuccessesRef.current);
  };

  const handleSaveError = (error: string) => {
    saveErrorsRef.current = [...saveErrorsRef.current, error];
    setSaveErrors(saveErrorsRef.current);
    console.log('[SettingsModal] Save error:', error, 'total errors:', saveErrorsRef.current.length);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveErrors([]);
    setSaveSuccesses(0);
    saveErrorsRef.current = [];
    saveSuccessesRef.current = 0;
    
    try {
      // Increment saveCounter to trigger saves in tabs
      console.log('[SettingsModal] Initiating save for all tabs...');
      setSaveCounter(prev => prev + 1);
      
      // Wait for tabs to complete saves (with timeout)
      const expectedSaves = 5; // Validation + Servers + Rules + Dashboard + System
      const timeout = 10000; // 10 second timeout (validation can be slow due to invalidation)
      console.log('[SettingsModal] Expecting', expectedSaves, 'tab saves');
      const startTime = Date.now();
      
      // Poll using refs to avoid stale closure issues
      while (saveSuccessesRef.current < expectedSaves && Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // If we have errors and all responses are in, break early
        if (saveSuccessesRef.current + saveErrorsRef.current.length >= expectedSaves) {
          break;
        }
      }
      
      console.log('[SettingsModal] Save results:', saveSuccessesRef.current, 'successes,', saveErrorsRef.current.length, 'errors');
      
      // Use ref values for final toast (most up-to-date)
      const finalSuccesses = saveSuccessesRef.current;
      const finalErrors = saveErrorsRef.current;
      
      if (finalErrors.length > 0) {
        toast({
          title: "Partial save failure",
          description: `${finalSuccesses}/${expectedSaves} tabs saved. Failed: ${finalErrors.join(', ')}`,
          variant: "destructive"
        });
        // Don't clear dirty state if there were errors
      } else if (finalSuccesses === expectedSaves) {
        toast({
          title: "Settings saved",
          description: `All ${expectedSaves} tabs saved successfully.`,
        });
        // Reset dirty state after successful save
        setIsDirty(false);
      } else {
        toast({
          title: "Partial save",
          description: `${finalSuccesses}/${expectedSaves} tabs saved (some tabs may have timed out).`,
          variant: "default"
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    // Reset current tab to defaults
    // Implementation depends on active tab
  };

  const handleCloseAttempt = (shouldClose: boolean) => {
    if (!shouldClose) {
      onOpenChange(false);
      return;
    }
    
    if (isDirty) {
      setPendingClose(true);
      setShowUnsavedDialog(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleConfirmClose = () => {
    setShowUnsavedDialog(false);
    setPendingClose(false);
    setIsDirty(false);
    onOpenChange(false);
  };

  const handleCancelClose = () => {
    setShowUnsavedDialog(false);
    setPendingClose(false);
  };

  const handleSaveAndClose = async () => {
    await handleSave();
    handleConfirmClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleCloseAttempt}>
        <DialogContent className="max-w-7xl h-[85vh] flex p-0 overflow-hidden">
          <VisuallyHidden>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Configure application settings including validation, servers, rules, dashboard, and system preferences.
            </DialogDescription>
          </VisuallyHidden>
          <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          orientation="vertical" 
          className="flex w-full h-full"
        >
          {/* Left navigation sidebar */}
          <TabsList className="shrink-0 rounded-none border-border">
            <TabsTrigger value="validation" className="gap-2">
              <Zap className="h-4 w-4" />
              Validation
            </TabsTrigger>
            <TabsTrigger value="servers" className="gap-2">
              <Server className="h-4 w-4" />
              Servers
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-2">
              <Code2 className="h-4 w-4" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              <Database className="h-4 w-4" />
              System
            </TabsTrigger>
          </TabsList>

          {/* Right panel with content and footer */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Fixed header for active tab */}
            <div className="px-6 pt-6 pb-4 border-b bg-background shrink-0">
              {activeTab === 'validation' && (
                <>
                  <h2 className="text-2xl font-bold tracking-tight">Validation Settings</h2>
                  <p className="text-sm text-muted-foreground mt-1.5">Configure FHIR validation behavior, engines, performance, and resource filtering</p>
                </>
              )}
              {activeTab === 'servers' && (
                <>
                  <h2 className="text-2xl font-bold tracking-tight">Server Configuration</h2>
                  <p className="text-sm text-muted-foreground mt-1.5">Manage FHIR servers and terminology services</p>
                </>
              )}
              {activeTab === 'rules' && (
                <>
                  <h2 className="text-2xl font-bold tracking-tight">Business Rules</h2>
                  <p className="text-sm text-muted-foreground mt-1.5">Configure and manage custom FHIRPath validation rules</p>
                </>
              )}
              {activeTab === 'dashboard' && (
                <>
                  <h2 className="text-2xl font-bold tracking-tight">Dashboard Settings</h2>
                  <p className="text-sm text-muted-foreground mt-1.5">Customize dashboard display, refresh behavior, and real-time updates</p>
                </>
              )}
              {activeTab === 'system' && (
                <>
                  <h2 className="text-2xl font-bold tracking-tight">System Settings</h2>
                  <p className="text-sm text-muted-foreground mt-1.5">Configure system-wide preferences and controls</p>
                </>
              )}
            </div>

            {/* Scrollable content area */}
            <ScrollArea className="flex-1">
              <div className="p-6">
                <TabsContent value="validation" className="mt-0" forceMount>
                  <div className={activeTab !== 'validation' ? 'hidden' : ''}>
                    <ValidationTab 
                      onDirtyChange={setIsDirty} 
                      onLoadingChange={setIsLoading} 
                      hideHeader 
                      saveCounter={saveCounter}
                      onSaveComplete={handleSaveComplete}
                      onSaveError={handleSaveError}
                      reloadTrigger={reloadTrigger}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="servers" className="mt-0" forceMount>
                  <div className={activeTab !== 'servers' ? 'hidden' : ''}>
                    <ServersTab 
                      onDirtyChange={setIsDirty} 
                      hideHeader 
                      saveCounter={saveCounter}
                      onSaveComplete={handleSaveComplete}
                      onSaveError={handleSaveError}
                      isActive={activeTab === 'servers'}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="rules" className="mt-0" forceMount>
                  <div className={activeTab !== 'rules' ? 'hidden' : ''}>
                    <RulesTab 
                      onDirtyChange={setIsDirty} 
                      hideHeader 
                      saveCounter={saveCounter}
                      onSaveComplete={handleSaveComplete}
                      onSaveError={handleSaveError}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="dashboard" className="mt-0" forceMount>
                  <div className={activeTab !== 'dashboard' ? 'hidden' : ''}>
                    <DashboardTab 
                      onDirtyChange={setIsDirty} 
                      hideHeader 
                      saveCounter={saveCounter}
                      onSaveComplete={handleSaveComplete}
                      onSaveError={handleSaveError}
                      reloadTrigger={reloadTrigger}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="system" className="mt-0" forceMount>
                  <div className={activeTab !== 'system' ? 'hidden' : ''}>
                    <SystemTab 
                      onDirtyChange={setIsDirty} 
                      hideHeader 
                      saveCounter={saveCounter}
                      onSaveComplete={handleSaveComplete}
                      onSaveError={handleSaveError}
                      reloadTrigger={reloadTrigger}
                    />
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>

            {!isLoading && (
              <SaveFooter 
                onSave={handleSave}
                onReset={handleReset}
                isSaving={isSaving}
                isDirty={isDirty}
              />
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* Unsaved Changes Confirmation Dialog */}
    <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. What would you like to do?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancelClose}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmClose} variant="outline">
            Discard Changes
          </AlertDialogAction>
          <AlertDialogAction onClick={handleSaveAndClose}>
            Save & Close
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

