import React from 'react';
import { motion } from 'framer-motion';

export interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  actions?: React.ReactNode;
  elevation?: 'none' | 'low' | 'medium' | 'high';
  hover?: boolean;
  border?: boolean;
  className?: string;
  contentClassName?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  footer,
  actions,
  elevation = 'low',
  hover = false,
  border = false,
  className = '',
  contentClassName = '',
}) => {
  // Elevation classes for different shadow depths
  const elevationClasses = {
    none: '',
    low: 'shadow-sm',
    medium: 'shadow-md',
    high: 'shadow-lg',
  };

  // Base classes for the card
  const baseClasses = 'flex flex-col rounded-lg overflow-hidden bg-gray-800';
  
  // Hover effect classes
  const hoverClasses = hover ? 'transition-all duration-200 hover:translate-y-[-2px] hover:shadow-lg' : '';
  
  // Border classes
  const borderClasses = border ? 'border border-gray-700' : '';
  
  // Combine all classes
  const cardClasses = `
    ${baseClasses}
    ${elevationClasses[elevation]}
    ${hoverClasses}
    ${borderClasses}
    ${className}
  `;

  return (
    <motion.div 
      className={cardClasses}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Card header with title, subtitle, and actions */}
      {(title || actions) && (
        <div className="px-4 py-3 border-b border-gray-700 flex justify-between items-center">
          <div>
            {title && <h3 className="text-md font-medium text-text-primary">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center space-x-2">{actions}</div>}
        </div>
      )}
      
      {/* Card content */}
      <div className={`flex-1 p-4 ${contentClassName}`}>
        {children}
      </div>
      
      {/* Card footer */}
      {footer && (
        <div className="px-4 py-3 border-t border-gray-700 bg-gray-800/50">
          {footer}
        </div>
      )}
    </motion.div>
  );
};
