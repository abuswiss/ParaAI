import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FileText } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [documentsExpanded, setDocumentsExpanded] = useState(true);

  // Navigation items
  const navigationItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
      ),
    },
    {
      name: 'Cases',
      path: '/cases',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: 'Documents',
      path: '/documents',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: 'Templates',
      path: '/templates',
      icon: <FileText className="h-5 w-5" />,
    },
  ];

  return (
    <aside 
      className={`
        fixed inset-y-0 left-0 z-[60]
        bg-surface border-r border-gray-800
        transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full w-0'}
        flex flex-col
        shadow-lg shadow-black/20
        overflow-hidden
      `}
    >
      <div className="h-full flex flex-col overflow-hidden">
        {/* Seamless top background area */}
        <div className="border-b border-gray-800 bg-surface shadow-inner-light h-12 w-full" />

        {/* New chat button */}
        <div className="p-4">
          <Link
            to="/chat/new"
            className="
              bg-primary hover:bg-primary-hover text-white
              rounded-lg py-2.5 px-4
              flex items-center justify-center space-x-2
              transition-all duration-200
              shadow-sm
              w-full
              font-medium
            "
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <span>New Chat</span>
          </Link>
        </div>
        
        {/* Main navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {/* Main Navigation Links */}
          <div className="mb-6 space-y-1">
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center py-2.5 px-3 
                  rounded-lg 
                  transition-all duration-200
                  ${location.pathname === item.path 
                    ? 'bg-primary-light text-primary' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-lighter'}
                `}
              >
                <span className="mr-3">{item.icon}</span>
                <span className="font-medium">{item.name}</span>
              </Link>
            ))}
          </div>

          {/* Case documents section */}
          <div className="mb-6">
            <button
              onClick={() => setDocumentsExpanded(!documentsExpanded)}
              className="
                flex items-center justify-between w-full 
                py-2 px-3 rounded-lg
                text-text-secondary hover:text-text-primary
                hover:bg-surface-lighter
                transition-all duration-200
                mb-1
              "
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Case Documents</span>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`
                  h-4 w-4 
                  transition-transform duration-300 ease-in-out
                  ${documentsExpanded ? 'rotate-180' : ''}
                `}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            
            {/* Documents list with animation */}
            <div className={`
              overflow-hidden transition-all duration-300 ease-in-out
              ${documentsExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}
            `}>
              <div className="pl-10 pr-3 py-2">
                <p className="text-text-tertiary text-sm">No documents yet</p>
              </div>
            </div>
          </div>

          {/* Recent conversations */}
          <div className="mb-6 mt-6">
            <h3 className="
              text-xs uppercase text-text-tertiary font-medium 
              px-3 mb-2
            ">Recent Conversations</h3>
            <div className="space-y-1 mt-2">
              <p className="text-text-tertiary text-sm px-3">No recent conversations</p>
            </div>
          </div>
        </nav>

        {/* User profile and sign out */}
        <div className="
          p-4 border-t border-gray-800
          bg-surface-darker
          shadow-inner-light
        ">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="
                h-9 w-9 rounded-full 
                bg-surface-lighter 
                flex items-center justify-center
                text-text-secondary
              ">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-text-primary font-medium truncate max-w-[120px]">
                  {user?.email?.split('@')[0]}
                </span>
                <span className="text-xs text-text-tertiary truncate max-w-[120px]">
                  {user?.email}
                </span>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="
                p-2 rounded-full
                text-text-secondary hover:text-text-primary
                hover:bg-surface-lighter
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50
              "
              aria-label="Sign out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
