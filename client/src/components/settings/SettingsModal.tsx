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
  Settings, 
  Server, 
  Code2, 
  BarChart3, 
  Database 
} from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Saving is handled by individual tabs
      // This is a placeholder for coordinated save
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
              <Settings className="h-4 w-4" />
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
            <ScrollArea className="flex-1">
              <div className="p-6">
                <TabsContent value="validation" className="mt-0">
                  <ValidationTab onDirtyChange={setIsDirty} />
                </TabsContent>
                
                <TabsContent value="servers" className="mt-0">
                  <ServersTab onDirtyChange={setIsDirty} />
                </TabsContent>
                
                <TabsContent value="rules" className="mt-0">
                  <RulesTab onDirtyChange={setIsDirty} />
                </TabsContent>
                
                <TabsContent value="dashboard" className="mt-0">
                  <DashboardTab onDirtyChange={setIsDirty} />
                </TabsContent>
                
                <TabsContent value="system" className="mt-0">
                  <SystemTab onDirtyChange={setIsDirty} />
                </TabsContent>
              </div>
            </ScrollArea>

            <SaveFooter 
              onSave={handleSave}
              onReset={handleReset}
              isSaving={isSaving}
              isDirty={isDirty}
            />
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

