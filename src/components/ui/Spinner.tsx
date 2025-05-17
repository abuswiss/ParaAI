import React from 'react';

export interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'gray';
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'md', 
  color = 'primary',
  className = '' 
}) => {
  // Size-specific classes
  const sizeClasses = {
    xs: 'h-3 w-3 border-[1.5px]',
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-3',
  };
  
  // Color-specific classes
  const colorClasses = {
    primary: 'border-primary/20 border-t-primary dark:border-dark-primary/20 dark:border-t-dark-primary',
    white: 'border-white/20 border-t-white dark:border-dark-foreground/20 dark:border-t-dark-foreground',
    gray: 'border-muted-foreground/20 border-t-muted-foreground dark:border-dark-muted-foreground/20 dark:border-t-dark-muted-foreground',
  };
  
  return (
    <div className={`inline-block ${className}`} role="status" aria-label="Loading">
      <div className={`
        ${sizeClasses[size]}
        ${colorClasses[color]}
        animate-spin rounded-full
      `} />
      <span className="sr-only">Loading...</span>
    </div>
  );
};
