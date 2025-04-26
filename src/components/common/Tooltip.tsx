import React, { ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

/**
 * Tooltip component for displaying helpful information on hover
 */
export const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  children, 
  position = 'top',
  className = ''
}) => {
  const positionClasses = {
    'top': 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    'right': 'left-full top-1/2 transform -translate-y-1/2 ml-2',
    'bottom': 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    'left': 'right-full top-1/2 transform -translate-y-1/2 mr-2'
  };

  return (
    <div className="relative group inline-block">
      {children}
      <div className={`absolute z-50 hidden group-hover:block ${positionClasses[position]} ${className}`}>
        <div className="bg-gray-900 text-white text-sm rounded-md py-1 px-2 shadow-lg border border-primary">
          {content}
        </div>
      </div>
    </div>
  );
};
