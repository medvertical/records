/**
 * Accessibility Utilities
 * 
 * Provides utilities for:
 * - Focus management
 * - ARIA live regions
 * - Keyboard navigation
 * - Screen reader announcements
 */

import { useEffect, useRef, useCallback } from 'react';

// ============================================================================
// Focus Management
// ============================================================================

/**
 * Hook to manage focus when component mounts or updates
 */
export function useAutoFocus(enabled: boolean = true) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (enabled && ref.current) {
      // Small delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        ref.current?.focus();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [enabled]);

  return ref;
}

/**
 * Hook to restore focus when component unmounts
 */
export function useFocusRestore() {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Save currently focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    return () => {
      // Restore focus on unmount
      if (previousFocusRef.current && document.body.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
    };
  }, []);
}

/**
 * Hook to trap focus within a container (for modals, dialogs)
 */
export function useFocusTrap(enabled: boolean = true) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusableSelector = 
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);

  return containerRef;
}

// ============================================================================
// Screen Reader Announcements
// ============================================================================

/**
 * Create a live region for screen reader announcements
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const liveRegion = document.getElementById('sr-live-region') || createLiveRegion();
  liveRegion.setAttribute('aria-live', priority);
  liveRegion.textContent = message;

  // Clear after announcement
  setTimeout(() => {
    liveRegion.textContent = '';
  }, 1000);
}

function createLiveRegion(): HTMLElement {
  const existing = document.getElementById('sr-live-region');
  if (existing) return existing;

  const liveRegion = document.createElement('div');
  liveRegion.id = 'sr-live-region';
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';
  liveRegion.style.cssText = `
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  `;
  document.body.appendChild(liveRegion);
  return liveRegion;
}

/**
 * Hook to announce messages to screen readers
 */
export function useAnnounce() {
  return useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announce(message, priority);
  }, []);
}

// ============================================================================
// Keyboard Navigation
// ============================================================================

export type KeyboardHandler = (event: KeyboardEvent) => void;

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description?: string;
}

/**
 * Hook to handle keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatches = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatches = shortcut.alt ? event.altKey : !event.altKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
          event.preventDefault();
          shortcut.handler();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}

/**
 * Hook for arrow key navigation
 */
export function useArrowNavigation(
  items: any[],
  onSelect: (index: number) => void,
  options: {
    loop?: boolean;
    orientation?: 'vertical' | 'horizontal';
    enabled?: boolean;
  } = {}
) {
  const { loop = true, orientation = 'vertical', enabled = true } = options;
  const currentIndexRef = useRef(0);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const isVertical = orientation === 'vertical';
    const nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';
    const prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft';

    if (event.key === nextKey) {
      event.preventDefault();
      const nextIndex = currentIndexRef.current + 1;
      currentIndexRef.current = loop && nextIndex >= items.length ? 0 : Math.min(nextIndex, items.length - 1);
      onSelect(currentIndexRef.current);
    } else if (event.key === prevKey) {
      event.preventDefault();
      const prevIndex = currentIndexRef.current - 1;
      currentIndexRef.current = loop && prevIndex < 0 ? items.length - 1 : Math.max(prevIndex, 0);
      onSelect(currentIndexRef.current);
    } else if (event.key === 'Home') {
      event.preventDefault();
      currentIndexRef.current = 0;
      onSelect(currentIndexRef.current);
    } else if (event.key === 'End') {
      event.preventDefault();
      currentIndexRef.current = items.length - 1;
      onSelect(currentIndexRef.current);
    }
  }, [items, onSelect, loop, orientation, enabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return currentIndexRef;
}

// ============================================================================
// ARIA Utilities
// ============================================================================

/**
 * Generate unique IDs for ARIA relationships
 */
let idCounter = 0;
export function useId(prefix: string = 'a11y'): string {
  const idRef = useRef<string>();

  if (!idRef.current) {
    idCounter++;
    idRef.current = `${prefix}-${idCounter}`;
  }

  return idRef.current;
}

/**
 * Get ARIA props for expandable/collapsible sections
 */
export function getExpandableProps(expanded: boolean, controls?: string) {
  return {
    'aria-expanded': expanded,
    'aria-controls': controls,
    role: 'button',
    tabIndex: 0,
  };
}

/**
 * Get ARIA props for tab panels
 */
export function getTabPanelProps(id: string, labelledBy: string, selected: boolean) {
  return {
    id,
    role: 'tabpanel',
    'aria-labelledby': labelledBy,
    hidden: !selected,
    tabIndex: selected ? 0 : -1,
  };
}

/**
 * Get ARIA props for tabs
 */
export function getTabProps(id: string, controls: string, selected: boolean) {
  return {
    id,
    role: 'tab',
    'aria-selected': selected,
    'aria-controls': controls,
    tabIndex: selected ? 0 : -1,
  };
}
