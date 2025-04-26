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
    primary: 'bg-primary/20 text-primary',
    secondary: 'bg-gray-700/70 text-gray-300',
    success: 'bg-green-900/30 text-green-400',
    warning: 'bg-yellow-900/30 text-yellow-300',
    danger: 'bg-red-900/30 text-red-400',
    info: 'bg-blue-900/30 text-blue-400',
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
