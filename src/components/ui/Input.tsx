import React, { forwardRef, InputHTMLAttributes, useState } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactElement;
  rightIcon?: React.ReactElement;
  hint?: string;
  isFullWidth?: boolean;
  isDisabled?: boolean;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      leftIcon,
      rightIcon,
      hint,
      isFullWidth = true,
      isDisabled = false,
      containerClassName = '',
      className = '',
      id,
      onFocus,
      onBlur,
      ...rest
    },
    ref
  ) => {
    // Track hover and focus states
    const [isHovered, setIsHovered] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    
    // Generate an ID for the input if not provided
    const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;
    
    // Handle hover events
    const handleMouseEnter = () => {
      if (!isDisabled) setIsHovered(true);
    };
    
    const handleMouseLeave = () => {
      setIsHovered(false);
    };
    
    // Handle focus events
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      if (onFocus) onFocus(e);
    };
    
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      if (onBlur) onBlur(e);
    };
    
    // Determine border color based on state
    let borderColor = 'border-gray-600'; // default
    
    if (error) {
      borderColor = 'border-red-500';
    } else if (isFocused) {
      borderColor = 'border-primary';
    } else if (isHovered) {
      borderColor = 'border-orange-500';
    }
    
    // Create combined classes
    const inputClasses = `
      bg-gray-700
      border
      rounded-md
      py-2
      text-text-primary
      placeholder-gray-400
      ${leftIcon ? 'pl-10' : rightIcon ? 'pr-10' : 'px-4'}
      ${isFullWidth ? 'w-full' : ''}
      ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-800' : ''}
      transition-all
      duration-300
      ${borderColor}
      ${isFocused ? 'ring-1 ring-primary' : ''}
      ${className}
    `;
    
    return (
      <div className={`${isFullWidth ? 'w-full' : ''} ${containerClassName}`}>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-300 mb-1">
            {label}
          </label>
        )}
        
        <div 
          className="relative" 
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            disabled={isDisabled}
            className={inputClasses}
            onFocus={handleFocus}
            onBlur={handleBlur}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...rest}
          />
          
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>
        
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-xs text-red-500">
            {error}
          </p>
        )}
        
        {hint && !error && (
          <p id={`${inputId}-hint`} className="mt-1 text-xs text-gray-400">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';