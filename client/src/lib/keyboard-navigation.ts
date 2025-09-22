// ============================================================================
// Keyboard Navigation Utilities - Accessibility and keyboard navigation helpers
// ============================================================================

/**
 * Keyboard Navigation Utilities - Single responsibility: Keyboard navigation and accessibility helpers
 * Follows global rules: Under 200 lines, single responsibility, focused on keyboard navigation
 */

// Keyboard event types
export type KeyboardHandler = (event: KeyboardEvent) => void;

// Common keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  ESCAPE: 'Escape',
  ENTER: 'Enter',
  SPACE: ' ',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
} as const;

/**
 * Create keyboard event handler for common actions
 */
export const createKeyboardHandler = (
  shortcuts: Record<string, () => void>
): KeyboardHandler => {
  return (event: KeyboardEvent) => {
    const key = event.key;
    
    // Check for exact key matches
    if (shortcuts[key]) {
      event.preventDefault();
      shortcuts[key]();
      return;
    }
    
    // Check for key combinations
    if (event.ctrlKey || event.metaKey) {
      const combo = `${event.ctrlKey ? 'ctrl' : 'cmd'}+${key}`;
      if (shortcuts[combo]) {
        event.preventDefault();
        shortcuts[combo]();
      }
    }
  };
};

/**
 * Focus management utilities
 */
export const focusUtils = {
  /**
   * Get focusable elements within a container
   */
  getFocusableElements: (container: HTMLElement): HTMLElement[] => {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([disabled])',
      '[role="link"]:not([disabled])',
    ].join(', ');
    
    return Array.from(container.querySelectorAll(focusableSelectors));
  },
  
  /**
   * Get the first focusable element
   */
  getFirstFocusable: (container: HTMLElement): HTMLElement | null => {
    const focusableElements = focusUtils.getFocusableElements(container);
    return focusableElements[0] || null;
  },
  
  /**
   * Get the last focusable element
   */
  getLastFocusable: (container: HTMLElement): HTMLElement | null => {
    const focusableElements = focusUtils.getFocusableElements(container);
    return focusableElements[focusableElements.length - 1] || null;
  },
  
  /**
   * Trap focus within a container (for modals, drawers, etc.)
   */
  trapFocus: (container: HTMLElement, event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    
    const focusableElements = focusUtils.getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (!firstElement || !lastElement) return;
    
    if (event.shiftKey) {
      // Shift + Tab: going backwards
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: going forwards
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  },
};

/**
 * ARIA utilities for better accessibility
 */
export const ariaUtils = {
  /**
   * Set ARIA attributes for interactive elements
   */
  setInteractive: (element: HTMLElement, options: {
    expanded?: boolean;
    selected?: boolean;
    pressed?: boolean;
    describedBy?: string;
    labelledBy?: string;
  }) => {
    const { expanded, selected, pressed, describedBy, labelledBy } = options;
    
    if (expanded !== undefined) {
      element.setAttribute('aria-expanded', expanded.toString());
    }
    if (selected !== undefined) {
      element.setAttribute('aria-selected', selected.toString());
    }
    if (pressed !== undefined) {
      element.setAttribute('aria-pressed', pressed.toString());
    }
    if (describedBy) {
      element.setAttribute('aria-describedby', describedBy);
    }
    if (labelledBy) {
      element.setAttribute('aria-labelledby', labelledBy);
    }
  },
  
  /**
   * Create live region for screen readers
   */
  createLiveRegion: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.textContent = message;
    
    document.body.appendChild(liveRegion);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(liveRegion);
    }, 1000);
  },
};

/**
 * Dashboard-specific keyboard navigation
 */
export const dashboardNavigation = {
  /**
   * Navigate between dashboard widgets using arrow keys
   */
  navigateWidgets: (event: KeyboardEvent, currentWidget: HTMLElement) => {
    const container = currentWidget.closest('.dashboard-grid');
    if (!container) return;
    
    const widgets = Array.from(container.querySelectorAll('.dashboard-widget'));
    const currentIndex = widgets.indexOf(currentWidget);
    
    switch (event.key) {
      case KEYBOARD_SHORTCUTS.ARROW_RIGHT:
        event.preventDefault();
        const nextWidget = widgets[currentIndex + 1] as HTMLElement;
        if (nextWidget) nextWidget.focus();
        break;
        
      case KEYBOARD_SHORTCUTS.ARROW_LEFT:
        event.preventDefault();
        const prevWidget = widgets[currentIndex - 1] as HTMLElement;
        if (prevWidget) prevWidget.focus();
        break;
        
      case KEYBOARD_SHORTCUTS.ARROW_DOWN:
        event.preventDefault();
        // Navigate to next row (assuming 4-column grid)
        const downWidget = widgets[currentIndex + 4] as HTMLElement;
        if (downWidget) downWidget.focus();
        break;
        
      case KEYBOARD_SHORTCUTS.ARROW_UP:
        event.preventDefault();
        // Navigate to previous row
        const upWidget = widgets[currentIndex - 4] as HTMLElement;
        if (upWidget) upWidget.focus();
        break;
    }
  },
  
  /**
   * Handle validation control panel keyboard shortcuts
   */
  validationControls: createKeyboardHandler({
    ' ': () => {
      // Space to start/pause validation
      const playButton = document.querySelector('[aria-label*="Start"], [aria-label*="Pause"]') as HTMLButtonElement;
      if (playButton) playButton.click();
    },
    's': () => {
      // 's' key to stop validation
      const stopButton = document.querySelector('[aria-label*="Stop"]') as HTMLButtonElement;
      if (stopButton) stopButton.click();
    },
    'r': () => {
      // 'r' key to resume validation
      const resumeButton = document.querySelector('[aria-label*="Resume"]') as HTMLButtonElement;
      if (resumeButton) resumeButton.click();
    },
  }),
};

export default {
  KEYBOARD_SHORTCUTS,
  createKeyboardHandler,
  focusUtils,
  ariaUtils,
  dashboardNavigation,
};
