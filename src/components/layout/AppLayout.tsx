import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
  SidebarProvider,
  useSidebar,
} from './Sidebar';
import Header from './Header';
import { useAuth } from '@/hooks/useAuth';
import {
  commandPaletteOpenAtom,
  backgroundTasksAtom,
  clearCompletedTasksAtom,
  uploadModalOpenAtom
} from '@/atoms/appAtoms';
import { cn } from '@/lib/utils';
import CommandPalette from '@/components/common/GlobalCommandPalette';
import TaskStatusBar from '@/components/common/TaskStatusBar';
import { Home, Files, LogOut, User, Settings, MessageSquare, PanelLeft } from 'lucide-react';
import { Avatar } from "@/components/ui/Avatar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import ChatInterface from '@/components/chat/ChatInterface';
import { TooltipProvider } from "@/components/ui/Tooltip";
import UploadModal from '@/components/documents/UploadModal';
import { InlineSuggestionProvider } from '@/context/InlineSuggestionContext';

const AppLayout: React.FC = () => {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useAtom(commandPaletteOpenAtom);
  const tasks = useAtom(backgroundTasksAtom)[0];
  const clearCompletedTasks = useAtom(clearCompletedTasksAtom)[1];
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  // --- Local state for sidebar visibility ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default OPEN for testing
  const [chatPanelSize, setChatPanelSize] = useState(20);
  const [isUploadModalOpen, setIsUploadModalOpen] = useAtom(uploadModalOpenAtom);

  // --- Toggle function is now handled by context ---
  // const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

  // Handler for closing the upload modal
  const handleCloseUploadModal = (refreshNeeded?: boolean) => {
      setIsUploadModalOpen(false);
      // TODO: Optionally handle refresh logic here based on refreshNeeded
      // if (refreshNeeded) { ... }
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      clearCompletedTasks();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [clearCompletedTasks]);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <TooltipProvider>
      <SidebarProvider open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <InlineSuggestionProvider editor={null}>
          <LayoutContent />
          <UploadModal
            isOpen={isUploadModalOpen}
            onClose={handleCloseUploadModal}
          />
        </InlineSuggestionProvider>
      </SidebarProvider>
    </TooltipProvider>
  );
};

const LayoutContent: React.FC = () => {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useAtom(commandPaletteOpenAtom);
  const tasks = useAtom(backgroundTasksAtom)[0];
  const clearCompletedTasks = useAtom(clearCompletedTasksAtom)[1];
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toggleSidebar, state: sidebarState } = useSidebar();
  const [chatPanelSize, setChatPanelSize] = useState(20);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const toggleTooltip = sidebarState === 'expanded' ? 'Collapse Sidebar' : 'Expand Sidebar';

  return (
    <div className="flex h-screen overflow-hidden">
      <div 
        className="flex-shrink-0 bg-background border-r overflow-y-auto"
      >
        <Sidebar 
          collapsible="icon" 
          className="h-full" 
        >
            <SidebarHeader>
              <div className="p-2 font-semibold text-lg flex items-center gap-2 group-data-[state=expanded]:pl-3">
                 <span className="group-data-[state=collapsed]:hidden">BenchWise</span>
              </div>
            </SidebarHeader>
            <SidebarContent className="flex-1 flex flex-col">
               <SidebarGroup>
                 <SidebarGroupLabel>Workspace</SidebarGroupLabel>
                 <SidebarMenu>
                    <SidebarMenuItem>
                       <SidebarMenuButton asChild isActive={location.pathname === '/dashboard'} tooltip="Dashboard">
                         <Link to="/dashboard"><Home /><span>Dashboard</span></Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                     <SidebarMenuItem>
                       <SidebarMenuButton asChild isActive={location.pathname.startsWith('/files') || location.pathname.startsWith('/documents') || location.pathname.startsWith('/cases')} tooltip="Files & Cases">
                         <Link to="/files"><Files /><span>Files & Cases</span></Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                 </SidebarMenu>
               </SidebarGroup>

               <SidebarGroup className="mt-auto">
                 <SidebarMenu>
                     {user && (
                       <SidebarMenuItem>
                         <SidebarMenuButton 
                           variant="ghost" 
                           className="cursor-default hover:bg-transparent h-auto justify-start px-2 py-1.5" 
                           tooltip={{ content: user.email || 'Account', side: 'right', align: 'center' }}
                         >
                           <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sidebar text-primary-foreground group-data-[state=expanded]:h-7 group-data-[state=expanded]:w-7">
                             <span className="text-sm font-medium">{user.email?.charAt(0).toUpperCase() || 'U'}</span>
                           </div>
                           <span className="ml-2 text-sm font-medium text-foreground truncate max-w-[140px] group-data-[state=collapsed]:hidden">
                             {user.email || 'Account'}
                           </span>
                         </SidebarMenuButton>
                       </SidebarMenuItem>
                     )}
                     <SidebarMenuItem>
                       <SidebarMenuButton 
                         onClick={() => navigate('/settings')} 
                         tooltip={{ content: 'Settings', side: 'right', align: 'center' }} 
                       >
                         <Settings />
                         <span className="group-data-[state=collapsed]:hidden">Settings</span>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                     <SidebarMenuItem>
                       <SidebarMenuButton 
                         onClick={handleLogout} 
                         tooltip={{ content: 'Logout', side: 'right', align: 'center' }} 
                       >
                         <LogOut />
                         <span className="group-data-[state=collapsed]:hidden">Logout</span>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                     <SidebarSeparator className="my-1" /> 
                     <SidebarMenuItem>
                      <SidebarMenuButton 
                        onClick={toggleSidebar}
                        tooltip={{ content: toggleTooltip, side: 'right', align: 'center' }} 
                      >
                       <PanelLeft />
                       <span className="group-data-[state=collapsed]:hidden">Collapse</span>
                     </SidebarMenuButton>
                   </SidebarMenuItem>
                 </SidebarMenu>
               </SidebarGroup>
            </SidebarContent>
        </Sidebar>
      </div>

      {/* Resizable Area (Main + Chat) */} 
      <ResizablePanelGroup direction="horizontal" className="flex-grow">
        <ResizablePanel order={1} defaultSize={80} minSize={30}>
          <div className={cn("flex flex-col h-full")}>
            <Header />
            <main className="flex-1 overflow-auto p-4 md:p-6 bg-muted/40">
              <Outlet />
            </main>
            {tasks.length > 0 && (<TaskStatusBar tasks={tasks} />)}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel order={2} defaultSize={20} minSize={20} maxSize={75} collapsible={false} onResize={setChatPanelSize}>
          <div className="h-full border-l flex flex-col">
            {/* Always render ChatInterface here */}
            <ChatInterface />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Command Palette */} 
      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
      />
    </div>
  );
}

export default AppLayout; 