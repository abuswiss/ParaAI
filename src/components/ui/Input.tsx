import React, { forwardRef, InputHTMLAttributes } from 'react';

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
      ...rest
    },
    ref
  ) => {
    // Generate an ID for the input if not provided
    const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;
    
    // Base input classes
    const baseInputClasses = 'bg-gray-700 border text-text-primary placeholder-gray-400 focus:ring-primary focus:border-primary transition-colors duration-200 appearance-none rounded-md';
    
    // Error state classes
    const errorClasses = error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-600';
    
    // Padding classes based on presence of icons
    const paddingClasses = leftIcon 
      ? 'pl-10' 
      : rightIcon 
        ? 'pr-10' 
        : 'px-4';
    
    // Width classes
    const widthClasses = isFullWidth ? 'w-full' : '';
    
    // Disabled classes
    const disabledClasses = isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-800' : '';
    
    // Combine all classes
    const inputClasses = `
      ${baseInputClasses}
      ${errorClasses}
      ${paddingClasses}
      py-2
      ${widthClasses}
      ${disabledClasses}
      ${className}
    `;
    
    return (
      <div className={`${isFullWidth ? 'w-full' : ''} ${containerClassName}`}>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-300 mb-1">
            {label}
          </label>
        )}
        
        <div className="relative">
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
