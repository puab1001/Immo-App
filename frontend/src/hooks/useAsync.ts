// src/hooks/useAsync.ts
import { useState, useCallback, useRef } from 'react';
import { useToast } from './useToast';
import { ApiError } from '@/types/common';

interface UseAsyncOptions {
  successMessage?: string;
  errorMessage?: string;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  retryCount?: number;
  autoExecute?: boolean;
}

export function useAsync<T>(
  asyncFunction: (...args: any[]) => Promise<T>,
  options: UseAsyncOptions = {}
) {
  const [isLoading, setIsLoading] = useState(options.autoExecute === true);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);
  const { toast } = useToast();
  
  // Verwenden von useRef für die aktuelle Operation, um Race-Conditions zu vermeiden
  const activeRequest = useRef<AbortController | null>(null);
  
  const execute = useCallback(
    async (...args: any[]): Promise<T> => {
      // Abbrechen einer bereits laufenden Operation
      if (activeRequest.current) {
        activeRequest.current.abort();
      }
      
      // Neue AbortController für diese Operation
      const controller = new AbortController();
      activeRequest.current = controller;
      
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await asyncFunction(...args);
        
        // Nur wenn diese Operation nicht abgebrochen wurde, Daten setzen
        if (!controller.signal.aborted) {
          setData(response);
          
          if (options.showSuccessToast !== false && options.successMessage) {
            toast({
              title: 'Erfolg',
              description: options.successMessage,
              duration: 3000,
            });
          }
        }
        
        return response;
      } catch (err) {
        // Nur wenn diese Operation nicht abgebrochen wurde, Fehler setzen
        if (!controller.signal.aborted) {
          console.error('Fehler in useAsync:', err);
          
          const error = err instanceof Error ? err : new Error('Ein Fehler ist aufgetreten');
          setError(error);
          
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
        }
        
        throw err;
      } finally {
        // Nur wenn diese Operation nicht abgebrochen wurde, isLoading zurücksetzen
        if (!controller.signal.aborted) {
          setIsLoading(false);
          activeRequest.current = null;
        }
      }
    },
    [asyncFunction, options, toast]
  );

  // Auto-execute if the option is enabled
  const didAutoExecute = useRef(false);
  if (options.autoExecute && !didAutoExecute.current && !isLoading && !data && !error) {
    didAutoExecute.current = true;
    execute();
  }

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const retry = useCallback(async (...args: any[]) => {
    if (isLoading) return;
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