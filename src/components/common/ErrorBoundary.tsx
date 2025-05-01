import { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Icons } from "@/components/ui/Icons"; // Assuming AlertTriangle is here

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch JavaScript errors anywhere in the child component tree,
 * log those errors, and display a fallback UI instead of the component tree that crashed.
 * 
 * This helps prevent the entire app from crashing when an error occurs in a specific component.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to an error reporting service
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    
    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Default fallback UI using shadcn/ui Alert and Button
      return (
        <Alert variant="destructive" className="m-4">
          <Icons.AlertTriangle className="h-4 w-4" />
          <AlertTitle>Something Went Wrong</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>An unexpected error occurred.</p>
            {/* Optionally display error message in dev mode */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="mt-2 text-xs whitespace-pre-wrap bg-background/50 p-2 rounded">
                {this.state.error.message}
              </pre>
            )}
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-2"
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
