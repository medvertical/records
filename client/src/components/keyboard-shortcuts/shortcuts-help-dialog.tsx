/**
 * Keyboard Shortcuts Help Dialog
 * 
 * Displays all available keyboard shortcuts in a modal dialog.
 * Triggered by pressing "?" or through the help menu.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Keyboard } from 'lucide-react';

interface Shortcut {
  key: string;
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  // Navigation
  { key: 'D', description: 'Go to Dashboard', category: 'Navigation' },
  { key: 'B', description: 'Go to Browse Resources', category: 'Navigation' },
  { key: 'S', description: 'Go to Settings', category: 'Navigation' },
  
  // Actions
  { key: 'R', description: 'Refresh current view', category: 'Actions' },
  { key: 'V', description: 'Trigger validation', category: 'Actions' },
  
  // Editing
  { key: 'E', description: 'Focus search/edit field', category: 'Editing' },
  { key: 'Esc', description: 'Close modals/dialogs', category: 'Editing' },
  
  // Help
  { key: '?', description: 'Show keyboard shortcuts', category: 'Help' },
];

export function ShortcutsHelpDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleShowShortcuts = () => {
      setOpen(true);
    };

    const handleEscape = () => {
      setOpen(false);
    };

    window.addEventListener('show-keyboard-shortcuts-help', handleShowShortcuts);
    window.addEventListener('app-escape', handleEscape);

    return () => {
      window.removeEventListener('show-keyboard-shortcuts-help', handleShowShortcuts);
      window.removeEventListener('app-escape', handleEscape);
    };
  }, []);

  // Group shortcuts by category
  const groupedShortcuts = SHORTCUTS.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Keyboard className="h-6 w-6 text-fhir-blue" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these keyboard shortcuts to navigate and perform actions quickly
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{category}</h3>
              <div className="space-y-2">
                {shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm text-gray-600">{shortcut.description}</span>
                    <Badge 
                      variant="secondary" 
                      className="bg-gray-100 text-gray-700 border border-gray-300 font-mono text-xs px-3 py-1"
                    >
                      {shortcut.key}
                    </Badge>
                  </div>
                ))}
              </div>
              <Separator className="mt-4" />
            </div>
          ))}
        </div>

        <div className="text-sm text-gray-500 text-center mt-4 pb-2">
          <p>
            Press <Badge variant="secondary" className="bg-gray-100 text-gray-700 border border-gray-300 font-mono text-xs mx-1">Esc</Badge> to close this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

