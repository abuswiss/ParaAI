import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar
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
import { Home, Files, LogOut, User, Settings, MessageSquare } from 'lucide-react';
import { Avatar } from "@/components/ui/Avatar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import ChatInterface from '@/components/chat/ChatInterface';

// Define the inner component that uses the Sidebar context
const ResizableLayout: React.FC<{ 
  user: any; // Replace with actual User type if available
  tasks: any[]; // Replace with actual Task type if available
  handleLogout: () => void;
  location: ReturnType<typeof useLocation>;
  navigate: ReturnType<typeof useNavigate>;
}> = ({ user, tasks, handleLogout, location, navigate }) => {
  const { isOpen: isSidebarOpen } = useSidebar(); // Now called within the Provider's context
  const [isChatPanelCollapsed, setIsChatPanelCollapsed] = useState(false);
  const [chatPanelSize, setChatPanelSize] = useState(30);

  const handleChatToggle = () => {
      if (isChatPanelCollapsed) {
          setIsChatPanelCollapsed(false);
          setChatPanelSize(prevSize => prevSize < 10 ? 30 : prevSize);
      } else {
          setIsChatPanelCollapsed(true);
      }
  };

  // Calculate default size for the main panel based on sidebar and chat panel states
  const mainPanelDefaultSize = 100 - (isSidebarOpen ? 15 : 5) - (isChatPanelCollapsed ? 0 : chatPanelSize);

  return (
    <ResizablePanelGroup direction="horizontal" className="min-h-screen w-full">
      {/* Left Panel: Sidebar */}
      <ResizablePanel
        defaultSize={isSidebarOpen ? 15 : 5}
        minSize={5}
        maxSize={20}
        collapsible={true}
        collapsedSize={5}
        className={cn("transition-all duration-300 ease-in-out", !isSidebarOpen ? "min-w-[56px] max-w-[56px]" : "min-w-[200px]")} // Sync with sidebar state
        order={1} // Explicit ordering
      >
          <Sidebar collapsible="icon">
            <SidebarHeader>
              <div className="p-2 font-semibold text-lg flex items-center gap-2 group-data-[state=expanded]:pl-3">
                <img
                  src="/src/assets/gavel-icon.svg"
                  alt="BenchWise Logo"
                  className="h-6 w-6 flex-shrink-0"
                  aria-hidden="true"
                />
                <span className="group-data-[state=collapsed]:hidden">BenchWise</span>
              </div>
            </SidebarHeader>
            <SidebarContent className="flex-1 overflow-y-auto">
               <SidebarGroup>
                 <SidebarGroupLabel>Workspace</SidebarGroupLabel>
                 <SidebarMenu>
                   <SidebarMenuItem>
                     <SidebarMenuButton
                       asChild
                       isActive={location.pathname === '/dashboard'}
                       tooltip="Dashboard"
                     >
                       <Link to="/dashboard"><Home /><span>Dashboard</span></Link>
                     </SidebarMenuButton>
                   </SidebarMenuItem>
                   <SidebarMenuItem>
                     <SidebarMenuButton
                       asChild
                       isActive={location.pathname.startsWith('/files') || location.pathname.startsWith('/documents') || location.pathname.startsWith('/cases')}
                       tooltip="Files & Cases"
                     >
                       <Link to="/files"><Files /><span>Files & Cases</span></Link>
                     </SidebarMenuButton>
                   </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={handleChatToggle} // Use handler from this component
                        isActive={!isChatPanelCollapsed}
                        tooltip="Chat"
                      >
                        <MessageSquare /><span>Chat</span>
                      </SidebarMenuButton>
                   </SidebarMenuItem>
                 </SidebarMenu>
               </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
               <SidebarGroup>
                 <SidebarMenu>
                     {user && (
                       <SidebarMenuItem>
                         <SidebarMenuButton
                           variant="ghost"
                           className="cursor-default hover:bg-transparent h-auto justify-start px-2 py-1.5 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0"
                           tooltip={{ content: user.email || 'Account', side: 'right', align: 'center' }}
                         >
                           <Avatar
                             name={user.email || 'User'}
                             src={user.user_metadata?.avatar_url}
                             size="sm"
                             className="flex-shrink-0"
                           />
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
                          onClick={handleLogout} // Use passed-in handler
                          tooltip={{ content: 'Logout', side: 'right', align: 'center' }}
                       >
                         <LogOut />
                         <span className="group-data-[state=collapsed]:hidden">Logout</span>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                 </SidebarMenu>
               </SidebarGroup>
            </SidebarFooter>
          </Sidebar>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Center Panel: Main Content */}
      <ResizablePanel 
        defaultSize={mainPanelDefaultSize} 
        order={2} // Explicit ordering
        minSize={30} // Ensure main content doesn't get too small
      >
        <div className="flex flex-col h-full">
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

      {/* Right Panel: Chat Interface */}
      <ResizablePanel
         defaultSize={chatPanelSize}
         minSize={20}
         maxSize={75}
         collapsible={true}
         collapsedSize={0}
         order={3}
         onCollapse={() => {
             setIsChatPanelCollapsed(true);
         }}
         onExpand={() => {
             setIsChatPanelCollapsed(false);
         }}
         onResize={(size) => {
            if (size > 0) {
                setChatPanelSize(size);
            }
         }}
         isCollapsed={isChatPanelCollapsed} // Control collapse state
      >
        {!isChatPanelCollapsed && (
          <div className="h-full border-l flex flex-col">
            <ChatInterface />
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};


// Main AppLayout component remains largely the same, but renders ResizableLayout inside the provider
const AppLayout: React.FC = () => {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useAtom(commandPaletteOpenAtom);
  const tasks = useAtom(backgroundTasksAtom)[0];
  const clearCompletedTasks = useAtom(clearCompletedTasksAtom)[1];
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

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
    <SidebarProvider defaultOpen={false}>
       <ResizableLayout 
         user={user}
         tasks={tasks}
         handleLogout={handleLogout}
         location={location}
         navigate={navigate}
       />

      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
      />
    </SidebarProvider>
  );
};

export default AppLayout; 