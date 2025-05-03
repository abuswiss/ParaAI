import React, { useEffect, useState, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
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
  clearCompletedTasksAtom,
  uploadModalOpenAtom,
  commandPaletteOpenAtom
} from '@/atoms/appAtoms';
import { cn } from '@/lib/utils';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import ChatInterface from '@/components/chat/ChatInterface';
import { TooltipProvider } from "@/components/ui/Tooltip";
import UploadModal from '@/components/documents/UploadModal';
import { InlineSuggestionProvider } from '@/context/InlineSuggestionContext';
import ChatHistoryList from '@/components/history/ChatHistoryList';
import TaskStatusBar from '@/components/common/TaskStatusBar';
import GlobalCommandPalette from '@/components/common/GlobalCommandPalette';
import { Home, Files, LogOut, Settings, PanelLeft } from 'lucide-react';
import CaseSelector from './CaseSelector';

const AppLayout: React.FC = () => {
  const clearCompletedTasks = useAtom(clearCompletedTasksAtom)[1];
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default OPEN for testing
  const [isUploadModalOpen, setIsUploadModalOpen] = useAtom(uploadModalOpenAtom);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useAtom(commandPaletteOpenAtom);

  // Keyboard listener for Command Palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [setIsCommandPaletteOpen]);

  // Handler for closing the upload modal
  const handleCloseUploadModal = () => {
      setIsUploadModalOpen(false);
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      clearCompletedTasks();
    }, 5000);
    return () => clearInterval(intervalId);
  }, [clearCompletedTasks]);

  return (
    <TooltipProvider>
      <SidebarProvider open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <InlineSuggestionProvider editor={null}>
          <LayoutContent />
          <UploadModal
            isOpen={isUploadModalOpen}
            onClose={handleCloseUploadModal}
          />
          <GlobalCommandPalette
            open={isCommandPaletteOpen}
            onOpenChange={setIsCommandPaletteOpen}
          />
        </InlineSuggestionProvider>
      </SidebarProvider>
    </TooltipProvider>
  );
};

const LayoutContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toggleSidebar, state: sidebarState } = useSidebar();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const toggleTooltip = sidebarState === 'expanded' ? 'Collapse Sidebar' : 'Expand Sidebar';

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-shrink-0 bg-background border-r h-full flex flex-col group/sidebar">
        <Sidebar collapsible="icon" className="h-full flex flex-col">
          <SidebarHeader>
            <div className="p-2 font-semibold text-lg flex items-center justify-center h-12">
              {sidebarState === 'expanded' ? (
                  <span>BenchWise</span>
              ) : (
                  <span className="text-xl font-bold">B</span>
              )}
            </div>
          </SidebarHeader>
          <SidebarContent className="flex flex-col h-full p-2 space-y-2">
            {/* Conditionally render CaseSelector only when expanded */}
            {sidebarState === 'expanded' && (
              <div className={cn("px-2", sidebarState === 'collapsed' && "px-0")}>
                <CaseSelector />
              </div>
            )}
            {/* Top Navigation */}
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/dashboard'} tooltip="Dashboard">
                    <Link to="/dashboard">
                      <Home />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname.startsWith('/files') || location.pathname.startsWith('/documents') || location.pathname.startsWith('/cases')} tooltip="Files & Cases">
                    <Link to="/files">
                      <Files />
                      <span>Files & Cases</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            {/* Chat History Section - Only visible when expanded */}
            {sidebarState === 'expanded' && (
              <>
                <SidebarSeparator className="my-2" />
                <SidebarGroup className="overflow-y-auto min-h-0">
                  <SidebarGroupLabel>Recent Chats</SidebarGroupLabel>
                  <div className="mt-1">
                    <ChatHistoryList />
                  </div>
                </SidebarGroup>
              </>
            )}

            {/* Spacer to push account section to the bottom */}
            <div className="flex-grow" />

            {/* User account and settings section at the bottom */}
            <div className="border-t pt-2 pb-2">
              <SidebarMenu>
                {user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
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
                    <span>Settings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={handleLogout}
                    tooltip={{ content: 'Logout', side: 'right', align: 'center' }}
                  >
                    <LogOut />
                    <span>Logout</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarSeparator className="my-1" />
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={toggleSidebar}
                    tooltip={{ content: toggleTooltip, side: 'right', align: 'center' }}
                  >
                    <PanelLeft />
                    <span>Collapse</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>
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
            <TaskStatusBar />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel order={2} defaultSize={20} minSize={20} maxSize={75} collapsible={false}>
          <div className="h-full border-l flex flex-col">
            {/* Always render ChatInterface here */}
            <ChatInterface />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      {/* Command Palette is now rendered in AppLayout */}
    </div>
  );
}

export default AppLayout; 