import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Sidebar, SidebarBody, SidebarLink, SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import AppHeader from './AppHeader';
import ClaudeChatInterface from '@/components/claude/ClaudeChatInterface';
import { useAuth } from '@/hooks/useAuth';
import {
  clearCompletedTasksAtom,
  uploadModalOpenAtom,
  commandPaletteOpenAtom,
  deepResearchModeAtom,
  themePreferenceAtom,
} from '@/atoms/appAtoms';
import { cn } from '@/lib/utils';
import { TooltipProvider } from "@/components/ui/Tooltip";
import UploadModal from '@/components/documents/UploadModal';
import TaskStatusBar from '@/components/common/TaskStatusBar';
import GlobalCommandPalette from '@/components/common/GlobalCommandPalette';
import { Home, Files, LogOut, Settings, UploadCloud, Moon, Sun, Brain } from 'lucide-react';
import CaseSelector from './CaseSelector';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TrialStatusDisplay } from './TrialStatusDisplay';

const AppLayout: React.FC = () => {
  const clearCompletedTasks = useAtom(clearCompletedTasksAtom)[1];
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useAtom(uploadModalOpenAtom);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useAtom(commandPaletteOpenAtom);
  const isDeepResearchModeActive = useAtomValue(deepResearchModeAtom);

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
      <LayoutContent isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={handleCloseUploadModal}
      />
      <GlobalCommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
      />
    </TooltipProvider>
  );
};

interface LayoutContentProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const LayoutContent: React.FC<LayoutContentProps> = ({ isSidebarOpen, setIsSidebarOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, userProfile } = useAuth();
  const setUploadModalOpen = useSetAtom(uploadModalOpenAtom);
  const [theme, setTheme] = useAtom(themePreferenceAtom);
  const [mounted, setMounted] = React.useState(false);
  const isDeepResearchModeActive = useAtomValue(deepResearchModeAtom);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Theme effect from old SidebarFooter
  React.useEffect(() => {
    if (mounted) {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      if (theme === 'light' || theme === 'dark') {
        root.classList.add(theme);
      } else {
        // Default to light if system or undefined
        root.classList.add('light'); 
      }
    }
  }, [theme, mounted]);

  const cycleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleOpenUploadModal = () => {
    setUploadModalOpen(true);
  };

  // Define links for the new sidebar structure, similar to SidebarDemo
  const navLinks = [
    {
      label: "Dashboard",
      href: "/app/dashboard",
      icon: <Home className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
    },
    {
      label: "Files & Matters",
      href: "/app/files",
      icon: <Files className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
    },
    // Example of re-adding a previously removed link, if desired.
    // {
    //   label: "Legal Assistant",
    //   href: "/app/claude",
    //   icon: <Brain className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
    // }
  ];

  // User-specific links (Settings, Logout)
  const userLinks = [
    {
      label: "Settings",
      href: "/app/settings",
      icon: <Settings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
    },
    {
      label: "Logout",
      href: "#", // Or handle via onClick
      action: handleLogout,
      icon: <LogOut className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
    }
  ];
  
  const ThemeIcon = theme === 'dark' ? Moon : Sun;
  const themeTooltip = `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`;

  if (!mounted && (theme === 'dark' || theme === 'light')) { // Avoid rendering theme toggle server-side if theme is set
    return null; 
  }

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <AppHeader />
      <PanelGroup 
        direction="horizontal" 
        className="flex flex-1 w-full overflow-hidden bg-background text-foreground dark:bg-dark-background dark:text-dark-foreground min-h-0"
      >
        <Sidebar open={isSidebarOpen} setOpen={setIsSidebarOpen} animate={true}>
          <SidebarBody className="justify-between gap-10 bg-background dark:bg-neutral-800">
            <div className="flex flex-col flex-1 overflow-y-auto">
              <div className="p-4">
                {isSidebarOpen ? <AppLogo /> : <AppLogoIcon />}
              </div>

              <div className={cn(
                "px-4 my-1 transition-opacity duration-300 ease-in-out", 
                isSidebarOpen ? "opacity-100" : "opacity-0 h-0 overflow-hidden pointer-events-none"
              )}>
                <CaseSelector />
              </div>
              
              <div className="mt-2 flex flex-col gap-1 px-2">
                {navLinks.map((link, idx) => (
                  <SidebarLink key={`nav-${idx}`} link={link} />
                ))}
              </div>

              <div className="mt-2 px-2">
                 <SidebarLink
                  link={{
                    label: "Upload Document",
                    href: "#",
                    icon: <UploadCloud className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                  }}
                  onClick={handleOpenUploadModal}
                />
              </div>
            </div>

            <div className="px-2 pb-2 mt-auto">
              <div className="flex items-center justify-center my-2">
                  <TooltipProvider>
                      <Tooltip>
                          <TooltipTrigger asChild>
                              <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={cycleTheme}
                                  className="h-8 w-8"
                                  aria-label={themeTooltip}
                              >
                                  <ThemeIcon className="h-5 w-5" />
                                  <span className="sr-only">{themeTooltip}</span>
                              </Button>
                          </TooltipTrigger>
                          <TooltipContent side="right" align="center">
                              {themeTooltip}
                          </TooltipContent>
                      </Tooltip>
                  </TooltipProvider>
              </div>
              
              {user && (
                <SidebarLink
                  link={{
                    label: user.email || "Account",
                    href: "#",
                    icon: (
                      <div className="flex h-7 w-7 min-w-7 items-center justify-center rounded-full bg-secondary dark:bg-dark-secondary text-secondary-foreground dark:text-dark-secondary-foreground">
                        <span className="text-sm font-medium">{user.email?.charAt(0).toUpperCase() || 'U'}</span>
                      </div>
                    ),
                  }}
                  className="cursor-default hover:bg-transparent"
                />
              )}
              {userLinks.map((link, idx) => (
                <SidebarLink 
                  key={`user-${idx}`} 
                  link={link} 
                  onClick={link.action ? (e) => { e.preventDefault(); link.action(); } : undefined} 
                />
              ))}
            </div>
          </SidebarBody>
        </Sidebar>

        <Panel defaultSize={85} minSize={30} className="flex-grow flex flex-col h-full min-w-0 bg-background dark:bg-dark-purple text-foreground dark:text-dark-foreground">
          <div className="p-2 sm:p-3 md:p-4 border-b border-border dark:border-dark-border">
            <TrialStatusDisplay />
          </div>
          <main className="flex-1 h-full min-h-0 w-full relative">
            <div className="w-full h-full absolute inset-0 overflow-y-auto pt-0 px-4 pb-4 md:px-6 md:pb-6">
              <Outlet />
            </div>
          </main>
          <TaskStatusBar />
        </Panel>

        <PanelResizeHandle 
          id="chat-resize-handle" 
          className="w-4 bg-border/30 dark:bg-purple-gray/50 hover:bg-primary/70 dark:hover:bg-legal-purple/70 transition-colors cursor-col-resize z-20 flex items-center justify-center"
        >
          <div className="h-16 w-1 bg-border/70 dark:bg-purple-gray rounded-full hover:bg-primary dark:hover:bg-legal-purple transition-colors" />
        </PanelResizeHandle>

        <Panel 
          id="chat-panel" 
          defaultSize={20} 
          minSize={15} 
          maxSize={50} 
          className={cn(
            "flex flex-col h-full flex-shrink-0",
            isDeepResearchModeActive 
              ? "bg-orange-100/50 dark:bg-orange-900/30"
              : "bg-background dark:bg-dark-purple"
          )}
          onResize={(size) => console.log('Chat panel resized to:', size)}
        >
          <ClaudeChatInterface />
        </Panel>
      </PanelGroup>
    </div>
  );
}

// Helper components for Logo (can be moved to a different file if preferred)
const AppLogo = () => (
  <Link
    to="/"
    className="font-normal flex space-x-2 items-center text-sm text-black dark:text-white py-1 relative z-20"
  >
    <div className="h-5 w-6 bg-primary dark:bg-primary rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="font-medium text-black dark:text-white whitespace-pre text-lg"
    >
      BenchWise
    </motion.span>
  </Link>
);

const AppLogoIcon = () => (
  <Link
    to="/"
    className="font-normal flex space-x-2 items-center text-sm text-black dark:text-white py-1 relative z-20"
  >
    <div className="h-6 w-7 bg-primary dark:bg-primary rounded-lg flex-shrink-0 flex items-center justify-center text-primary-foreground font-bold text-lg">B</div>
  </Link>
);

export default AppLayout; 