import React from 'react';
import { 
  Save, 
  Heading1, 
  Heading2, 
  Type, 
  Bold, 
  Italic, 
  List, 
  ListOrdered,
  Quote,
  Sparkles,
  File,
  Upload,
  Loader,
  Square // <-- Import Square
} from 'lucide-react';

export interface IconProps {
  className?: string;
  size?: number;
  color?: string;
}

// Base icon component that will be used by all other icons
const BaseIcon: React.FC<IconProps & { children: React.ReactNode }> = ({ 
  className = '', 
  size = 24, 
  color = 'currentColor',
  children 
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className}`}
    >
      {children}
    </svg>
  );
};

// Document related icons
export const DocumentIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </BaseIcon>
);

export const FileTextIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </BaseIcon>
);

export const FolderIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </BaseIcon>
);

// UI action icons
export const PlusIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </BaseIcon>
);

export const MinusIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <line x1="5" y1="12" x2="19" y2="12" />
  </BaseIcon>
);

export const EditIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </BaseIcon>
);

export const TrashIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </BaseIcon>
);

export const CloseIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </BaseIcon>
);

// Chat & messaging icons
export const SendIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </BaseIcon>
);

export const MessageIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </BaseIcon>
);

export const CopyIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </BaseIcon>
);

export const RefreshIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <polyline points="1 4 1 10 7 10" />
    <polyline points="23 20 23 14 17 14" />
    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
  </BaseIcon>
);

// Navigation and menu icons
export const MenuIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </BaseIcon>
);

export const ChevronDownIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <polyline points="6 9 12 15 18 9" />
  </BaseIcon>
);

export const ChevronUpIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <polyline points="18 15 12 9 6 15" />
  </BaseIcon>
);

export const ChevronLeftIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <polyline points="15 18 9 12 15 6" />
  </BaseIcon>
);

export const ChevronRightIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <polyline points="9 18 15 12 9 6" />
  </BaseIcon>
);

// User and profile icons
export const UserIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </BaseIcon>
);

export const SettingsIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </BaseIcon>
);

export const LogoutIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </BaseIcon>
);

// Alert and notification icons
export const InfoIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </BaseIcon>
);

export const AlertIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </BaseIcon>
);

export const CheckIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <polyline points="20 6 9 17 4 12" />
  </BaseIcon>
);

// Legal specific icons
export const GavelIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M14 14L6 6l-2 2 8 8 2-2z" />
    <path d="M20 20H4v-2h16v2z" />
    <path d="M20 9l-8-8-2 2 8 8 2-2z" />
  </BaseIcon>
);

export const ScaleIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M12 3v18" />
    <path d="M6 10l6-7 6 7" />
    <path d="M3 21h18" />
    <path d="M6 15c0 1.7 1.3 3 3 3s3-1.3 3-3-1.3-3-3-3-3 1.3-3 3z" />
    <path d="M18 15c0 1.7-1.3 3-3 3s-3-1.3-3-3 1.3-3 3-3 3 1.3 3 3z" />
  </BaseIcon>
);

export const ClockIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </BaseIcon>
);

// Re-export necessary icons directly from lucide-react
export {
  Save,
  Heading1,
  Heading2,
  Type,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Sparkles,
  File,
  Upload,
  Loader,
  Square // <-- Export Square directly
} from 'lucide-react';

// Create the consolidated Icons object
export const Icons = {
  Document: DocumentIcon,
  FileText: FileTextIcon,
  Folder: FolderIcon,
  Plus: PlusIcon,
  Minus: MinusIcon,
  Edit: EditIcon,
  Trash: TrashIcon,
  Close: CloseIcon,
  Send: SendIcon,
  Message: MessageIcon,
  Copy: CopyIcon,
  Refresh: RefreshIcon,
  Menu: MenuIcon,
  ChevronDown: ChevronDownIcon,
  ChevronUp: ChevronUpIcon,
  ChevronLeft: ChevronLeftIcon,
  ChevronRight: ChevronRightIcon,
  User: UserIcon,
  Settings: SettingsIcon,
  Logout: LogoutIcon,
  Info: InfoIcon,
  Alert: AlertIcon,
  Check: CheckIcon,
  Gavel: GavelIcon,
  Scale: ScaleIcon,
  Clock: ClockIcon,
  // Add re-exported lucide icons here using their original names
  Save: Save,
  Heading1: Heading1,
  Heading2: Heading2,
  Type: Type,
  Bold: Bold,
  Italic: Italic,
  List: List,
  ListOrdered: ListOrdered,
  Quote: Quote,
  Sparkles: Sparkles,
  File: File,
  Upload: Upload,
  Loader: Loader,
  Square: Square // <-- Add Square here
};
