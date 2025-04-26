import React, { useEffect, useState } from 'react';

export interface NotificationProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number; // in milliseconds
  onClose?: () => void;
  isVisible?: boolean;
  hasCloseButton?: boolean;
}

/**
 * Notification component for displaying messages to the user
 * Can be used for success messages, errors, warnings, or info
 */
const Notification: React.FC<NotificationProps> = ({
  message,
  type = 'info',
  duration = 5000, // 5 seconds by default
  onClose,
  isVisible = true,
  hasCloseButton = true
}) => {
  const [visible, setVisible] = useState(isVisible);
  
  // Auto-hide after duration
  useEffect(() => {
    setVisible(isVisible);
    
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onClose) onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);
  
  // Handle manual close
  const handleClose = () => {
    setVisible(false);
    if (onClose) onClose();
  };
  
  // Different styles based on notification type
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-900/30',
          border: 'border-green-800',
          text: 'text-green-400',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )
        };
      case 'error':
        return {
          bg: 'bg-red-900/30',
          border: 'border-red-800',
          text: 'text-red-400',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )
        };
      case 'warning':
        return {
          bg: 'bg-yellow-900/30',
          border: 'border-yellow-800',
          text: 'text-yellow-400',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )
        };
      default: // info
        return {
          bg: 'bg-blue-900/30',
          border: 'border-blue-800',
          text: 'text-blue-400',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          )
        };
    }
  };
  
  const styles = getTypeStyles();
  
  if (!visible) return null;
  
  return (
    <div className={`flex items-start p-4 rounded-lg ${styles.bg} border ${styles.border} mb-4`}>
      <div className={`flex-shrink-0 ${styles.text}`}>
        {styles.icon}
      </div>
      <div className="ml-3 flex-1">
        <p className="text-sm text-text-primary">{message}</p>
      </div>
      {hasCloseButton && (
        <button 
          onClick={handleClose}
          className={`ml-auto -mx-1.5 -my-1.5 ${styles.text} hover:text-text-primary rounded-lg p-1.5`}
          aria-label="Close"
        >
          <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
};

/**
 * NotificationContainer component for managing multiple notifications
 */
interface NotificationItem extends NotificationProps {
  id: string;
}

interface NotificationContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  position = 'top-right'
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  
  // Position class based on position prop
  const getPositionClass = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2';
      default:
        return 'top-4 right-4';
    }
  };
  
  // Add a new notification
  const addNotification = (notification: Omit<NotificationProps, 'onClose'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications(prev => [...prev, { ...notification, id, isVisible: true }]);
    return id;
  };
  
  // Remove a notification by ID
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  
  // Create global notification methods
  useEffect(() => {
    // Attach methods to window for global access
    const windowWithNotifications = window as any;
    windowWithNotifications.notifications = {
      show: addNotification,
      success: (message: string, options?: Partial<NotificationProps>) => 
        addNotification({ message, type: 'success', ...options }),
      error: (message: string, options?: Partial<NotificationProps>) => 
        addNotification({ message, type: 'error', ...options }),
      warning: (message: string, options?: Partial<NotificationProps>) => 
        addNotification({ message, type: 'warning', ...options }),
      info: (message: string, options?: Partial<NotificationProps>) => 
        addNotification({ message, type: 'info', ...options }),
      remove: removeNotification
    };
    
    return () => {
      delete windowWithNotifications.notifications;
    };
  }, []);
  
  if (notifications.length === 0) return null;
  
  return (
    <div className={`fixed z-50 max-w-sm w-full space-y-2 ${getPositionClass()}`}>
      {notifications.map(notification => (
        <Notification
          key={notification.id}
          {...notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
};

export default Notification;
