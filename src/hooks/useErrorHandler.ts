import { useState, useCallback } from 'react';
import { errorService, ErrorSeverity } from '../services/errorService';

/**
 * Interface for error state
 */
interface ErrorState {
  hasError: boolean;
  message: string | null;
  code?: string;
  severity: ErrorSeverity;
}

/**
 * Hook for consistent error handling throughout the application
 */
export function useErrorHandler(componentName?: string) {
  const [error, setError] = useState<ErrorState>({
    hasError: false,
    message: null,
    severity: ErrorSeverity.ERROR
  });

  /**
   * Handle and log an error
   */
  const handleError = useCallback((err: unknown, context?: Record<string, unknown>) => {
    let errorMessage: string;
    let errorCode: string | undefined;
    const severity = ErrorSeverity.ERROR;

    // Extract error details based on type
    if (typeof err === 'string') {
      errorMessage = err;
    } else if (err instanceof Error) {
      errorMessage = err.message;
      // Check for specific error types
      if (typeof (err as { code?: unknown }).code === 'string') {
        errorCode = (err as { code?: string }).code;
      }
    } else {
      errorMessage = 'An unknown error occurred';
    }

    // Set error state
    setError({
      hasError: true,
      message: errorMessage,
      code: errorCode,
      severity
    });

    // Log the error
    errorService.logError(
      errorMessage, 
      severity, 
      { 
        component: componentName,
        ...context
      }
    );

    return errorMessage;
  }, [componentName]);

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setError({
      hasError: false,
      message: null,
      severity: ErrorSeverity.ERROR
    });
  }, []);

  /**
   * Set a warning message
   */
  const setWarning = useCallback((message: string, context?: Record<string, unknown>) => {
    setError({
      hasError: true,
      message,
      severity: ErrorSeverity.WARNING
    });
    
    // Log warning
    errorService.logWarning(message, { component: componentName, ...context });
  }, [componentName]);

  /**
   * Wrap an async function with error handling
   */
  const withHandling = useCallback(<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    context?: Record<string, unknown>
  ) => {
    return async (...args: T): Promise<R> => {
      try {
        const result = await fn(...args);
        return result;
      } catch (err) {
        handleError(err, { ...context, arguments: args });
        throw err;
      }
    };
  }, [handleError]);

  return {
    error,
    handleError,
    clearError,
    setWarning,
    withHandling
  };
}
