// src/hooks/useAsync.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from './useToast';
import { ApiError } from '@/types/common';

interface UseAsyncOptions {
  successMessage?: string;
  errorMessage?: string;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  retryCount?: number;
  autoExecute?: boolean;
  loadingTimeout?: number; // Timeout in ms after which loading state will be cleared
}

export function useAsync<T>(
  asyncFunction: (...args: any[]) => Promise<T>,
  options: UseAsyncOptions = {}
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);
  const { toast } = useToast();
  
  // Keep track of auto-execute status
  const didAutoExecute = useRef(false);
  
  // Track component mount status to prevent state updates after unmount
  const isMounted = useRef(true);
  
  // Track current request to allow cancellation
  const activeRequest = useRef<AbortController | null>(null);
  const attemptCount = useRef(0);

  // Setup cleanup on component unmount
  useEffect(() => {
    console.log('useAsync hook initialized');
    isMounted.current = true;
    
    return () => {
      console.log('useAsync cleanup - component unmounting');
      isMounted.current = false;
      
      if (activeRequest.current) {
        console.log('Aborting active request on unmount');
        activeRequest.current.abort();
        activeRequest.current = null;
      }
    };
  }, []);

  const execute = useCallback(
    async (...args: any[]): Promise<T> => {
      // Safety check - don't start a new request if component is unmounted
      if (!isMounted.current) {
        console.log('Execute called but component is unmounted, skipping');
        return Promise.reject(new Error('Component unmounted'));
      }
      
      console.log('Execute called with loading state:', isLoading);
      
      // Cancel any in-progress requests
      if (activeRequest.current) {
        console.log('Aborting previous request');
        activeRequest.current.abort();
      }
      
      // Create new abort controller for this request
      const controller = new AbortController();
      activeRequest.current = controller;
      
      attemptCount.current += 1;
      console.log(`Executing async operation (attempt ${attemptCount.current})`);
      
      // Set up loading timeout to prevent infinite loading state
      let loadingTimeoutId: NodeJS.Timeout | null = null;
      if (options.loadingTimeout) {
        loadingTimeoutId = setTimeout(() => {
          // Only update state if component is still mounted
          if (isMounted.current && isLoading) {
            console.warn(`Loading timeout reached after ${options.loadingTimeout}ms`);
            setIsLoading(false);
          }
        }, options.loadingTimeout);
      }
      
      // Update loading state at the beginning
      setIsLoading(true);
      console.log('Setting isLoading to true');
      setError(null);
      
      try {
        const response = await asyncFunction(...args);
        
        // Only update state if this request wasn't aborted and component is mounted
        if (!controller.signal.aborted && isMounted.current) {
          console.log('Operation successful, setting data');
          setData(response);
          
          // Show success toast if configured
          if (options.showSuccessToast !== false && options.successMessage) {
            toast({
              title: 'Erfolg',
              description: options.successMessage,
              duration: 3000,
            });
          }
        } else {
          console.log('Request completed but was either aborted or component unmounted');
        }
        
        return response;
      } catch (err) {
        // Only update error state if request wasn't aborted and component is mounted
        if (!controller.signal.aborted && isMounted.current) {
          console.error('Fehler in useAsync:', err);
          
          const error = err instanceof Error ? err : new Error('Ein Fehler ist aufgetreten');
          setError(error);
          
          // Show error toast if configured
          if (options.showErrorToast !== false) {
            const errorMessage = err instanceof ApiError 
              ? err.message 
              : options.errorMessage || 'Ein unerwarteter Fehler ist aufgetreten';
            
            toast({
              title: 'Fehler',
              description: errorMessage,
              variant: 'destructive',
              duration: 5000,
            });
          }
          
          // Auto-retry if configured and attempts not exhausted
          const maxRetries = options.retryCount || 0;
          if (maxRetries > 0 && attemptCount.current <= maxRetries) {
            console.log(`Auto-retrying (${attemptCount.current}/${maxRetries})`);
            setTimeout(() => execute(...args), 1000); // 1 second delay
          }
        } else {
          console.log('Error occurred but request was aborted or component unmounted');
        }
        
        throw err;
      } finally {
        // Clean up timeout
        if (loadingTimeoutId) {
          clearTimeout(loadingTimeoutId);
        }
        
        // CRITICAL FIX: Always reset loading state if component is mounted
        if (isMounted.current) {
          console.log('Resetting loading state to false');
          setIsLoading(false);
          // Only clear activeRequest if this is the current request
          if (activeRequest.current === controller) {
            activeRequest.current = null;
          }
        } else {
          console.log('Component unmounted, not updating state');
        }
      }
    },
    [asyncFunction, options, toast, isLoading]
  );

  // Auto-execute if configured
  useEffect(() => {
    if (options.autoExecute && !didAutoExecute.current && !isLoading && !data && !error) {
      console.log('Auto-executing function');
      didAutoExecute.current = true;
      execute().catch(err => {
        if (err.message !== 'Component unmounted') {
          console.error('Auto-execute error:', err);
        }
      });
    }
  }, [options.autoExecute, isLoading, data, error, execute]);

  // Reset state
  const reset = useCallback(() => {
    if (isMounted.current) {
      setData(null);
      setError(null);
      setIsLoading(false);
      attemptCount.current = 0;
      console.log('State reset');
    }
  }, []);

  // Retry operation
  const retry = useCallback(async (...args: any[]) => {
    if (isLoading || !isMounted.current) return;
    console.log('Retrying operation');
    attemptCount.current = 0;
    return execute(...args);
  }, [execute, isLoading]);

  return {
    execute,
    isLoading,
    error,
    data,
    reset,
    retry
  };
}