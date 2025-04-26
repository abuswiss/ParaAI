import { supabase } from '../lib/supabaseClient';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Interface for error log entries
 */
export interface ErrorLog {
  id?: string;
  timestamp: string;
  message: string;
  code?: string;
  stack?: string;
  severity: ErrorSeverity;
  userId?: string;
  component?: string;
  context?: Record<string, any>;
}

/**
 * Error handling and logging service
 * Provides centralized error logging, tracking, and handling
 */
class ErrorService {
  private static instance: ErrorService;
  private isInitialized = false;
  private isDevelopment = process.env.NODE_ENV === 'development';
  
  // In-memory queue for errors when offline
  private errorQueue: ErrorLog[] = [];
  
  private constructor() {
    // Initialize error handling
    window.addEventListener('error', this.handleGlobalError.bind(this));
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    
    // Check and send any queued errors on startup
    this.processErrorQueue();
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): ErrorService {
    if (!ErrorService.instance) {
      ErrorService.instance = new ErrorService();
    }
    return ErrorService.instance;
  }
  
  /**
   * Initialize the error service with user information
   */
  public initialize(): void {
    if (this.isInitialized) return;
    
    // Any additional initialization can go here
    this.isInitialized = true;
    
    console.log('Error service initialized');
  }
  
  /**
   * Log an error to the database and console
   */
  public async logError(error: Error | string, severity: ErrorSeverity = ErrorSeverity.ERROR, context?: Record<string, any>): Promise<void> {
    const message = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? undefined : error.stack;
    
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      message,
      stack,
      severity,
      context
    };
    
    // Always log to console in development
    if (this.isDevelopment) {
      console.error('Error logged:', errorLog);
    }
    
    try {
      // Try to get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        errorLog.userId = user.id;
      }
      
      // Log to database
      const { error: dbError } = await supabase
        .from('error_logs')
        .insert(errorLog);
      
      if (dbError) {
        console.error('Failed to log error:', dbError);
        this.queueError(errorLog);
      }
    } catch (e) {
      console.error('Error while logging error:', e);
      this.queueError(errorLog);
    }
  }
  
  /**
   * Log an informational message
   */
  public logInfo(message: string, context?: Record<string, any>): void {
    this.logError(message, ErrorSeverity.INFO, context);
  }
  
  /**
   * Log a warning
   */
  public logWarning(message: string | Error, context?: Record<string, any>): void {
    this.logError(message, ErrorSeverity.WARNING, context);
  }
  
  /**
   * Log a critical error
   */
  public logCritical(error: string | Error, context?: Record<string, any>): void {
    this.logError(error, ErrorSeverity.CRITICAL, context);
  }
  
  /**
   * Handle global window errors
   */
  private handleGlobalError(event: ErrorEvent): void {
    this.logError(event.error || event.message, ErrorSeverity.ERROR, {
      filename: event.filename,
      lineNumber: event.lineno,
      columnNumber: event.colno
    });
  }
  
  /**
   * Handle unhandled promise rejections
   */
  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));
    
    this.logError(error, ErrorSeverity.ERROR, {
      type: 'unhandledRejection',
      promise: event.promise
    });
  }
  
  /**
   * Queue an error for later submission (when offline)
   */
  private queueError(errorLog: ErrorLog): void {
    this.errorQueue.push(errorLog);
    
    // Store in localStorage for persistence
    try {
      localStorage.setItem('errorQueue', JSON.stringify(this.errorQueue));
    } catch (e) {
      console.error('Failed to store error queue:', e);
    }
  }
  
  /**
   * Process any queued errors
   */
  private async processErrorQueue(): Promise<void> {
    // Load any stored errors
    try {
      const storedQueue = localStorage.getItem('errorQueue');
      if (storedQueue) {
        this.errorQueue = JSON.parse(storedQueue);
      }
    } catch (e) {
      console.error('Failed to load error queue:', e);
    }
    
    if (this.errorQueue.length === 0) return;
    
    // Try to send queued errors
    const errors = [...this.errorQueue];
    this.errorQueue = [];
    
    try {
      const { error } = await supabase
        .from('error_logs')
        .insert(errors);
      
      if (error) {
        console.error('Failed to send queued errors:', error);
        // Put errors back in queue
        this.errorQueue = [...this.errorQueue, ...errors];
      } else {
        // Clear stored queue
        localStorage.removeItem('errorQueue');
      }
    } catch (e) {
      console.error('Error processing error queue:', e);
      // Put errors back in queue
      this.errorQueue = [...this.errorQueue, ...errors];
    }
  }
}

// Export singleton instance
export const errorService = ErrorService.getInstance();

/**
 * Higher-order function to wrap an async function with error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  errorHandler?: (error: Error) => void,
  component?: string
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Log the error
      errorService.logError(error as Error, ErrorSeverity.ERROR, {
        component,
        arguments: args
      });
      
      // Call custom error handler if provided
      if (errorHandler) {
        errorHandler(error as Error);
      }
      
      throw error;
    }
  };
}
