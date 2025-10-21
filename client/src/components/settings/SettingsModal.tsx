import { useState } from 'react';
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Saving is handled by individual tabs
      // This is a placeholder for coordinated save
      
      // Wait a bit for any pending saves in tabs to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      toast({
        title: "Settings saved",
        description: "Your settings have been saved successfully.",
      });
      
      // Increment save counter to notify tabs
      setSaveCounter(prev => prev + 1);
      
      // Reset dirty state after successful save
      setIsDirty(false);
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
                <TabsContent value="validation" className="mt-0">
                  <ValidationTab onDirtyChange={setIsDirty} onLoadingChange={setIsLoading} hideHeader saveCounter={saveCounter} />
                </TabsContent>
                
                <TabsContent value="servers" className="mt-0">
                  <ServersTab onDirtyChange={setIsDirty} hideHeader saveCounter={saveCounter} />
                </TabsContent>
                
                <TabsContent value="rules" className="mt-0">
                  <RulesTab onDirtyChange={setIsDirty} hideHeader saveCounter={saveCounter} />
                </TabsContent>
                
                <TabsContent value="dashboard" className="mt-0">
                  <DashboardTab onDirtyChange={setIsDirty} hideHeader saveCounter={saveCounter} />
                </TabsContent>
                
                <TabsContent value="system" className="mt-0">
                  <SystemTab onDirtyChange={setIsDirty} hideHeader saveCounter={saveCounter} />
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

