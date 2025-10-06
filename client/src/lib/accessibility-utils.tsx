import { KeyboardEvent } from 'react';

/**
 * Accessibility utility functions for validation control panel components
 */

export interface AccessibilityProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-selected'?: boolean;
  'aria-pressed'?: boolean;
  'aria-current'?: boolean | 'page' | 'step' | 'location' | 'date' | 'time';
  'aria-live'?: 'off' | 'polite' | 'assertive';
  'aria-atomic'?: boolean;
  'aria-busy'?: boolean;
  'aria-controls'?: string;
  'aria-haspopup'?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  'aria-hidden'?: boolean;
  'aria-invalid'?: boolean | 'grammar' | 'spelling';
  'aria-required'?: boolean;
  'aria-readonly'?: boolean;
  'aria-disabled'?: boolean;
  'aria-orientation'?: 'horizontal' | 'vertical';
  'aria-sort'?: 'none' | 'ascending' | 'descending' | 'other';
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
  'aria-valuenow'?: number;
  'aria-valuetext'?: string;
  role?: string;
  tabIndex?: number;
}

/**
 * Generate accessibility props for common UI patterns
 */
export const accessibility = {
  /**
   * Button accessibility props
   */
  button: (options: {
    label: string;
    pressed?: boolean;
    expanded?: boolean;
    controls?: string;
    describedBy?: string;
    disabled?: boolean;
  }): AccessibilityProps => ({
    'aria-label': options.label,
    'aria-pressed': options.pressed,
    'aria-expanded': options.expanded,
    'aria-controls': options.controls,
    'aria-describedby': options.describedBy,
    'aria-disabled': options.disabled,
    role: 'button',
    tabIndex: options.disabled ? -1 : 0,
  }),

  /**
   * Progress bar accessibility props
   */
  progressBar: (options: {
    label: string;
    value: number;
    min?: number;
    max?: number;
    valueText?: string;
  }): AccessibilityProps => ({
    'aria-label': options.label,
    'aria-valuenow': options.value,
    'aria-valuemin': options.min || 0,
    'aria-valuemax': options.max || 100,
    'aria-valuetext': options.valueText,
    role: 'progressbar',
    tabIndex: 0,
  }),

  /**
   * Status indicator accessibility props
   */
  statusIndicator: (options: {
    label: string;
    status: string;
    live?: boolean;
  }): AccessibilityProps => ({
    'aria-label': `${options.label}: ${options.status}`,
    'aria-live': options.live ? 'polite' : 'off',
    'aria-atomic': true,
    role: 'status',
    tabIndex: 0,
  }),

  /**
   * Error message accessibility props
   */
  errorMessage: (options: {
    label: string;
    invalid?: boolean;
  }): AccessibilityProps => ({
    'aria-label': options.label,
    'aria-invalid': options.invalid,
    'aria-live': 'assertive',
    'aria-atomic': true,
    role: 'alert',
    tabIndex: 0,
  }),

  /**
   * Warning message accessibility props
   */
  warningMessage: (options: {
    label: string;
  }): AccessibilityProps => ({
    'aria-label': options.label,
    'aria-live': 'polite',
    'aria-atomic': true,
    role: 'alert',
    tabIndex: 0,
  }),

  /**
   * List accessibility props
   */
  list: (options: {
    label: string;
    orientation?: 'horizontal' | 'vertical';
  }): AccessibilityProps => ({
    'aria-label': options.label,
    'aria-orientation': options.orientation || 'vertical',
    role: 'list',
    tabIndex: 0,
  }),

  /**
   * List item accessibility props
   */
  listItem: (options: {
    label: string;
    selected?: boolean;
    current?: boolean;
  }): AccessibilityProps => ({
    'aria-label': options.label,
    'aria-selected': options.selected,
    'aria-current': options.current,
    role: 'listitem',
    tabIndex: 0,
  }),

  /**
   * Region accessibility props
   */
  region: (options: {
    label: string;
    live?: boolean;
  }): AccessibilityProps => ({
    'aria-label': options.label,
    'aria-live': options.live ? 'polite' : 'off',
    role: 'region',
    tabIndex: 0,
  }),

  /**
   * Tab panel accessibility props
   */
  tabPanel: (options: {
    label: string;
    selected?: boolean;
    controls?: string;
  }): AccessibilityProps => ({
    'aria-label': options.label,
    'aria-selected': options.selected,
    'aria-controls': options.controls,
    role: 'tabpanel',
    tabIndex: options.selected ? 0 : -1,
  }),

  /**
   * Dialog accessibility props
   */
  dialog: (options: {
    label: string;
    modal?: boolean;
  }): AccessibilityProps => ({
    'aria-label': options.label,
    'aria-modal': options.modal,
    role: options.modal ? 'dialog' : 'region',
    tabIndex: 0,
  }),
};

/**
 * Keyboard navigation utilities
 */
export const keyboardNavigation = {
  /**
   * Handle Enter key press
   */
  handleEnter: (callback: () => void) => (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  },

  /**
   * Handle Escape key press
   */
  handleEscape: (callback: () => void) => (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      callback();
    }
  },

  /**
   * Handle Arrow key navigation
   */
  handleArrowKeys: (options: {
    onUp?: () => void;
    onDown?: () => void;
    onLeft?: () => void;
    onRight?: () => void;
  }) => (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        options.onUp?.();
        break;
      case 'ArrowDown':
        event.preventDefault();
        options.onDown?.();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        options.onLeft?.();
        break;
      case 'ArrowRight':
        event.preventDefault();
        options.onRight?.();
        break;
    }
  },

  /**
   * Handle Tab navigation
   */
  handleTab: (options: {
    onTab?: () => void;
    onShiftTab?: () => void;
  }) => (event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      if (event.shiftKey) {
        options.onShiftTab?.();
      } else {
        options.onTab?.();
      }
    }
  },

  /**
   * Handle Home/End key navigation
   */
  handleHomeEnd: (options: {
    onHome?: () => void;
    onEnd?: () => void;
  }) => (event: KeyboardEvent) => {
    switch (event.key) {
      case 'Home':
        event.preventDefault();
        options.onHome?.();
        break;
      case 'End':
        event.preventDefault();
        options.onEnd?.();
        break;
    }
  },
};

/**
 * Screen reader utilities
 */
export const screenReader = {
  /**
   * Announce message to screen readers
   */
  announce: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  },

  /**
   * Create screen reader only text
   */
  srOnly: (text: string) => (
    <span className="sr-only">{text}</span>
  ),

  /**
   * Create visually hidden text
   */
  visuallyHidden: (text: string) => (
    <span className="visually-hidden">{text}</span>
  ),
};

/**
 * Focus management utilities
 */
export const focusManagement = {
  /**
   * Trap focus within an element
   */
  trapFocus: (element: HTMLElement) => {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    };
    
    element.addEventListener('keydown', handleTabKey as any);
    
    // Return cleanup function
    return () => {
      element.removeEventListener('keydown', handleTabKey as any);
    };
  },

  /**
   * Set focus to first focusable element
   */
  focusFirst: (element: HTMLElement) => {
    const focusableElement = element.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement;
    
    if (focusableElement) {
      focusableElement.focus();
    }
  },

  /**
   * Set focus to last focusable element
   */
  focusLast: (element: HTMLElement) => {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    if (lastElement) {
      lastElement.focus();
    }
  },
};

/**
 * Color contrast utilities
 */
export const colorContrast = {
  /**
   * Check if color meets WCAG contrast requirements
   */
  meetsContrast: (foreground: string, background: string, level: 'AA' | 'AAA' = 'AA'): boolean => {
    // This is a simplified implementation
    // In a real application, you would use a proper color contrast library
    const ratio = level === 'AA' ? 4.5 : 7;
    // Implementation would calculate actual contrast ratio
    return true; // Placeholder
  },

  /**
   * Get accessible color variants
   */
  getAccessibleColors: (baseColor: string) => ({
    light: `${baseColor}-100`,
    medium: `${baseColor}-500`,
    dark: `${baseColor}-700`,
    contrast: `${baseColor}-900`,
  }),
};

/**
 * Common accessibility patterns
 */
export const patterns = {
  /**
   * Skip link pattern
   */
  skipLink: (target: string, label: string = 'Skip to main content') => (
    <a
      href={target}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded z-50"
      aria-label={label}
    >
      {label}
    </a>
  ),

  /**
   * Loading state pattern
   */
  loadingState: (label: string, isLoading: boolean) => ({
    'aria-busy': isLoading,
    'aria-label': isLoading ? `${label} (loading)` : label,
  }),

  /**
   * Error state pattern
   */
  errorState: (label: string, hasError: boolean, errorMessage?: string) => ({
    'aria-invalid': hasError,
    'aria-describedby': hasError ? `${label}-error` : undefined,
    'aria-label': hasError ? `${label} (error: ${errorMessage})` : label,
  }),
};