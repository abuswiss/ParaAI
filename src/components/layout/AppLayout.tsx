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
} from './Sidebar';
import Header from './Header';
import { useAuth } from '@/hooks/useAuth';
import {
  commandPaletteOpenAtom,
  backgroundTasksAtom,
  clearCompletedTasksAtom
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

const AppLayout: React.FC = () => {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useAtom(commandPaletteOpenAtom);
  const tasks = useAtom(backgroundTasksAtom)[0];
  const clearCompletedTasks = useAtom(clearCompletedTasksAtom)[1];
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  // --- Local state for sidebar visibility ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default closed
  const [chatPanelSize, setChatPanelSize] = useState(20);

  // --- Simple toggle function ---
  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

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
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar DIV - Fixed width, controlled by LOCAL state */}
        <div 
          style={{ width: isSidebarOpen ? '16rem' : '3rem' }} 
          className="flex-shrink-0 bg-background border-r transition-all duration-300 ease-in-out overflow-y-auto"
        >
          {/* Pass state down as a prop for internal styling */}
          <Sidebar 
            collapsible="icon" 
            className="h-full" 
            forceState={isSidebarOpen ? 'expanded' : 'collapsed'} 
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
                          tooltip={{ content: isSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar', side: 'right', align: 'center' }} 
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

        {/* Resizable Area (Main + Chat) - Takes remaining space */} 
        <ResizablePanelGroup direction="horizontal" className="flex-grow">
          {/* Main Content Panel */}
          <ResizablePanel order={1} defaultSize={80} minSize={30}>
            <div className={cn(
              "flex flex-col h-full"
            )}>
              <Header />
              <main className="flex-1 overflow-auto p-4 md:p-6 bg-muted/40">
                <Outlet />
              </main>
              {tasks.length > 0 && (
                 <TaskStatusBar tasks={tasks} />
               )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Chat Panel */}
          <ResizablePanel order={2} defaultSize={20} minSize={20} maxSize={75} collapsible={false} onResize={setChatPanelSize}>
            <div className="h-full border-l flex flex-col">
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
    </TooltipProvider>
  );
};

export default AppLayout; 