import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PanelLeft, User as UserIcon, LogOut, Settings } from 'lucide-react'; // Use specific icons
import { useSidebar } from './Sidebar'; // Import hook to control sidebar
import { useAuth } from '@/hooks/useAuth'; // Import auth hook
import { Button } from '@/components/ui/Button';
import { Avatar } from "@/components/ui/Avatar"; // Use Avatar
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { cn } from '@/lib/utils';

const Header: React.FC = () => {
  const { toggleSidebar, state: sidebarState } = useSidebar(); // Get sidebar state and toggle function
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut();
    navigate('/auth'); // Redirect after logout
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      {/* Sidebar Toggle Button */}
      <Button
        size="icon"
        variant="outline"
        onClick={toggleSidebar}
      >
        <PanelLeft className="h-5 w-5" />
        <span className="sr-only">Toggle Menu</span>
      </Button>

      {/* Placeholder for Breadcrumbs or Page Title if needed */}
      <div className="flex-1">
         {/* Breadcrumbs could go here */}
      </div>

      {/* User Menu Removed - Moved to SidebarFooter in AppLayout */}
      {/* <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="overflow-hidden rounded-full"
          >
            <Avatar 
              name={user?.email || 'User'} 
              src={user?.user_metadata?.avatar_url}
              size="sm"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{user?.email || 'My Account'}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLogout}>
             <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu> */}
    </header>
  );
};

export default Header; 