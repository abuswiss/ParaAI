import React, { ReactNode, MouseEventHandler } from 'react';
import { X } from 'lucide-react';

// --- Modal Components --- //

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'; // Example sizes
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, size = 'md' }) => {
  if (!isOpen) return null;

  // Simple size mapping (adjust Tailwind classes as needed)
  const sizeClasses: Record<string, string> = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
    full: 'sm:max-w-full h-full',
  };

  return (
    // Outer container fixed to viewport
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4" 
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose} // Close on clicking overlay
    >
      {children}
    </div>
  );
};

// --- Modal Overlay --- //

interface ModalOverlayProps {
  className?: string;
}

export const ModalOverlay: React.FC<ModalOverlayProps> = ({ className = '' }) => {
  return (
    <div 
      className={`fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm transition-opacity ${className}`} 
      aria-hidden="true"
    />
  );
};

// --- Modal Content --- //

interface ModalContentProps {
  children: ReactNode;
  className?: string;
  sizeClass?: string; // Pass size class from Modal
}

export const ModalContent: React.FC<ModalContentProps> = ({ children, className = '', sizeClass = 'sm:max-w-md' }) => {
  return (
    <div
      // Prevent closing when clicking inside content
      onClick={(e) => e.stopPropagation()}
      className={`relative z-10 w-full rounded-lg bg-card text-card-foreground dark:bg-dark-card dark:text-dark-card-foreground shadow-xl dark:shadow-dark-xl border border-card-border dark:border-dark-card-border backdrop-blur-md overflow-hidden transition-all ${sizeClass} ${className}`}
    >
      {children}
    </div>
  );
};

// --- Modal Header --- //

interface ModalHeaderProps {
  children: ReactNode;
  className?: string;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({ children, className = '' }) => {
  return (
    <div className={`px-4 sm:px-6 py-4 border-b border-border dark:border-dark-border ${className}`}>
      <h3 className="text-lg font-semibold text-card-foreground dark:text-dark-card-foreground" id="modal-title">
        {children}
      </h3>
    </div>
  );
};

// --- Modal Body --- //

interface ModalBodyProps {
  children: ReactNode;
  className?: string;
}

export const ModalBody: React.FC<ModalBodyProps> = ({ children, className = '' }) => {
  return (
    <div className={`px-4 sm:px-6 py-4 ${className}`}>
      {children}
    </div>
  );
};

// --- Modal Footer --- //

interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({ children, className = '' }) => {
  return (
    // Removed specific bg-* to let ModalContent's glass effect show through
    <div className={`flex justify-end space-x-3 px-4 sm:px-6 py-3 border-t border-border dark:border-dark-border rounded-b-lg ${className}`}>
      {children}
    </div>
  );
};

// --- Modal Close Button --- //

interface ModalCloseButtonProps {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
}

export const ModalCloseButton: React.FC<ModalCloseButtonProps> = ({ onClick, className = '' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute top-3 right-3 p-1 rounded-full text-muted-foreground dark:text-dark-muted-foreground hover:bg-secondary dark:hover:bg-dark-secondary hover:text-secondary-foreground dark:hover:text-dark-secondary-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-dark-card ${className}`}
      aria-label="Close modal"
    >
      <X className="h-5 w-5" />
    </button>
  );
}; 