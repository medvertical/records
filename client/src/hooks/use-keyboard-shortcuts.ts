/**
 * Keyboard Shortcuts Hook
 * 
 * Provides global keyboard shortcuts for the application.
 * 
 * Shortcuts:
 * - R: Refresh current view
 * - E: Focus search/edit field
 * - V: Trigger validation
 * - S: Go to Settings
 * - D: Go to Dashboard
 * - B: Go to Browse Resources
 * - ?: Show keyboard shortcuts help
 * - Esc: Close modals/dialogs
 * - Ctrl+K / Cmd+K: Command palette (future)
 */

import { useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useToast } from './use-toast';

export interface KeyboardShortcut {
  key: string;
  description: string;
  action: () => void;
  modifier?: 'ctrl' | 'cmd' | 'alt' | 'shift' | 'none';
  category?: 'navigation' | 'actions' | 'editing' | 'help';
}

export interface KeyboardShortcutsOptions {
  enabled?: boolean;
  showNotifications?: boolean;
  customShortcuts?: KeyboardShortcut[];
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions = {}) {
  const {
    enabled = true,
    showNotifications = false,
    customShortcuts = []
  } = options;

  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Handle keyboard shortcut help modal
  const showShortcutsHelp = useCallback(() => {
    // Dispatch custom event that ShortcutsHelpDialog listens to
    window.dispatchEvent(new CustomEvent('show-keyboard-shortcuts-help'));
  }, []);

  // Handle refresh action
  const handleRefresh = useCallback(() => {
    // Dispatch custom event for refresh
    window.dispatchEvent(new CustomEvent('app-refresh'));
    
    if (showNotifications) {
      toast({
        title: "Refreshed",
        description: "Page refreshed successfully",
        duration: 2000,
      });
    }
  }, [showNotifications, toast]);

  // Handle focus search/edit field
  const handleFocusSearch = useCallback(() => {
    // Find first visible input or textarea
    const searchInput = document.querySelector('input[type="text"], input[type="search"], textarea') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }, []);

  // Handle validation trigger
  const handleValidate = useCallback(() => {
    // Dispatch custom event for validation
    window.dispatchEvent(new CustomEvent('trigger-validation'));
    
    if (showNotifications) {
      toast({
        title: "Validation triggered",
        description: "Starting validation process...",
        duration: 2000,
      });
    }
  }, [showNotifications, toast]);

  // Navigation shortcuts
  const handleGoToSettings = useCallback(() => {
    setLocation('/settings');
  }, [setLocation]);

  const handleGoToDashboard = useCallback(() => {
    setLocation('/');
  }, [setLocation]);

  const handleGoToBrowse = useCallback(() => {
    setLocation('/resources');
  }, [setLocation]);

  // Handle escape key (close modals)
  const handleEscape = useCallback(() => {
    // Dispatch custom event for escape
    window.dispatchEvent(new CustomEvent('app-escape'));
  }, []);

  // Define default shortcuts
  const defaultShortcuts: KeyboardShortcut[] = [
    // Navigation
    { key: 'd', description: 'Go to Dashboard', action: handleGoToDashboard, category: 'navigation' },
    { key: 'b', description: 'Go to Browse Resources', action: handleGoToBrowse, category: 'navigation' },
    { key: 's', description: 'Go to Settings', action: handleGoToSettings, category: 'navigation' },
    
    // Actions
    { key: 'r', description: 'Refresh current view', action: handleRefresh, category: 'actions' },
    { key: 'v', description: 'Trigger validation', action: handleValidate, category: 'actions' },
    
    // Editing
    { key: 'e', description: 'Focus search/edit field', action: handleFocusSearch, category: 'editing' },
    { key: 'Escape', description: 'Close modals/dialogs', action: handleEscape, category: 'editing' },
    
    // Help
    { key: '?', description: 'Show keyboard shortcuts', action: showShortcutsHelp, category: 'help' },
  ];

  // Combine default and custom shortcuts
  const allShortcuts = [...defaultShortcuts, ...customShortcuts];

  // Handle keydown events
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore shortcuts when typing in input fields (except Escape)
      const target = event.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.isContentEditable;

      if (isInputField && event.key !== 'Escape') {
        return;
      }

      // Find matching shortcut
      const shortcut = allShortcuts.find(s => {
        const keyMatches = s.key.toLowerCase() === event.key.toLowerCase();
        
        // Check modifiers
        if (s.modifier === 'ctrl' && !event.ctrlKey) return false;
        if (s.modifier === 'cmd' && !event.metaKey) return false;
        if (s.modifier === 'alt' && !event.altKey) return false;
        if (s.modifier === 'shift' && !event.shiftKey) return false;
        if (s.modifier === 'none' && (event.ctrlKey || event.metaKey || event.altKey)) return false;
        
        return keyMatches;
      });

      if (shortcut) {
        event.preventDefault();
        shortcut.action();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, allShortcuts]);

  return {
    shortcuts: allShortcuts,
    enabled,
    showShortcutsHelp,
  };
}

/**
 * Hook to listen for keyboard shortcut events
 * Useful for components that need to respond to specific shortcuts
 */
export function useKeyboardShortcutListener(
  eventName: 'app-refresh' | 'trigger-validation' | 'app-escape' | 'show-keyboard-shortcuts-help',
  handler: () => void
) {
  useEffect(() => {
    const handleEvent = () => {
      handler();
    };

    window.addEventListener(eventName, handleEvent);

    return () => {
      window.removeEventListener(eventName, handleEvent);
    };
  }, [eventName, handler]);
}

