import React, { ReactNode, forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends HTMLMotionProps<'button'> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isFullWidth?: boolean;
  leftIcon?: React.ReactElement;
  rightIcon?: React.ReactElement;
  animateOnHover?: boolean;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      isFullWidth = false,
      leftIcon,
      rightIcon,
      animateOnHover = true,
      className = '',
      disabled,
      type = 'button',
      ...rest
    }: ButtonProps,
    ref: React.Ref<HTMLButtonElement>
  ) => {
    // Base classes that all buttons share
    const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 ease-in-out rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed';
    
    // Size-specific classes
    const sizeClasses: Record<string, string> = {
      sm: 'text-xs px-2.5 py-1.5 focus:ring-1',
      md: 'text-sm px-4 py-2',
      lg: 'text-base px-6 py-3',
    };
    
    // Variant-specific classes
    const variantClasses: Record<string, string> = {
      primary: 'bg-primary text-white hover:bg-primary-dark focus:ring-primary',
      secondary: 'bg-gray-700 text-text-primary hover:bg-gray-600 focus:ring-gray-600',
      outline: 'bg-transparent border border-gray-600 text-text-primary hover:bg-gray-800 focus:ring-gray-600',
      ghost: 'bg-transparent text-text-primary hover:bg-gray-800 focus:ring-gray-600',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600',
    };
    
    // Animation settings for hover effect if enabled
    const hoverAnimation = animateOnHover
      ? {
          whileHover: { scale: 1.02 },
          whileTap: { scale: 0.98 },
        }
      : {};
    
    // Combine all classes
    const buttonClasses = `
      ${baseClasses}
      ${sizeClasses[size]}
      ${variantClasses[variant]}
      ${isFullWidth ? 'w-full' : ''}
      ${className}
    `;
    
    return (
      <motion.button
        ref={ref}
        className={buttonClasses}
        disabled={isLoading || disabled}
        type={type}
        {...hoverAnimation}
        {...rest}
      >
        {isLoading && (
          <span className="mr-2">
            <Spinner size={size === 'lg' ? 'md' : 'sm'} />
          </span>
        )}
        
        {!isLoading && leftIcon && (
          <span className={`mr-2 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
            {leftIcon}
          </span>
        )}
        
        {children}
        
        {!isLoading && rightIcon && (
          <span className={`ml-2 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
            {rightIcon}
          </span>
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
