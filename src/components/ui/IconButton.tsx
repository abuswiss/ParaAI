import React, { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Spinner } from './Spinner';

export type IconButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends HTMLMotionProps<'button'> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  isLoading?: boolean;
  icon: React.ReactElement;
  label: string;
  animateOnHover?: boolean;
  rounded?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      label,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      animateOnHover = true,
      rounded = false,
      className = '',
      disabled,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    // Base classes that all icon buttons share
    const baseClasses = 'inline-flex items-center justify-center transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed';
    
    // Size-specific classes
    const sizeClasses = {
      sm: 'p-1.5 focus:ring-1',
      md: 'p-2',
      lg: 'p-3',
    };
    
    // Icon size classes
    const iconSizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    };
    
    // Variant-specific classes
    const variantClasses = {
      primary: 'bg-primary text-white hover:bg-primary-dark focus:ring-primary',
      secondary: 'bg-gray-700 text-text-primary hover:bg-gray-600 focus:ring-gray-600',
      outline: 'bg-transparent border border-gray-600 text-text-primary hover:bg-gray-800 focus:ring-gray-600',
      ghost: 'bg-transparent text-text-primary hover:bg-gray-800 focus:ring-gray-600',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600',
    };
    
    // Animation settings for hover effect if enabled
    const hoverAnimation = animateOnHover
      ? {
          whileHover: { scale: 1.1 },
          whileTap: { scale: 0.95 },
        }
      : {};
    
    // Combine all classes
    const buttonClasses = `
      ${baseClasses}
      ${sizeClasses[size]}
      ${variantClasses[variant]}
      ${rounded ? 'rounded-full' : 'rounded-md'}
      ${className}
    `;
    
    return (
      <motion.button
        ref={ref}
        className={buttonClasses}
        disabled={isLoading || disabled}
        type={type}
        aria-label={label}
        title={label}
        {...hoverAnimation}
        {...rest}
      >
        {isLoading ? (
          <Spinner size={size === 'lg' ? 'md' : 'sm'} color={variant === 'outline' || variant === 'ghost' ? 'gray' : 'white'} />
        ) : (
          <span className={iconSizeClasses[size]}>
            {icon}
          </span>
        )}
      </motion.button>
    );
  }
);

IconButton.displayName = 'IconButton';
