import React, { useRef, useEffect, useState } from 'react';

interface DocumentMinimapProps {
  contentRef: React.RefObject<HTMLDivElement>;
  className?: string;
}

/**
 * DocumentMinimap component provides a miniature navigation for long documents
 * Shows current viewport position and allows quick navigation by clicking
 */
export const DocumentMinimap: React.FC<DocumentMinimapProps> = ({ 
  contentRef,
  className = ''
}) => {
  const [scrollRatio, setScrollRatio] = useState(0);
  const [viewportRatio, setViewportRatio] = useState(0.2);
  const minimapRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!contentRef.current) return;
    
    const updatePosition = () => {
      if (!contentRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      // Calculate the scroll position as a ratio of the total scrollable area
      setScrollRatio(scrollTop / (scrollHeight - clientHeight) || 0);
      // Calculate the viewport size as a ratio of the total content
      setViewportRatio(Math.min(clientHeight / scrollHeight, 1));
    };
    
    // Initial update
    updatePosition();
    
    // Add scroll event listener
    const contentElement = contentRef.current;
    contentElement.addEventListener('scroll', updatePosition);
    
    // Clean up
    return () => {
      contentElement.removeEventListener('scroll', updatePosition);
    };
  }, [contentRef]);
  
  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!minimapRef.current || !contentRef.current) return;
    
    const rect = minimapRef.current.getBoundingClientRect();
    const clickRatio = (e.clientY - rect.top) / rect.height;
    
    const { scrollHeight, clientHeight } = contentRef.current;
    const scrollableArea = scrollHeight - clientHeight;
    
    // Set scroll position based on click location
    contentRef.current.scrollTop = clickRatio * scrollableArea;
  };
  
  return (
    <div 
      ref={minimapRef}
      className={`fixed right-6 h-48 w-2 bg-gray-800 rounded-full overflow-hidden cursor-pointer ${className}`}
      onClick={handleMinimapClick}
    >
      <div 
        className="absolute w-full bg-primary transition-all duration-100 ease-out rounded-full"
        style={{
          top: `${scrollRatio * (1 - viewportRatio) * 100}%`,
          height: `${viewportRatio * 100}%`,
          minHeight: '20px'
        }}
      />
    </div>
  );
};
