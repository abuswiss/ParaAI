import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  placement?: TooltipPlacement;
  delay?: number;
  maxWidth?: string;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  placement = 'top',
  delay = 300,
  maxWidth = '200px',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    const id = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    setTimeoutId(id);
  };

  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  // Placement specific classes for positioning the tooltip
  const placementClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
  };

  // Placement specific arrow classes
  const arrowClasses = {
    top: 'bottom-[-5px] left-1/2 transform -translate-x-1/2 border-t-gray-800 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'top-[-5px] left-1/2 transform -translate-x-1/2 border-b-gray-800 border-l-transparent border-r-transparent border-t-transparent',
    left: 'right-[-5px] top-1/2 transform -translate-y-1/2 border-l-gray-800 border-t-transparent border-b-transparent border-r-transparent',
    right: 'left-[-5px] top-1/2 transform -translate-y-1/2 border-r-gray-800 border-t-transparent border-b-transparent border-l-transparent',
  };

  // Animation variants for different placements
  const animationVariants = {
    top: {
      hidden: { opacity: 0, y: -5 },
      visible: { opacity: 1, y: 0 },
    },
    bottom: {
      hidden: { opacity: 0, y: 5 },
      visible: { opacity: 1, y: 0 },
    },
    left: {
      hidden: { opacity: 0, x: -5 },
      visible: { opacity: 1, x: 0 },
    },
    right: {
      hidden: { opacity: 0, x: 5 },
      visible: { opacity: 1, x: 0 },
    },
  };

  return (
    <div className="relative inline-block" onMouseEnter={showTooltip} onMouseLeave={hideTooltip}>
      {children}
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className={`absolute z-50 ${placementClasses[placement]} ${className}`}
            style={{ maxWidth }}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={animationVariants[placement]}
            transition={{ duration: 0.2 }}
          >
            <div className="bg-gray-800 text-text-primary rounded-md shadow-lg p-2 text-xs">
              {content}
            </div>
            <div 
              className={`absolute w-0 h-0 border-4 ${arrowClasses[placement]}`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
