import React from 'react';
import { motion } from 'framer-motion';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'away' | 'busy' | 'offline';

export interface AvatarProps {
  src?: string;
  name: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  className?: string;
  border?: boolean;
  animate?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  status,
  className = '',
  border = false,
  animate = false,
}) => {
  // Get initials from name
  const initials = name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2);

  // Size-specific classes
  const sizeClasses = {
    xs: 'h-6 w-6 text-xs',
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-md',
    lg: 'h-12 w-12 text-lg',
    xl: 'h-16 w-16 text-xl',
  };

  // Status color classes
  const statusColorClasses = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-500',
  };

  // Status size classes
  const statusSizeClasses = {
    xs: 'h-1.5 w-1.5',
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
    xl: 'h-4 w-4',
  };

  // Background color classes for initial avatars
  // We'll use different background colors based on the first letter of the name
  const bgColors = [
    'bg-primary/80',
    'bg-blue-500/80',
    'bg-green-500/80',
    'bg-yellow-500/80',
    'bg-purple-500/80',
    'bg-pink-500/80',
  ];
  
  const charCode = name.charCodeAt(0) || 65;
  const bgColorIndex = charCode % bgColors.length;
  const bgColorClass = src ? '' : bgColors[bgColorIndex];

  // Border classes
  const borderClasses = border ? 'border-2 border-gray-700' : '';

  // Combine classes
  const avatarClasses = `
    relative inline-flex items-center justify-center rounded-full overflow-hidden
    ${sizeClasses[size]}
    ${bgColorClass}
    ${borderClasses}
    ${className}
  `;

  // Animation variants
  const avatarAnimation = animate
    ? {
        whileHover: { scale: 1.1 },
        whileTap: { scale: 0.95 },
        transition: { duration: 0.2 },
      }
    : {};

  return (
    <div className="relative inline-block">
      <motion.div className={avatarClasses} {...avatarAnimation}>
        {src ? (
          <img
            src={src}
            alt={name}
            className="h-full w-full object-cover"
            onError={(e) => {
              // If image fails to load, show initials instead
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span className="font-medium text-white">{initials}</span>
        )}
      </motion.div>
      
      {status && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full ring-2 ring-gray-800 ${statusColorClasses[status]} ${statusSizeClasses[size]}`}
        />
      )}
    </div>
  );
};
