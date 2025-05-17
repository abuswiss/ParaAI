import React from 'react';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  rounded?: boolean;
  icon?: React.ReactElement;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'secondary',
  size = 'sm',
  rounded = false,
  icon,
  className = '',
}) => {
  // Base classes that all badges share
  const baseClasses = 'inline-flex items-center font-medium';

  // Size-specific classes
  const sizeClasses = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-2.5 py-1.5',
  };

  // Variant-specific classes
  const variantClasses = {
    primary: 'bg-primary/20 text-primary dark:bg-dark-primary/20 dark:text-dark-primary',
    secondary: 'bg-secondary text-secondary-foreground dark:bg-dark-secondary dark:text-dark-secondary-foreground',
    success: 'bg-green-100 text-green-700 dark:bg-green-800/30 dark:text-green-200',
    warning: 'bg-warning/20 text-amber-700 dark:bg-warning/30 dark:text-amber-200',
    danger: 'bg-destructive/20 text-red-700 dark:bg-destructive/30 dark:text-red-200',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-800/30 dark:text-blue-200',
  };

  // Icon size classes
  const iconSizeClasses = {
    xs: 'h-3 w-3 mr-1',
    sm: 'h-3.5 w-3.5 mr-1',
    md: 'h-4 w-4 mr-1.5',
  };

  // Combine all classes
  const badgeClasses = `
    ${baseClasses}
    ${sizeClasses[size]}
    ${variantClasses[variant]}
    ${rounded ? 'rounded-full' : 'rounded-md'}
    ${className}
  `;

  return (
    <span className={badgeClasses}>
      {icon && <span className={iconSizeClasses[size]}>{icon}</span>}
      {children}
    </span>
  );
};
