import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from './use-toast';
import { ToastAction } from '@/components/ui/toast';

// Track active error toast to prevent duplicates
let activeErrorToastId: string | null = null;
let hasShownError = false;

/**
 * Detect if an error should show a toast notification
 * Covers 5xx server errors, 429 rate limiting, and other critical errors
 */
function isCriticalError(error: any): { isCritical: boolean; status?: string } {
  if (!error) return { isCritical: false };
  
  // Check error message for status code pattern (e.g., "503: Service Unavailable")
  const statusMatch = error?.message?.match(/^(\d{3}):/);
  if (statusMatch) {
    const status = statusMatch[1];
    // Cover 5xx errors and 429 rate limiting
    return {
      isCritical: status.startsWith('5') || status === '429',
      status
    };
  }
  
  // Check if error message contains error keywords
  const message = error?.message?.toLowerCase() || '';
  
  // 5xx errors
  if (message.includes('service unavailable') || message.includes('503')) {
    return { isCritical: true, status: '503' };
  }
  if (message.includes('internal server error') || message.includes('500')) {
    return { isCritical: true, status: '500' };
  }
  if (message.includes('bad gateway') || message.includes('502')) {
    return { isCritical: true, status: '502' };
  }
  if (message.includes('gateway timeout') || message.includes('504')) {
    return { isCritical: true, status: '504' };
  }
  
  // 429 rate limiting
  if (message.includes('too many requests') || message.includes('429') || message.includes('rate limit')) {
    return { isCritical: true, status: '429' };
  }
  
  return { isCritical: false };
}

/**
 * Get user-friendly error message for status code
 */
function getErrorMessage(status?: string): { title: string; description: string } {
  switch (status) {
    case '503':
      return {
        title: 'Server Unavailable',
        description: 'The server is temporarily unavailable. Please try again in a moment.',
      };
    case '500':
      return {
        title: 'Server Error',
        description: 'The server encountered an unexpected error.',
      };
    case '502':
      return {
        title: 'Bad Gateway',
        description: 'Unable to reach the server.',
      };
    case '504':
      return {
        title: 'Gateway Timeout',
        description: 'The server took too long to respond.',
      };
    case '429':
      return {
        title: 'Too Many Requests',
        description: 'You have made too many requests. Please wait a moment before trying again.',
      };
    default:
      return {
        title: 'Server Error',
        description: 'The server encountered an error. Please try again.',
      };
  }
}

/**
 * Global error handler hook that monitors all React Query errors
 * and shows persistent toast notifications for critical server errors
 * (5xx server errors, 429 rate limiting, etc.)
 */
export function useGlobalErrorHandler() {
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Subscribe to query cache to monitor all query state changes
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      // Handle query errors
      if (event?.type === 'updated' && event?.query?.state?.error) {
        const error = event.query.state.error;
        const { isCritical, status } = isCriticalError(error);
        
        if (isCritical) {
          const { title, description } = getErrorMessage(status);
          
          // Dismiss existing error toast if present
          if (activeErrorToastId) {
            // Update existing toast instead of creating new one
            return;
          }
          
          // Show new error toast
          const result = toast({
            title,
            description,
            variant: 'destructive',
            duration: Infinity, // Persistent - doesn't auto-dismiss
            action: (
              <ToastAction 
                altText="Reload page"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </ToastAction>
            ),
          });
          
          activeErrorToastId = result.id;
          hasShownError = true;
          
          console.log(`[GlobalErrorHandler] ${status} error detected, showing toast`);
        }
      }
      
      // Handle successful queries - auto-dismiss error toast
      if (event?.type === 'updated' && 
          !event?.query?.state?.error && 
          event?.query?.state?.data &&
          hasShownError) {
        
        // Only dismiss if we have an active error toast
        if (activeErrorToastId) {
          console.log('[GlobalErrorHandler] Successful query detected, dismissing error toast');
          
          // Use the dismiss function from the toast system
          const toastSystem = (window as any).__toastDismiss;
          if (toastSystem) {
            toastSystem(activeErrorToastId);
          }
          
          activeErrorToastId = null;
          hasShownError = false;
        }
      }
    });

    unsubscribeRef.current = unsubscribe;

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [queryClient]);
}

